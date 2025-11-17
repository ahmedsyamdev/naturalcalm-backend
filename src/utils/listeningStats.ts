import { ListeningSession } from '../models/ListeningSession.model';
import { User } from '../models/User.model';
import logger from './logger';

/**
 * Get total listening time for a user
 * @param userId - User ID
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @returns Total listening time in minutes
 */
export const getTotalListeningTime = async (
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> => {
  try {
    const query: Record<string, unknown> = { userId };

    // Add date range filter if provided
    if (startDate || endDate) {
      const timeQuery: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        timeQuery.$gte = startDate;
      }
      if (endDate) {
        timeQuery.$lte = endDate;
      }
      query.startTime = timeQuery;
    }

    // Aggregate total duration
    const result = await ListeningSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: '$durationSeconds' },
        },
      },
    ]);

    if (result.length === 0) {
      return 0;
    }

    // Convert seconds to minutes
    const totalMinutes = Math.round(result[0].totalSeconds / 60);
    return totalMinutes;
  } catch (error) {
    logger.error('Error calculating total listening time:', error);
    return 0;
  }
};

/**
 * Get listening statistics grouped by period
 * @param userId - User ID
 * @param period - Time period: 'week', 'month', or 'year'
 * @returns Array of statistics by date with minutes listened
 */
export const getListeningStatsByPeriod = async (
  userId: string,
  period: 'week' | 'month' | 'year' = 'week'
): Promise<Array<{ date: string; minutes: number; sessions: number }>> => {
  try {
    // Calculate start date based on period
    const startDate = new Date();
    let groupByFormat: string;

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        groupByFormat = '%Y-%m-%d';
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupByFormat = '%Y-%U'; // Year-Week format
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
    }

    // Aggregate listening sessions by date
    const stats = await ListeningSession.aggregate([
      {
        $match: {
          userId,
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat,
              date: '$startTime',
            },
          },
          totalSeconds: { $sum: '$durationSeconds' },
          sessionCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          minutes: { $round: [{ $divide: ['$totalSeconds', 60] }, 1] },
          sessions: '$sessionCount',
        },
      },
    ]);

    return stats;
  } catch (error) {
    logger.error('Error calculating listening stats by period:', error);
    return [];
  }
};

/**
 * Get popular tracks based on listening sessions
 * @param days - Number of days to look back (default: 7)
 * @param limit - Maximum number of tracks to return (default: 10)
 * @returns Array of track IDs with play counts
 */
export const getPopularTracks = async (
  days: number = 7,
  limit: number = 10
): Promise<Array<{ trackId: string; playCount: number; uniqueListeners: number }>> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const popularTracks = await ListeningSession.aggregate([
      {
        $match: {
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$trackId',
          playCount: { $sum: 1 },
          uniqueListeners: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          trackId: '$_id',
          playCount: 1,
          uniqueListeners: { $size: '$uniqueListeners' },
        },
      },
      {
        $sort: { playCount: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    return popularTracks;
  } catch (error) {
    logger.error('Error getting popular tracks:', error);
    return [];
  }
};

/**
 * Get user listening patterns
 * @param userId - User ID
 * @returns Object containing listening patterns and preferences
 */
export const getUserListeningPatterns = async (
  userId: string
): Promise<{
  favoriteCategories: Array<{ category: string; count: number }>;
  peakListeningHours: Array<{ hour: number; count: number }>;
  averageSessionDuration: number;
  completionRate: number;
}> => {
  try {
    // Get sessions from last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const sessions = await ListeningSession.find({
      userId,
      startTime: { $gte: startDate },
    }).populate('trackId', 'category');

    if (sessions.length === 0) {
      return {
        favoriteCategories: [],
        peakListeningHours: [],
        averageSessionDuration: 0,
        completionRate: 0,
      };
    }

    // Calculate favorite categories
    const categoryCount: Record<string, number> = {};
    for (const session of sessions) {
      const track = session.trackId as unknown;
      const trackObj = track as { category?: { toString(): string } };

      if (trackObj && trackObj.category) {
        const categoryId = trackObj.category.toString();
        categoryCount[categoryId] = (categoryCount[categoryId] || 0) + 1;
      }
    }

    const favoriteCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate peak listening hours
    const hourCount: Record<number, number> = {};
    for (const session of sessions) {
      const hour = new Date(session.startTime).getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }

    const peakListeningHours = Object.entries(hourCount)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Calculate average session duration (in minutes)
    const totalDuration = sessions.reduce(
      (sum, session) => sum + session.durationSeconds,
      0
    );
    const averageSessionDuration = Math.round(totalDuration / sessions.length / 60);

    // Calculate completion rate
    const completedSessions = sessions.filter(session => session.completed).length;
    const completionRate = Math.round((completedSessions / sessions.length) * 100);

    return {
      favoriteCategories,
      peakListeningHours,
      averageSessionDuration,
      completionRate,
    };
  } catch (error) {
    logger.error('Error analyzing user listening patterns:', error);
    return {
      favoriteCategories: [],
      peakListeningHours: [],
      averageSessionDuration: 0,
      completionRate: 0,
    };
  }
};

/**
 * Clean up abandoned listening sessions
 * Should be run periodically (e.g., daily or hourly)
 * @param hoursThreshold - Hours after which a session is considered abandoned (default: 24)
 * @returns Number of sessions cleaned up
 */
export const cleanupAbandonedSessions = async (
  hoursThreshold: number = 24
): Promise<number> => {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursThreshold);

    // Find sessions that are still open (no endTime) and started more than threshold hours ago
    const abandonedSessions = await ListeningSession.find({
      endTime: null,
      startTime: { $lt: cutoffTime },
    });

    if (abandonedSessions.length === 0) {
      return 0;
    }

    // Auto-end these sessions
    const now = new Date();
    for (const session of abandonedSessions) {
      session.endTime = now;
      session.completed = false;

      // Calculate duration based on lastPosition if available, otherwise use time difference
      if (session.lastPosition > 0) {
        session.durationSeconds = session.lastPosition;
      } else {
        const startTime = new Date(session.startTime);
        session.durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      }

      await session.save();
    }

    logger.info(`Cleaned up ${abandonedSessions.length} abandoned listening sessions`);
    return abandonedSessions.length;
  } catch (error) {
    logger.error('Error cleaning up abandoned sessions:', error);
    return 0;
  }
};

/**
 * Update user preferences with listening patterns
 * Should be called periodically or when patterns are fetched
 * @param userId - User ID
 * @returns Success boolean
 */
export const updateUserListeningPatterns = async (
  userId: string
): Promise<boolean> => {
  try {
    // Get listening patterns
    const patterns = await getUserListeningPatterns(userId);

    // Update user preferences
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ${userId} not found for patterns update`);
      return false;
    }

    // Initialize preferences if not exists
    if (!user.preferences) {
      user.preferences = {
        notifications: {
          newContent: true,
          achievements: true,
          reminders: true,
          subscription: true,
        },
        reminderTime: 8,
        enableDailyReminder: true,
      };
    }

    // Update listening patterns in preferences
    user.preferences.listeningPatterns = {
      favoriteCategories: patterns.favoriteCategories,
      peakListeningHours: patterns.peakListeningHours,
      averageSessionDuration: patterns.averageSessionDuration,
      completionRate: patterns.completionRate,
      lastUpdated: new Date(),
    };

    await user.save();

    logger.info(`Updated listening patterns for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error updating user listening patterns:', error);
    return false;
  }
};
