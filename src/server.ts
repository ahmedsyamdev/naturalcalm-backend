import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { createIndexes } from './config/indexes';
import logger from './config/logger';
import { scheduleSessionCleanup } from './jobs/sessionCleanup.job';
import { scheduleListeningPatternsUpdate } from './jobs/updateListeningPatterns.job';
import { scheduleExpireSubscriptions } from './jobs/expireSubscriptions.job';
import {
  scheduleExpirationReminders,
  scheduleAutoRenewals,
} from './jobs/renewSubscriptions.job';
import { scheduleNotificationCleanup } from './jobs/notificationCleanup.job';
import { scheduleExpirationReminders as scheduleSubscriptionReminders } from './jobs/subscriptionReminders.job';
import { scheduleDailyMeditationReminders } from './jobs/dailyMeditationReminders.job';

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Create database indexes
    await createIndexes();

    // Connect to Redis (optional - don't fail if Redis is not available)
    try {
      await connectRedis();
    } catch (error) {
      logger.warn('⚠️  Redis connection failed. Caching will be disabled.');
      logger.warn('Redis error:', error);
    }

    // Schedule background jobs
    scheduleSessionCleanup();
    scheduleListeningPatternsUpdate();
    scheduleExpireSubscriptions();
    scheduleExpirationReminders();
    scheduleAutoRenewals();
    scheduleNotificationCleanup();
    scheduleSubscriptionReminders();
    scheduleDailyMeditationReminders();

    // Start Express server
    app.listen(env.PORT, () => {
      logger.info(
        `Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`
      );
      logger.info(`API available at http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err.message);
  process.exit(1);
});

// Start the server
startServer();
