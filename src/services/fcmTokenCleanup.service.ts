import { User } from '../models/User.model';
import logger from '../utils/logger';
import { sendFCMNotification } from '../config/firebase';

/**
 * Cleanup statistics interface
 */
export interface CleanupStats {
  totalUsersChecked: number;
  totalTokensFound: number;
  tokensRemoved: number;
  tokensKept: number;
  errors: number;
}

/**
 * Remove FCM tokens that haven't been used in the specified number of days
 * @param daysInactive - Number of days of inactivity before removing token (default: 90)
 * @param testTokens - Whether to test tokens with Firebase (default: false)
 */
export const cleanupInactiveFCMTokens = async (
  daysInactive: number = 90,
  testTokens: boolean = false
): Promise<CleanupStats> => {
  const stats: CleanupStats = {
    totalUsersChecked: 0,
    totalTokensFound: 0,
    tokensRemoved: 0,
    tokensKept: 0,
    errors: 0,
  };

  try {
    // Find all users with FCM tokens
    const users = await User.find({
      fcmTokens: { $exists: true, $ne: [] },
      deletedAt: null,
    }).select('fcmTokens');

    stats.totalUsersChecked = users.length;
    logger.info(`Starting FCM token cleanup for ${users.length} users`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    for (const user of users) {
      try {
        const originalTokenCount = user.fcmTokens.length;
        stats.totalTokensFound += originalTokenCount;

        // Filter tokens based on last used date
        const validTokens = [];

        for (const device of user.fcmTokens) {
          const shouldKeep = device.lastUsedAt > cutoffDate;

          // Optionally test token with Firebase
          if (shouldKeep && testTokens) {
            try {
              // Try to send a dry run message to test if token is valid
              await sendFCMNotification(
                device.token,
                {
                  title: 'Test',
                  body: 'Test notification',
                },
                {},
                true // dry run
              );
              validTokens.push(device);
              stats.tokensKept++;
            } catch (error) {
              // Token is invalid, don't add to validTokens
              stats.tokensRemoved++;
              logger.info(`Removed invalid FCM token for user ${user._id}:`, {
                token: device.token.substring(0, 20) + '...',
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          } else if (shouldKeep) {
            validTokens.push(device);
            stats.tokensKept++;
          } else {
            stats.tokensRemoved++;
            logger.info(`Removed inactive FCM token for user ${user._id}:`, {
              token: device.token.substring(0, 20) + '...',
              lastUsedAt: device.lastUsedAt,
            });
          }
        }

        // Update user if tokens were removed
        if (validTokens.length !== originalTokenCount) {
          user.fcmTokens = validTokens;
          await user.save();
        }
      } catch (error) {
        stats.errors++;
        logger.error(`Error cleaning up tokens for user ${user._id}:`, error);
      }
    }

    logger.info('FCM token cleanup completed:', stats);
    return stats;
  } catch (error) {
    logger.error('FCM token cleanup failed:', error);
    throw error;
  }
};

/**
 * Remove a specific invalid FCM token for a user
 * @param userId - User ID
 * @param fcmToken - FCM token to remove
 */
export const removeInvalidFCMToken = async (
  userId: string,
  fcmToken: string
): Promise<boolean> => {
  try {
    const user = await User.findById(userId);

    if (!user || user.deletedAt) {
      logger.warn('User not found for FCM token removal:', userId);
      return false;
    }

    const originalLength = user.fcmTokens.length;
    user.fcmTokens = user.fcmTokens.filter((device) => device.token !== fcmToken);

    if (user.fcmTokens.length < originalLength) {
      await user.save();
      logger.info('Invalid FCM token removed:', {
        userId,
        token: fcmToken.substring(0, 20) + '...',
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error removing invalid FCM token:', error);
    return false;
  }
};

/**
 * Get FCM token statistics
 */
export const getFCMTokenStats = async (): Promise<{
  totalUsers: number;
  usersWithTokens: number;
  totalTokens: number;
  averageTokensPerUser: number;
}> => {
  try {
    const totalUsers = await User.countDocuments({ deletedAt: null });
    const usersWithTokens = await User.countDocuments({
      fcmTokens: { $exists: true, $ne: [] },
      deletedAt: null,
    });

    const result = await User.aggregate([
      { $match: { fcmTokens: { $exists: true, $ne: [] }, deletedAt: null } },
      { $project: { tokenCount: { $size: '$fcmTokens' } } },
      { $group: { _id: null, totalTokens: { $sum: '$tokenCount' } } },
    ]);

    const totalTokens = result[0]?.totalTokens || 0;
    const averageTokensPerUser = usersWithTokens > 0 ? totalTokens / usersWithTokens : 0;

    return {
      totalUsers,
      usersWithTokens,
      totalTokens,
      averageTokensPerUser: Math.round(averageTokensPerUser * 100) / 100,
    };
  } catch (error) {
    logger.error('Error getting FCM token stats:', error);
    throw error;
  }
};
