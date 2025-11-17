import cron from 'node-cron';
import { Subscription } from '../models/Subscription.model';
import { User, IUser } from '../models/User.model';
import logger from '../utils/logger';
import { createNotification } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * Expire subscriptions that have passed their end date
 */
const expireSubscriptions = async (): Promise<number> => {
  const now = new Date();

  const expiredSubscriptions = await Subscription.find({
    status: 'active',
    endDate: { $lte: now },
  }).populate('userId packageId');

  let expiredCount = 0;

  for (const subscription of expiredSubscriptions) {
    try {
      subscription.status = 'expired';
      await subscription.save();

      const userId = (subscription.userId as unknown as IUser)?._id || subscription.userId;

      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'expired',
      });

      const notificationData = getNotificationTemplate(
        NOTIFICATION_TEMPLATES.SUBSCRIPTION_EXPIRED,
        {}
      );

      if (notificationData) {
        notificationData.data = {
          subscriptionId: String(subscription._id),
          endDate: subscription.endDate,
        };
        await createNotification(String(userId), notificationData);
      }

      expiredCount++;
      logger.info(`Subscription ${subscription._id} expired for user ${userId}`);
    } catch (error) {
      logger.error(`Error expiring subscription ${subscription._id}:`, error);
    }
  }

  return expiredCount;
};

/**
 * Schedule job to expire subscriptions
 * Runs daily at midnight (00:00)
 */
export const scheduleExpireSubscriptions = (): void => {
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Starting scheduled subscription expiration job...');
      const expiredCount = await expireSubscriptions();
      logger.info(`Subscription expiration completed. Expired ${expiredCount} subscriptions.`);
    } catch (error) {
      logger.error('Error in scheduled subscription expiration job:', error);
    }
  });

  logger.info('Subscription expiration job scheduled (runs daily at midnight)');
};

/**
 * Manual expiration function
 */
export const runManualExpiration = async (): Promise<number> => {
  try {
    logger.info('Running manual subscription expiration...');
    const expiredCount = await expireSubscriptions();
    logger.info(`Manual expiration completed. Expired ${expiredCount} subscriptions.`);
    return expiredCount;
  } catch (error) {
    logger.error('Error in manual subscription expiration:', error);
    return 0;
  }
};
