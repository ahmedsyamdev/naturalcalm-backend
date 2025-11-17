import cron from 'node-cron';
import { Subscription } from '../models/Subscription.model';
import { User, IUser } from '../models/User.model';
import { Notification } from '../models/Notification.model';
import { Package, IPackage } from '../models/Package.model';
import logger from '../utils/logger';

/**
 * Send expiration reminder notifications
 */
const sendExpirationReminders = async (daysThreshold: number = 7): Promise<number> => {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const expiringSubscriptions = await Subscription.find({
    status: 'active',
    endDate: { $gt: now, $lte: futureDate },
  }).populate('userId packageId');

  let reminderCount = 0;

  for (const subscription of expiringSubscriptions) {
    try {
      const userId = (subscription.userId as unknown as IUser)?._id || subscription.userId;
      const pkg = subscription.packageId as unknown as IPackage;
      const daysRemaining = Math.ceil(
        (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await Notification.create({
        userId,
        type: 'subscription',
        title: 'تذكير بانتهاء الاشتراك',
        message: `سينتهي اشتراكك في ${pkg?.name || 'الباقة'} بعد ${daysRemaining} يوم. قم بالتجديد للاستمرار في الوصول.`,
        icon: '⏰',
        data: {
          subscriptionId: subscription._id,
          endDate: subscription.endDate,
          daysRemaining,
          autoRenew: subscription.autoRenew,
        },
      });

      reminderCount++;
      logger.info(
        `Sent expiration reminder for subscription ${subscription._id} (${daysRemaining} days remaining)`
      );
    } catch (error) {
      logger.error(`Error sending reminder for subscription ${subscription._id}:`, error);
    }
  }

  return reminderCount;
};

/**
 * Process auto-renewal for subscriptions
 */
const processAutoRenewals = async (): Promise<{
  renewed: number;
  failed: number;
}> => {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const subscriptionsToRenew = await Subscription.find({
    status: 'active',
    autoRenew: true,
    endDate: { $gte: now, $lte: tomorrow },
  }).populate('userId packageId');

  let renewedCount = 0;
  let failedCount = 0;

  for (const subscription of subscriptionsToRenew) {
    try {
      const userId = (subscription.userId as unknown as IUser)?._id || subscription.userId;
      const pkg = (subscription.packageId as unknown as IPackage) || (await Package.findById(subscription.packageId));

      if (!pkg) {
        logger.error(`Package not found for subscription ${subscription._id}`);
        failedCount++;
        continue;
      }

      const newEndDate = new Date(subscription.endDate);
      if (pkg.periodType === 'month') {
        newEndDate.setMonth(newEndDate.getMonth() + pkg.periodCount);
      } else if (pkg.periodType === 'year') {
        newEndDate.setFullYear(newEndDate.getFullYear() + pkg.periodCount);
      }

      subscription.endDate = newEndDate;
      subscription.status = 'active';
      await subscription.save();

      await User.findByIdAndUpdate(userId, {
        'subscription.endDate': newEndDate,
        'subscription.status': 'active',
      });

      await Notification.create({
        userId,
        type: 'subscription',
        title: 'تم تجديد الاشتراك',
        message: `تم تجديد اشتراكك في ${pkg.name} تلقائياً حتى ${newEndDate.toLocaleDateString('ar-SA')}`,
        icon: '✅',
        data: {
          subscriptionId: subscription._id,
          packageId: pkg._id,
          newEndDate,
        },
      });

      renewedCount++;
      logger.info(`Auto-renewed subscription ${subscription._id} for user ${userId}`);
    } catch (error) {
      logger.error(`Error auto-renewing subscription ${subscription._id}:`, error);
      failedCount++;

      try {
        const userId = (subscription.userId as unknown as IUser)?._id || subscription.userId;
        await Notification.create({
          userId,
          type: 'subscription',
          title: 'فشل التجديد التلقائي',
          message: 'حدث خطأ أثناء تجديد اشتراكك تلقائياً. يرجى التجديد يدوياً.',
          icon: '❌',
          data: {
            subscriptionId: subscription._id,
            error: 'auto_renewal_failed',
          },
        });
      } catch (notifError) {
        logger.error('Error sending renewal failure notification:', notifError);
      }
    }
  }

  return { renewed: renewedCount, failed: failedCount };
};

/**
 * Schedule job to send expiration reminders
 * Runs daily at 9 AM
 */
export const scheduleExpirationReminders = (): void => {
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Starting scheduled expiration reminder job...');
      const reminderCount = await sendExpirationReminders(7);
      logger.info(`Expiration reminders sent. Count: ${reminderCount}`);
    } catch (error) {
      logger.error('Error in scheduled expiration reminder job:', error);
    }
  });

  logger.info('Expiration reminder job scheduled (runs daily at 9 AM)');
};

/**
 * Schedule job to process auto-renewals
 * Runs daily at 1 AM
 */
export const scheduleAutoRenewals = (): void => {
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('Starting scheduled auto-renewal job...');
      const result = await processAutoRenewals();
      logger.info(
        `Auto-renewal completed. Renewed: ${result.renewed}, Failed: ${result.failed}`
      );
    } catch (error) {
      logger.error('Error in scheduled auto-renewal job:', error);
    }
  });

  logger.info('Auto-renewal job scheduled (runs daily at 1 AM)');
};

/**
 * Manual reminder function
 */
export const runManualReminders = async (daysThreshold: number = 7): Promise<number> => {
  try {
    logger.info(`Running manual expiration reminders (${daysThreshold} days)...`);
    const reminderCount = await sendExpirationReminders(daysThreshold);
    logger.info(`Manual reminders sent. Count: ${reminderCount}`);
    return reminderCount;
  } catch (error) {
    logger.error('Error in manual expiration reminders:', error);
    return 0;
  }
};

/**
 * Manual auto-renewal function
 */
export const runManualAutoRenewals = async (): Promise<{
  renewed: number;
  failed: number;
}> => {
  try {
    logger.info('Running manual auto-renewals...');
    const result = await processAutoRenewals();
    logger.info(`Manual auto-renewals completed. Renewed: ${result.renewed}, Failed: ${result.failed}`);
    return result;
  } catch (error) {
    logger.error('Error in manual auto-renewals:', error);
    return { renewed: 0, failed: 0 };
  }
};
