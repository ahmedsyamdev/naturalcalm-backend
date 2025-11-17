import cron from 'node-cron';
import { cleanupAbandonedSessions } from '../utils/listeningStats';
import logger from '../utils/logger';

/**
 * Schedule cleanup job for abandoned listening sessions
 * Runs every hour to clean up sessions that have been open for more than 24 hours
 */
export const scheduleSessionCleanup = (): void => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Starting scheduled session cleanup job...');
      const cleanedCount = await cleanupAbandonedSessions(24);
      logger.info(`Session cleanup completed. Cleaned up ${cleanedCount} abandoned sessions.`);
    } catch (error) {
      logger.error('Error in scheduled session cleanup job:', error);
    }
  });

  logger.info('Session cleanup job scheduled (runs hourly)');
};

/**
 * Manual cleanup function that can be called on-demand
 * @param hoursThreshold - Hours after which a session is considered abandoned
 */
export const runManualCleanup = async (hoursThreshold: number = 24): Promise<number> => {
  try {
    logger.info(`Running manual session cleanup (threshold: ${hoursThreshold} hours)...`);
    const cleanedCount = await cleanupAbandonedSessions(hoursThreshold);
    logger.info(`Manual cleanup completed. Cleaned up ${cleanedCount} abandoned sessions.`);
    return cleanedCount;
  } catch (error) {
    logger.error('Error in manual session cleanup:', error);
    return 0;
  }
};
