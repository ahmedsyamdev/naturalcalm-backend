import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';
import { IProgram } from './Program.model';

// UserProgram document interface
export interface IUserProgram extends Document {
  userId: Schema.Types.ObjectId;
  programId: Schema.Types.ObjectId;
  completedTracks: Schema.Types.ObjectId[];
  progress: number;
  enrolledAt: Date;
  lastAccessedAt?: Date;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  calculateProgress(): Promise<IUserProgram>;
  markTrackComplete(trackId: string): Promise<IUserProgram>;
}

// Query helper types for UserProgram
interface IUserProgramQueryHelpers {
  byUser(userId: string): QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>;
  completed(): QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>;
  inProgress(): QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>;
  notStarted(): QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>;
}

// UserProgram model interface with statics
interface IUserProgramModel extends Model<IUserProgram, IUserProgramQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<IUserProgram>): Query<IUserProgram[], IUserProgram>;
}

// UserProgram schema
const UserProgramSchema = new Schema<IUserProgram, IUserProgramModel, Record<string, never>, IUserProgramQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program ID is required'],
      index: true,
    },
    completedTracks: {
      type: [Schema.Types.ObjectId],
      ref: 'Track',
      default: [],
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedAt: {
      type: Date,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
UserProgramSchema.plugin(timestampsPlugin);

// Compound unique index: a user can only enroll in a program once
UserProgramSchema.index({ userId: 1, programId: 1 }, { unique: true });

// Indexes for queries
UserProgramSchema.index({ userId: 1, isCompleted: 1 });
UserProgramSchema.index({ userId: 1, lastAccessedAt: -1 });

// Method to calculate progress based on completed tracks
UserProgramSchema.methods.calculateProgress = async function (): Promise<IUserProgram> {
  // Populate the program to get total tracks
  await this.populate('programId');

  const program = this.programId as IProgram;
  const totalTracks = program.tracks?.length || 0;

  if (totalTracks === 0) {
    this.progress = 0;
    this.isCompleted = false;
  } else {
    this.progress = Math.round(
      (this.completedTracks.length / totalTracks) * 100
    );

    // Mark as completed if all tracks are done
    if (this.completedTracks.length >= totalTracks) {
      this.isCompleted = true;
      if (!this.completedAt) {
        this.completedAt = new Date();
      }
    } else {
      this.isCompleted = false;
      this.completedAt = undefined;
    }
  }

  return this.save();
};

// Method to mark a track as complete
UserProgramSchema.methods.markTrackComplete = async function (
  trackId: string
): Promise<IUserProgram> {
  // Check if track is already completed
  const alreadyCompleted = this.completedTracks.some(
    (id: Schema.Types.ObjectId) => id.toString() === trackId
  );

  if (!alreadyCompleted) {
    this.completedTracks.push(trackId as any);
  }

  // Update last accessed time
  this.lastAccessedAt = new Date();

  // Recalculate progress
  return await this.calculateProgress();
};

// Query helpers
UserProgramSchema.query.byUser = function (this: QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>, userId: string) {
  return this.where({ userId });
};

UserProgramSchema.query.completed = function (this: QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>) {
  return this.where({ isCompleted: true });
};

UserProgramSchema.query.inProgress = function (this: QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>) {
  return this.where({ isCompleted: false, progress: { $gt: 0 } });
};

UserProgramSchema.query.notStarted = function (this: QueryWithHelpers<IUserProgram[], IUserProgram, IUserProgramQueryHelpers>) {
  return this.where({ progress: 0 });
};

// Static methods
UserProgramSchema.statics.findUserPrograms = function (
  userId: string,
  options?: { completed?: boolean; inProgress?: boolean }
) {
  const query: FilterQuery<IUserProgram> = { userId };

  if (options?.completed !== undefined) {
    query.isCompleted = options.completed;
  }

  if (options?.inProgress) {
    query.isCompleted = false;
    query.progress = { $gt: 0 };
  }

  return this.find(query)
    .populate('programId')
    .sort({ lastAccessedAt: -1, enrolledAt: -1 });
};

UserProgramSchema.statics.getUserProgress = async function (
  userId: string,
  programId: string
) {
  return this.findOne({ userId, programId }).populate('programId');
};

// Create and export the UserProgram model
export const UserProgram = model<IUserProgram, IUserProgramModel>(
  'UserProgram',
  UserProgramSchema
);

export default UserProgram;
