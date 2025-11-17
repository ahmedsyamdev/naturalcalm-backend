import logger from './logger';

// Import all models
import User from '../models/User.model';
import Category from '../models/Category.model';
import Track from '../models/Track.model';
import Program from '../models/Program.model';
import UserFavorite from '../models/UserFavorite.model';
import UserProgram from '../models/UserProgram.model';
import CustomProgram from '../models/CustomProgram.model';
import ListeningSession from '../models/ListeningSession.model';
import Subscription from '../models/Subscription.model';
import Package from '../models/Package.model';
import Payment from '../models/Payment.model';
import Coupon from '../models/Coupon.model';
import Notification from '../models/Notification.model';

/**
 * Create all database indexes
 * This should be called after the database connection is established
 */
export const createIndexes = async (): Promise<void> => {
  try {
    logger.info('Creating database indexes...');

    const models = [
      { name: 'User', model: User },
      { name: 'Category', model: Category },
      { name: 'Track', model: Track },
      { name: 'Program', model: Program },
      { name: 'UserFavorite', model: UserFavorite },
      { name: 'UserProgram', model: UserProgram },
      { name: 'CustomProgram', model: CustomProgram },
      { name: 'ListeningSession', model: ListeningSession },
      { name: 'Subscription', model: Subscription },
      { name: 'Package', model: Package },
      { name: 'Payment', model: Payment },
      { name: 'Coupon', model: Coupon },
      { name: 'Notification', model: Notification },
    ];

    // Create indexes for all models
    const results = await Promise.allSettled(
      models.map(async ({ name, model }) => {
        try {
          await model.createIndexes();
          logger.info(`✅ Indexes created for ${name} model`);
          return { name, success: true };
        } catch (error) {
          logger.error(`❌ Failed to create indexes for ${name} model:`, error);
          return { name, success: false, error };
        }
      })
    );

    // Log summary
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;

    if (failed === 0) {
      logger.info(`✅ All indexes created successfully (${successful}/${results.length})`);
    } else {
      logger.warn(
        `⚠️  Index creation completed with ${failed} failures (${successful}/${results.length} successful)`
      );
    }
  } catch (error) {
    logger.error('❌ Error creating database indexes:', error);
    throw error;
  }
};

/**
 * Drop all indexes (useful for development/testing)
 * Use with caution!
 */
export const dropIndexes = async (): Promise<void> => {
  try {
    logger.warn('Dropping all database indexes...');

    const models = [
      User,
      Category,
      Track,
      Program,
      UserFavorite,
      UserProgram,
      CustomProgram,
      ListeningSession,
      Subscription,
      Package,
      Payment,
      Coupon,
      Notification,
    ];

    await Promise.all(
      models.map(async (model) => {
        try {
          await model.collection.dropIndexes();
        } catch {
          // Ignore errors if collection doesn't exist
        }
      })
    );

    logger.info('✅ All indexes dropped');
  } catch (error) {
    logger.error('❌ Error dropping indexes:', error);
    throw error;
  }
};

/**
 * Rebuild all indexes (drop and recreate)
 */
export const rebuildIndexes = async (): Promise<void> => {
  try {
    logger.info('Rebuilding all database indexes...');
    await dropIndexes();
    await createIndexes();
    logger.info('✅ All indexes rebuilt successfully');
  } catch (error) {
    logger.error('❌ Error rebuilding indexes:', error);
    throw error;
  }
};

export default {
  createIndexes,
  dropIndexes,
  rebuildIndexes,
};
