import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ListeningSession } from '../models/ListeningSession.model';
import { UserProgram } from '../models/UserProgram.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import cache from '../utils/cache';

/**
 * @desc    Get user statistics (total minutes, tracks, programs)
 * @route   GET /api/v1/users/stats
 * @access  Private
 */
export const getUserStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_stats_${userId}`;
    const cached = cache.get<{
      totalMinutes: number;
      totalTracks: number;
      totalPrograms: number;
      completedPrograms: number;
    }>(cacheKey);

    if (cached) {
      successResponse(res, cached, 'User statistics retrieved successfully');
      return;
    }

    const sessions = await ListeningSession.find({
      userId,
      deletedAt: null,
    });

    const totalMinutes = Math.round(
      sessions.reduce((sum, s) => sum + s.durationSeconds / 60, 0)
    );

    const uniqueTrackIds = new Set(sessions.map((s) => s.trackId.toString()));
    const totalTracks = uniqueTrackIds.size;

    const uniqueProgramIds = new Set(
      sessions
        .filter((s) => s.programId)
        .map((s) => s.programId!.toString())
    );
    const totalPrograms = uniqueProgramIds.size;

    const completedPrograms = await UserProgram.countDocuments({
      userId,
      isCompleted: true,
      deletedAt: null,
    });

    const stats = {
      totalMinutes,
      totalTracks,
      totalPrograms,
      completedPrograms,
    };

    cache.set(cacheKey, stats, 3600);

    successResponse(res, stats, 'User statistics retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get user stats error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get user statistics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get weekly statistics
 * @route   GET /api/v1/users/stats/weekly
 * @access  Private
 */
export const getWeeklyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { period = 'month' } = req.query;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    if (!['week', 'month', 'year'].includes(period as string)) {
      errorResponse(res, 'Invalid period. Must be week, month, or year', 400);
      return;
    }

    const cacheKey = `user_weekly_stats_${userId}_${period}`;
    const cached = cache.get<Array<{ week: string; minutes: number }>>(
      cacheKey
    );

    if (cached) {
      successResponse(
        res,
        cached,
        'Weekly statistics retrieved successfully'
      );
      return;
    }

    let daysBack = 30;
    if (period === 'week') daysBack = 7;
    if (period === 'year') daysBack = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const sessions = await ListeningSession.find({
      userId,
      startTime: { $gte: startDate },
      deletedAt: null,
    }).sort({ startTime: 1 });

    const weeklyData: { [key: string]: number } = {};

    sessions.forEach((session) => {
      const date = new Date(session.startTime);
      const weekNumber = getWeekNumber(date);
      const weekKey = `Week ${weekNumber}`;

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = 0;
      }
      weeklyData[weekKey] += session.durationSeconds / 60;
    });

    const arabicWeeks = [
      'الاسبوع الاول',
      'الاسبوع الثاني',
      'الاسبوع الثالث',
      'الاسبوع الرابع',
      'الاسبوع الخامس',
    ];

    const result = Object.entries(weeklyData)
      .slice(0, 5)
      .map(([week, minutes], index) => ({
        week: arabicWeeks[index] || week,
        minutes: Math.round(minutes),
      }));

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'Weekly statistics retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get weekly stats error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get weekly statistics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get monthly statistics
 * @route   GET /api/v1/users/stats/monthly
 * @access  Private
 */
export const getMonthlyStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_monthly_stats_${userId}`;
    const cached = cache.get<Array<{ month: string; minutes: number }>>(
      cacheKey
    );

    if (cached) {
      successResponse(
        res,
        cached,
        'Monthly statistics retrieved successfully'
      );
      return;
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const sessions = await ListeningSession.find({
      userId,
      startTime: { $gte: startDate },
      deletedAt: null,
    }).sort({ startTime: 1 });

    const monthlyData: { [key: string]: number } = {};

    sessions.forEach((session) => {
      const date = new Date(session.startTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += session.durationSeconds / 60;
    });

    const arabicMonths = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];

    const result = Object.entries(monthlyData)
      .slice(-12)
      .map(([monthKey, minutes]) => {
        const [, month] = monthKey.split('-');
        const monthIndex = parseInt(month, 10) - 1;
        return {
          month: arabicMonths[monthIndex],
          minutes: Math.round(minutes),
        };
      });

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'Monthly statistics retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get monthly stats error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get monthly statistics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user activity heatmap
 * @route   GET /api/v1/users/stats/heatmap
 * @access  Private
 */
export const getUserHeatmap = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_heatmap_${userId}`;
    const cached = cache.get<Array<{ day: number; hour: number; count: number }>>(
      cacheKey
    );

    if (cached) {
      successResponse(res, cached, 'User heatmap retrieved successfully');
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await ListeningSession.find({
      userId,
      startTime: { $gte: thirtyDaysAgo },
      deletedAt: null,
    });

    const heatmapData: { [key: string]: number } = {};

    sessions.forEach((session) => {
      const date = new Date(session.startTime);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;

      if (!heatmapData[key]) {
        heatmapData[key] = 0;
      }
      heatmapData[key] += 1;
    });

    const result = Object.entries(heatmapData).map(([key, count]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, count };
    });

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'User heatmap retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get user heatmap error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get user heatmap';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's top tracks
 * @route   GET /api/v1/users/stats/top-tracks
 * @access  Private
 */
export const getTopTracks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_top_tracks_${userId}_${limit}`;
    const cached = cache.get<Array<{
      track: unknown;
      playCount: number;
    }>>(cacheKey);

    if (cached) {
      successResponse(res, cached, 'Top tracks retrieved successfully');
      return;
    }

    const result = await ListeningSession.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$trackId',
          playCount: { $sum: 1 },
        },
      },
      {
        $sort: { playCount: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'tracks',
          localField: '_id',
          foreignField: '_id',
          as: 'track',
        },
      },
      {
        $unwind: '$track',
      },
      {
        $project: {
          _id: 0,
          track: 1,
          playCount: 1,
        },
      },
    ]);

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'Top tracks retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get top tracks error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get top tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's top categories
 * @route   GET /api/v1/users/stats/top-categories
 * @access  Private
 */
