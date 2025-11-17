import { Notification } from '../models/Notification.model';
import { User } from '../models/User.model';
import logger from '../utils/logger';
import { getRedisClient } from '../config/redis';
import { sendFCMNotification, sendMulticastFCMNotification } from '../config/firebase';
import { removeInvalidFCMToken } from './fcmTokenCleanup.service';

/**
 * Notification type enum
 */
export type NotificationType = 'new_content' | 'achievement' | 'reminder' | 'subscription' | 'system';

/**
 * Notification data interface
 */
export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  notificationData: NotificationData,
  sendPush: boolean = true
): Promise<void> => {
  try {
    const user = await User.findById(userId).select('preferences.notifications fcmTokens');

    if (!user || user.deletedAt) {
      logger.warn('User not found for notification:', userId);
      return;
    }

    const preferences = user.preferences?.notifications;

    const shouldSend = checkNotificationPreferences(notificationData.type, preferences);

    if (!shouldSend) {
      logger.info('Notification skipped due to user preferences:', {
        userId,
        type: notificationData.type,
      });
      return;
    }

    // Create in-app notification
    await Notification.create({
      userId,
      ...notificationData,
    });

    // Clear unread count cache
    const cacheKey = `notification:unread:${userId}`;
    try {
      const redisClient = getRedisClient();
      await redisClient.del(cacheKey);
    } catch (redisError) {
      logger.warn('Redis delete error:', redisError);
    }

    logger.info('Notification created successfully:', {
      userId,
      type: notificationData.type,
      title: notificationData.title,
    });

    // Send push notification if enabled and user has FCM tokens
    if (sendPush && user.fcmTokens && user.fcmTokens.length > 0) {
      await sendPushNotification(
        userId,
        notificationData.title,
        notificationData.message,
        notificationData.imageUrl,
        notificationData.data
      );
    }
  } catch (error) {
    logger.error('Create notification error:', error);
  }
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (
  userIds: string[],
  notificationData: NotificationData,
  sendPush: boolean = true
): Promise<number> => {
  try {
    const users = await User.find({
      _id: { $in: userIds },
      deletedAt: null
    }).select('_id preferences.notifications fcmTokens');

    const filteredUserIds = users
      .filter(user => {
        const preferences = user.preferences?.notifications;
        return checkNotificationPreferences(notificationData.type, preferences);
      })
      .map(user => user._id.toString());

    if (filteredUserIds.length === 0) {
      logger.info('No users to send notifications to');
      return 0;
    }

    // Create in-app notifications
    const notifications = filteredUserIds.map(userId => ({
      userId,
      ...notificationData,
    }));

    const result = await Notification.insertMany(notifications);

    // Clear unread count cache for all users
    const redisClient = getRedisClient();
    for (const userId of filteredUserIds) {
      const cacheKey = `notification:unread:${userId}`;
      try {
        await redisClient.del(cacheKey);
      } catch (redisError) {
        logger.warn('Redis delete error for user:', userId, redisError);
      }
    }

    logger.info('Bulk notifications created:', {
      count: result.length,
      type: notificationData.type,
    });

    // Send push notifications if enabled
    if (sendPush) {
      // Collect all FCM tokens from users
      const allTokens: string[] = [];
      users.forEach(user => {
        if (user.fcmTokens && user.fcmTokens.length > 0) {
          const tokens = user.fcmTokens.map(device => device.token);
          allTokens.push(...tokens);
        }
      });

      if (allTokens.length > 0) {
        logger.info(`Sending push notifications to ${allTokens.length} tokens`);

        // Convert data to Record<string, string> as required by FCM
        const fcmData: Record<string, string> = {};
        if (notificationData.data) {
          Object.keys(notificationData.data).forEach((key) => {
            const value = notificationData.data![key];
            fcmData[key] = typeof value === 'string' ? value : JSON.stringify(value);
          });
        }

        // Send to all tokens using multicast (Firebase can handle up to 500 tokens per call)
        // For large batches, we'll split into chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < allTokens.length; i += chunkSize) {
          const tokenChunk = allTokens.slice(i, i + chunkSize);
          try {
            await sendMulticastFCMNotification(
              tokenChunk,
              {
                title: notificationData.title,
                body: notificationData.message,
                imageUrl: notificationData.imageUrl,
              },
              fcmData
            );
          } catch (error) {
            logger.error(`Error sending push notifications to chunk ${i / chunkSize + 1}:`, error);
          }
        }
      }
    }

    return result.length;
  } catch (error) {
    logger.error('Create bulk notifications error:', error);
    return 0;
  }
};

/**
 * Check if notification should be sent based on user preferences
 */
const checkNotificationPreferences = (
  type: NotificationType,
  preferences?: {
    newContent?: boolean;
    achievements?: boolean;
    reminders?: boolean;
    subscription?: boolean;
  }
): boolean => {
  if (!preferences) return true;

  switch (type) {
    case 'new_content':
      return preferences.newContent !== false;
    case 'achievement':
      return preferences.achievements !== false;
    case 'reminder':
      return preferences.reminders !== false;
    case 'subscription':
      return preferences.subscription !== false;
    case 'system':
      return true;
    default:
      return true;
  }
};

/**
 * Send push notification via FCM to all user's devices
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  message: string,
  imageUrl?: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> => {
  try {
    const user = await User.findById(userId).select('fcmTokens');

    if (!user || user.deletedAt || !user.fcmTokens || user.fcmTokens.length === 0) {
      logger.debug('No FCM tokens found for user:', userId);
      return { sent: 0, failed: 0 };
    }

    const tokens = user.fcmTokens.map((device) => device.token);

    // Convert data to Record<string, string> as required by FCM
    const fcmData: Record<string, string> = {};
    if (data) {
      Object.keys(data).forEach((key) => {
        fcmData[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
      });
    }

    // Send to all tokens using multicast
    const result = await sendMulticastFCMNotification(
      tokens,
      {
        title,
        body: message,
        imageUrl,
      },
      fcmData
    );

    // If there were failures, attempt to clean up invalid tokens
    if (result.failureCount > 0) {
      logger.warn(`Some FCM tokens failed for user ${userId}. Cleanup may be needed.`);
    }

    logger.info(`Push notification sent to user ${userId}:`, {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalTokens: tokens.length,
    });

    return { sent: result.successCount, failed: result.failureCount };
  } catch (error) {
    logger.error('Send push notification error:', error);
    return { sent: 0, failed: 0 };
  }
};

/**
 * Send email notification (placeholder for future implementation)
 */
export const sendEmailNotification = async (
  userId: string,
  subject: string,
  body: string
): Promise<void> => {
  logger.info('Email notification placeholder (not yet implemented):', {
    userId,
    subject,
    body,
  });
};
