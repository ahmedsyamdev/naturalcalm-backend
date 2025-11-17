import cron from 'node-cron';
import { User } from '../models/User.model';
import logger from '../utils/logger';
import { createNotification } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * Send daily meditation reminders to users at their preferred time
 * Checks users who have enabled daily reminders and whose reminderTime matches current hour
 */
const sendDailyMeditationReminders = async (): Promise<number> => {
  try {
    const currentHour = new Date().getHours();

    // Find users who want reminders at this hour
    const users = await User.find({
      'preferences.enableDailyReminder': true,
      'preferences.reminderTime': currentHour,
      deletedAt: null,
    }).select('_id name preferences');

    let reminderCount = 0;

    for (const user of users) {
      try {
        const notificationData = getNotificationTemplate(NOTIFICATION_TEMPLATES.DAILY_REMINDER);

        if (notificationData) {
          // Add deep link to home page
          notificationData.data = {
            ...notificationData.data,
            action: 'start_meditation',
            deepLink: '/home',
            reminderTime: currentHour,
          };

          await createNotification(String(user._id), notificationData, true);
          reminderCount++;

          logger.debug(`Sent daily meditation reminder to user ${user._id} at hour ${currentHour}`);
        }
      } catch (error) {
        logger.error(`Error sending daily reminder to user ${user._id}:`, error);
      }
    }

    if (reminderCount > 0) {
      logger.info(`Daily meditation reminders sent: ${reminderCount} users at hour ${currentHour}`);
    }

    return reminderCount;
  } catch (error) {
    logger.error('Error sending daily meditation reminders:', error);
    return 0;
  }
};

/**
 * Schedule job to send daily meditation reminders
 * Runs every hour at the start of the hour (00 minutes)
 * This allows us to send reminders at users' preferred times (0-23 hours)
 */
export const scheduleDailyMeditationReminders = (): void => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      const reminderCount = await sendDailyMeditationReminders();
      if (reminderCount > 0) {
        logger.info(`Daily meditation reminders job completed. Sent ${reminderCount} reminders.`);
      }
    } catch (error) {
      logger.error('Error in scheduled daily meditation reminders job:', error);
    }
  });

  logger.info('Daily meditation reminders job scheduled (runs every hour)');
};

/**
 * Manual reminder function for testing
 */
export const runManualDailyReminders = async (): Promise<number> => {
  try {
    logger.info('Running manual daily meditation reminders...');
    const reminderCount = await sendDailyMeditationReminders();
    logger.info(`Manual daily reminders completed. Sent ${reminderCount} reminders.`);
    return reminderCount;
  } catch (error) {
    logger.error('Error in manual daily meditation reminders:', error);
    return 0;
  }
};