export const getTopCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_top_categories_${userId}`;
    const cached = cache.get<Array<{
      category: unknown;
      sessionCount: number;
    }>>(cacheKey);

    if (cached) {
      successResponse(res, cached, 'Top categories retrieved successfully');
      return;
    }

    const result = await ListeningSession.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: 'tracks',
          localField: 'trackId',
          foreignField: '_id',
          as: 'track',
        },
      },
      {
        $unwind: '$track',
      },
      {
        $group: {
          _id: '$track.category',
          sessionCount: { $sum: 1 },
        },
      },
      {
        $sort: { sessionCount: -1 },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: '$category',
      },
      {
        $project: {
          _id: 0,
          category: 1,
          sessionCount: 1,
        },
      },
    ]);

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'Top categories retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get top categories error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get top categories';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Calculate user listening streak
 * @route   GET /api/v1/users/stats/streak
 * @access  Private
 */
export const getUserStreak = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `user_streak_${userId}`;
    const cached = cache.get<{
      currentStreak: number;
      longestStreak: number;
      lastActive: Date | null;
    }>(cacheKey);

    if (cached) {
      successResponse(res, cached, 'User streak retrieved successfully');
      return;
    }

    const sessions = await ListeningSession.find({
      userId,
      deletedAt: null,
    })
      .select('startTime')
      .sort({ startTime: 1 });

    if (sessions.length === 0) {
      const result = {
        currentStreak: 0,
        longestStreak: 0,
        lastActive: null,
      };
      successResponse(res, result, 'User streak retrieved successfully');
      return;
    }

    const uniqueDates = new Set<string>();
    sessions.forEach((session) => {
      const dateStr = new Date(session.startTime).toISOString().split('T')[0];
      uniqueDates.add(dateStr);
    });

    const sortedDates = Array.from(uniqueDates).sort();

    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 1;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const lastActivityDate = sortedDates[sortedDates.length - 1];

    if (lastActivityDate === today || lastActivityDate === yesterday) {
      let streakDates = [lastActivityDate];
      for (let i = sortedDates.length - 2; i >= 0; i--) {
        const prevDate = new Date(sortedDates[i]);
        const lastStreakDate = new Date(streakDates[streakDates.length - 1]);
        const diffDays = Math.floor(
          (lastStreakDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          streakDates.push(sortedDates[i]);
        } else {
          break;
        }
      }
      currentStreak = streakDates.length;
    } else {
      currentStreak = 0;
    }

    const lastActive = sessions[sessions.length - 1].startTime;

    const result = {
      currentStreak,
      longestStreak,
      lastActive,
    };

    cache.set(cacheKey, result, 3600);

    successResponse(res, result, 'User streak retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get user streak error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get user streak';
    errorResponse(res, message, 500);
  }
};

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000);
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
