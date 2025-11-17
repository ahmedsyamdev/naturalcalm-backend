import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// ListeningSession document interface
export interface IListeningSession extends Document {
  userId: Schema.Types.ObjectId;
  trackId: Schema.Types.ObjectId;
  programId?: Schema.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  completed: boolean;
  lastPosition: number;
  deviceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Query helper types for ListeningSession
interface IListeningSessionQueryHelpers {
  byUser(userId: string): QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>;
  byTrack(trackId: string): QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>;
  completed(): QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>;
  inDateRange(startDate: Date, endDate: Date): QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>;
}

// ListeningSession model interface with statics
interface IListeningSessionModel extends Model<IListeningSession, IListeningSessionQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<IListeningSession>): Query<IListeningSession[], IListeningSession>;
  getUserListeningHistory(userId: string, limit?: number): Query<IListeningSession[], IListeningSession>;
  getTrackListeningCount(trackId: string): Promise<number>;
}

// ListeningSession schema
const ListeningSessionSchema = new Schema<
  IListeningSession,
  IListeningSessionModel,
  Record<string, never>,
  IListeningSessionQueryHelpers
>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'Track',
      required: [true, 'Track ID is required'],
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      // Optional - only set if track was played as part of a program
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      default: Date.now,
      index: true,
    },
    endTime: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastPosition: {
      type: Number,
      default: 0,
      min: 0,
      // Position in seconds where the user stopped listening
    },
    deviceInfo: {
      type: String,
      // User agent or device identifier
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
ListeningSessionSchema.plugin(timestampsPlugin);

// Indexes for analytics and queries
// Note: userId, trackId, startTime, completed indexes are automatically created via index: true in field definitions

// Compound indexes for analytics
ListeningSessionSchema.index({ userId: 1, createdAt: -1 }); // For user analytics
ListeningSessionSchema.index({ userId: 1, trackId: 1 }); // For track-specific user analytics
ListeningSessionSchema.index({ userId: 1, completed: 1 }); // For completion tracking
ListeningSessionSchema.index({ userId: 1, startTime: 1 }); // For date range queries

// Query helpers
ListeningSessionSchema.query.byUser = function (this: QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>, userId: string) {
  return this.where({ userId });
};

ListeningSessionSchema.query.byTrack = function (this: QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>, trackId: string) {
  return this.where({ trackId });
};

ListeningSessionSchema.query.completed = function (this: QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>) {
  return this.where({ completed: true });
};

ListeningSessionSchema.query.inDateRange = function (
  this: QueryWithHelpers<IListeningSession[], IListeningSession, IListeningSessionQueryHelpers>,
  startDate: Date,
  endDate: Date
) {
  return this.where({
    startTime: { $gte: startDate, $lte: endDate },
  });
};

// Static methods
ListeningSessionSchema.statics.getUserStats = async function (
  userId: string,
  days = 7
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sessions = await this.find({
    userId,
    startTime: { $gte: startDate },
  });

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.completed).length;
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + s.durationSeconds / 60,
    0
  );

  return {
    totalSessions,
    completedSessions,
    totalMinutes: Math.round(totalMinutes),
    completionRate:
      totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0,
  };
};

ListeningSessionSchema.statics.getTrackStats = async function (
  trackId: string,
  days = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sessions = await this.find({
    trackId,
    startTime: { $gte: startDate },
  });

  const totalPlays = sessions.length;
  const uniqueUsers = new Set(sessions.map((s) => s.userId.toString())).size;
  const completedPlays = sessions.filter((s) => s.completed).length;

  return {
    totalPlays,
    uniqueUsers,
    completedPlays,
    completionRate:
      totalPlays > 0 ? Math.round((completedPlays / totalPlays) * 100) : 0,
  };
};

ListeningSessionSchema.statics.getUserListeningHistory = function (
  userId: string,
  limit = 20
) {
  return this.find({ userId })
    .populate('trackId')
    .populate('programId')
    .sort({ startTime: -1 })
    .limit(limit);
};

// Create and export the ListeningSession model
export const ListeningSession = model<
  IListeningSession,
  IListeningSessionModel
>('ListeningSession', ListeningSessionSchema);

export default ListeningSession;
