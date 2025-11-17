import cron from 'node-cron';
import { Notification } from '../models/Notification.model';
import logger from '../utils/logger';

/**
 * Clean up old notifications
 * - Delete read notifications older than 30 days
 * - Delete unread notifications older than 90 days
 */
const cleanupOldNotifications = async (): Promise<{ readDeleted: number; unreadDeleted: number }> => {
  const now = new Date();

  const readCutoffDate = new Date(now);
  readCutoffDate.setDate(readCutoffDate.getDate() - 30);

  const unreadCutoffDate = new Date(now);
  unreadCutoffDate.setDate(unreadCutoffDate.getDate() - 90);

  try {
    const readResult = await Notification.deleteMany({
      isRead: true,
      readAt: { $lte: readCutoffDate },
      deletedAt: null,
    });

    const unreadResult = await Notification.deleteMany({
      isRead: false,
      createdAt: { $lte: unreadCutoffDate },
      deletedAt: null,
    });

    logger.info(`Notification cleanup completed: ${readResult.deletedCount} read notifications deleted, ${unreadResult.deletedCount} unread notifications deleted`);

    return {
      readDeleted: readResult.deletedCount || 0,
      unreadDeleted: unreadResult.deletedCount || 0,
    };
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    return { readDeleted: 0, unreadDeleted: 0 };
  }
};

/**
 * Schedule job to clean up old notifications
 * Runs weekly on Sunday at 2:00 AM
 */
export const scheduleNotificationCleanup = (): void => {
  cron.schedule('0 2 * * 0', async () => {
    try {
      logger.info('Starting scheduled notification cleanup job...');
      const result = await cleanupOldNotifications();
      logger.info(`Notification cleanup completed. Total deleted: ${result.readDeleted + result.unreadDeleted} (${result.readDeleted} read, ${result.unreadDeleted} unread)`);
    } catch (error) {
      logger.error('Error in scheduled notification cleanup job:', error);
    }
  });

  logger.info('Notification cleanup job scheduled (runs weekly on Sundays at 2:00 AM)');
};

/**
 * Manual cleanup function
 */
export const runManualCleanup = async (): Promise<{ readDeleted: number; unreadDeleted: number }> => {
  try {
    logger.info('Running manual notification cleanup...');
    const result = await cleanupOldNotifications();
    logger.info(`Manual cleanup completed. Total deleted: ${result.readDeleted + result.unreadDeleted}`);
    return result;
  } catch (error) {
    logger.error('Error in manual notification cleanup:', error);
    return { readDeleted: 0, unreadDeleted: 0 };
  }
};
