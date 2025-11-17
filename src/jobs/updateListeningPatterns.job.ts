import cron from 'node-cron';
import { User } from '../models/User.model';
import { updateUserListeningPatterns } from '../utils/listeningStats';
import logger from '../utils/logger';

/**
 * Schedule job to update listening patterns for all users
 * Runs daily at 3 AM to update user preferences with latest listening patterns
 */
export const scheduleListeningPatternsUpdate = (): void => {
  // Run daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Starting scheduled listening patterns update job...');

      // Get all active users (not deleted)
      const users = await User.find({ deletedAt: null }).select('_id');

      let successCount = 0;
      let failCount = 0;

      // Update patterns for each user
      for (const user of users) {
        try {
          const userId = user._id?.toString() || '';
          if (!userId) continue;

          const success = await updateUserListeningPatterns(userId);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          logger.error(`Failed to update patterns for user ${user._id}:`, error);
          failCount++;
        }
      }

      logger.info(
        `Listening patterns update completed. Success: ${successCount}, Failed: ${failCount}`
      );
    } catch (error) {
      logger.error('Error in scheduled listening patterns update job:', error);
    }
  });

  logger.info('Listening patterns update job scheduled (runs daily at 3 AM)');
};

/**
 * Manual update function for all users
 */
export const runManualPatternsUpdate = async (): Promise<{
  success: number;
  failed: number;
}> => {
  try {
    logger.info('Running manual listening patterns update for all users...');

    const users = await User.find({ deletedAt: null }).select('_id');

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const userId = user._id?.toString() || '';
        if (!userId) continue;

        const success = await updateUserListeningPatterns(userId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        logger.error(`Failed to update patterns for user ${user._id}:`, error);
        failCount++;
      }
    }

    logger.info(
      `Manual patterns update completed. Success: ${successCount}, Failed: ${failCount}`
    );

    return { success: successCount, failed: failCount };
  } catch (error) {
    logger.error('Error in manual listening patterns update:', error);
    return { success: 0, failed: 0 };
  }
};
