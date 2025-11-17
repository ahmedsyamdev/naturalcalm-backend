import cron from 'node-cron';
import { Subscription } from '../models/Subscription.model';
import { IUser } from '../models/User.model';
import logger from '../utils/logger';
import { createNotification } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * Send reminders to users whose subscriptions are expiring soon
 * Sends reminder 7 days before expiration
 */
const sendExpirationReminders = async (): Promise<number> => {
  const now = new Date();

  const reminderDate = new Date(now);
  reminderDate.setDate(reminderDate.getDate() + 7);

  const reminderDateEnd = new Date(reminderDate);
  reminderDateEnd.setHours(23, 59, 59, 999);

  const reminderDateStart = new Date(reminderDate);
  reminderDateStart.setHours(0, 0, 0, 0);

  try {
    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      endDate: {
        $gte: reminderDateStart,
        $lte: reminderDateEnd,
      },
    }).populate('userId packageId');

    let reminderCount = 0;

    for (const subscription of expiringSubscriptions) {
      try {
        const userId = (subscription.userId as unknown as IUser)?._id || subscription.userId;

        const daysRemaining = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const notificationData = getNotificationTemplate(
          NOTIFICATION_TEMPLATES.SUBSCRIPTION_EXPIRING,
          {
            days: daysRemaining,
          }
        );

        if (notificationData) {
          notificationData.data = {
            subscriptionId: String(subscription._id),
            endDate: subscription.endDate,
            daysRemaining,
          };
          await createNotification(String(userId), notificationData);
        }

        reminderCount++;
        logger.info(`Sent expiration reminder for subscription ${subscription._id} to user ${userId}`);
      } catch (error) {
        logger.error(`Error sending reminder for subscription ${subscription._id}:`, error);
      }
    }

    return reminderCount;
  } catch (error) {
    logger.error('Error sending expiration reminders:', error);
    return 0;
  }
};

/**
 * Schedule job to send subscription expiration reminders
 * Runs daily at 9:00 AM
 */
export const scheduleExpirationReminders = (): void => {
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Starting scheduled subscription expiration reminders job...');
      const reminderCount = await sendExpirationReminders();
      logger.info(`Subscription expiration reminders completed. Sent ${reminderCount} reminders.`);
    } catch (error) {
      logger.error('Error in scheduled subscription expiration reminders job:', error);
    }
  });

  logger.info('Subscription expiration reminders job scheduled (runs daily at 9:00 AM)');
};

/**
 * Manual reminder function
 */
export const runManualReminders = async (): Promise<number> => {
  try {
    logger.info('Running manual subscription expiration reminders...');
    const reminderCount = await sendExpirationReminders();
    logger.info(`Manual reminders completed. Sent ${reminderCount} reminders.`);
    return reminderCount;
  } catch (error) {
    logger.error('Error in manual subscription expiration reminders:', error);
    return 0;
  }
};
