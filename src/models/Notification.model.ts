import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Notification document interface
export interface INotification extends Document {
  userId: Schema.Types.ObjectId;
  type: 'new_content' | 'achievement' | 'reminder' | 'subscription' | 'system';
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  markAsRead(): Promise<INotification>;
}

// Query helper types for Notification
interface INotificationQueryHelpers {
  byUser(userId: string): QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>;
  unread(): QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>;
  read(): QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>;
  byType(type: 'new_content' | 'achievement' | 'reminder' | 'subscription' | 'system'): QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>;
}

// Notification model interface with statics
interface INotificationModel extends Model<INotification, INotificationQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<INotification>): Query<INotification[], INotification>;
  getUserNotifications(userId: string, limit?: number): Query<INotification[], INotification>;
  markAllAsRead(userId: string): Promise<number>;
}

// Notification schema
const NotificationSchema = new Schema<INotification, INotificationModel, Record<string, never>, INotificationQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: [
          'new_content',
          'achievement',
          'reminder',
          'subscription',
          'system',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      // Emoji or icon identifier
    },
    imageUrl: {
      type: String,
      // Optional image for the notification
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
      // Additional data payload (e.g., trackId, programId, etc.)
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
NotificationSchema.plugin(timestampsPlugin);

// Indexes
// Note: userId, type, isRead indexes are automatically created via index: true in field definitions
NotificationSchema.index({ createdAt: -1 });

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1 });

// Method to mark notification as read
NotificationSchema.methods.markAsRead = async function (): Promise<INotification> {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this as unknown as INotification);
};

// Query helpers
NotificationSchema.query.byUser = function (this: QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>, userId: string) {
  return this.where({ userId });
};

NotificationSchema.query.unread = function (this: QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>) {
  return this.where({ isRead: false });
};

NotificationSchema.query.read = function (this: QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>) {
  return this.where({ isRead: true });
};

NotificationSchema.query.byType = function (
  this: QueryWithHelpers<INotification[], INotification, INotificationQueryHelpers>,
  type: 'new_content' | 'achievement' | 'reminder' | 'subscription' | 'system'
) {
  return this.where({ type });
};

// Static methods
NotificationSchema.statics.findUserNotifications = function (
  userId: string,
  options?: { unread?: boolean; limit?: number }
) {
  const query: FilterQuery<INotification> = { userId };

  if (options?.unread !== undefined) {
    query.isRead = !options.unread;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options?.limit || 50);
};

NotificationSchema.statics.getUnreadCount = function (userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

NotificationSchema.statics.markAllAsRead = async function (userId: string) {
  const result = await this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return result;
};

NotificationSchema.statics.createNotification = async function (
  userId: string,
  notification: {
    type: 'new_content' | 'achievement' | 'reminder' | 'subscription' | 'system';
    title: string;
    message: string;
    icon?: string;
    imageUrl?: string;
    data?: Record<string, unknown>;
  }
) {
  return this.create({
    userId,
    ...notification,
  });
};

NotificationSchema.statics.deleteOldNotifications = async function (
  days = 30
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await this.deleteMany({
    isRead: true,
    readAt: { $lte: cutoffDate },
  });

  return result;
};

// Create and export the Notification model
export const Notification = model<INotification, INotificationModel>(
  'Notification',
  NotificationSchema
);

export default Notification;
