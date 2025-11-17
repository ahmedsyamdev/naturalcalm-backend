import { Request, Response } from 'express';
import { ListeningSession } from '../models/ListeningSession.model';
import { UserProgram } from '../models/UserProgram.model';
import { getRedisClient } from '../config/redis';

/**
 * Get User Statistics
 * GET /api/v1/users/stats
 * Returns total minutes, tracks, and programs for the authenticated user
 * Cached for 1 hour per user
 */
export const getUserStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;
  const redisClient = getRedisClient();

  // Check Redis cache first
  const cacheKey = `user:stats:${userId}`;
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    res.status(200).json({
      success: true,
      message: 'User statistics retrieved successfully (cached)',
      data: JSON.parse(cached as string),
    });
    return;
  }

  // Aggregate listening sessions for total minutes and unique tracks
  const sessionStats = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: { $divide: ['$durationSeconds', 60] } },
        uniqueTracks: { $addToSet: '$trackId' },
        uniquePrograms: {
          $addToSet: {
            $cond: [{ $ne: ['$programId', null] }, '$programId', '$$REMOVE'],
          },
        },
      },
    },
  ]);

  const totalMinutes = sessionStats[0]?.totalMinutes
    ? Math.round(sessionStats[0].totalMinutes)
    : 0;
  const totalTracks = sessionStats[0]?.uniqueTracks?.length || 0;
  const totalPrograms = sessionStats[0]?.uniquePrograms?.length || 0;

  // Get completed programs count from UserProgram
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

  // Cache for 1 hour (3600 seconds)
  await redisClient.setEx(cacheKey, 3600, JSON.stringify(stats));

  res.status(200).json({
    success: true,
    message: 'User statistics retrieved successfully',
    data: stats,
  });
};

/**
 * Get Weekly Statistics
 * GET /api/v1/users/stats/weekly
 * Returns listening minutes aggregated by week for chart display
 * Query params: period ('week'|'month'|'year')
 */
export const getWeeklyStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;
  const period = (req.query.period as string) || 'month';

  // Calculate date range based on period
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'year':
      startDate.setDate(now.getDate() - 365);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Aggregate by week
  const weeklyStats = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        startTime: { $gte: startDate },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$startTime' },
          week: { $week: '$startTime' },
        },
        minutes: { $sum: { $divide: ['$durationSeconds', 60] } },
        sessionCount: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.week': 1 },
    },
  ]);

  // Format for Arabic weeks
  const arabicWeeks = [
    'الاسبوع الاول',
    'الاسبوع الثاني',
    'الاسبوع الثالث',
    'الاسبوع الرابع',
    'الاسبوع الخامس',
  ];

  const formattedStats = weeklyStats.map((stat, index) => ({
    week: arabicWeeks[index % arabicWeeks.length] || `الاسبوع ${index + 1}`,
    weekNumber: stat._id.week,
    year: stat._id.year,
    minutes: Math.round(stat.minutes),
    sessions: stat.sessionCount,
  }));

  res.status(200).json({
    success: true,
    message: 'Weekly statistics retrieved successfully',
    data: formattedStats,
  });
};

/**
 * Get Monthly Statistics
 * GET /api/v1/users/stats/monthly
 * Returns listening minutes aggregated by month for longer period analysis
 */
export const getMonthlyStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;

  // Get last 12 months
  const now = new Date();
  const startDate = new Date();
  startDate.setMonth(now.getMonth() - 12);

  // Aggregate by month
  const monthlyStats = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        startTime: { $gte: startDate },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$startTime' },
          month: { $month: '$startTime' },
        },
        minutes: { $sum: { $divide: ['$durationSeconds', 60] } },
        sessionCount: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);

  // Arabic month names
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

  const formattedStats = monthlyStats.map((stat) => ({
    month: arabicMonths[stat._id.month - 1],
    monthNumber: stat._id.month,
    year: stat._id.year,
    minutes: Math.round(stat.minutes),
    sessions: stat.sessionCount,
  }));

  res.status(200).json({
    success: true,
    message: 'Monthly statistics retrieved successfully',
    data: formattedStats,
  });
};

/**
 * Get User's Top Tracks
 * GET /api/v1/users/stats/top-tracks
 * Returns most listened tracks with play counts
 * Query params: limit (default 10)
 */
export const getTopTracks = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 10;

  // Aggregate sessions by track
  const topTracks = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$trackId',
        playCount: { $sum: 1 },
        totalMinutes: { $sum: { $divide: ['$durationSeconds', 60] } },
        completedCount: {
          $sum: { $cond: ['$completed', 1, 0] },
        },
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
        trackId: '$_id',
        playCount: 1,
        totalMinutes: { $round: ['$totalMinutes', 0] },
        completedCount: 1,
        track: {
          _id: 1,
          title: 1,
          imageUrl: 1,
          durationSeconds: 1,
          category: 1,
          level: 1,
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    message: 'Top tracks retrieved successfully',
    data: topTracks,
  });
};

/**
 * Get User's Top Categories
 * GET /api/v1/users/stats/top-categories
 * Returns most listened categories with session counts
 */
export const getTopCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;

  // Aggregate sessions by category (via track)
  const topCategories = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
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
        totalMinutes: { $sum: { $divide: ['$durationSeconds', 60] } },
        uniqueTracks: { $addToSet: '$trackId' },
      },
    },
    {
      $sort: { sessionCount: -1 },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        sessionCount: 1,
        totalMinutes: { $round: ['$totalMinutes', 0] },
        trackCount: { $size: '$uniqueTracks' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    message: 'Top categories retrieved successfully',
    data: topCategories,
  });
};

/**
 * Calculate User Listening Streak
 * GET /api/v1/users/stats/streak
 * Returns current streak, longest streak, and last active date
 */
export const getListeningStreak = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;

  // Get all distinct dates with listening activity
  const sessions = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
        },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  if (sessions.length === 0) {
    res.status(200).json({
      success: true,
      message: 'Listening streak calculated',
      data: {
        currentStreak: 0,
        longestStreak: 0,
        lastActive: null,
      },
    });
    return;
  }

  // Convert to dates and calculate streaks
  const dates = sessions.map((s) => new Date(s._id));
  const lastActive = dates[0];

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const date = new Date(dates[i]);
    date.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    expectedDate.setHours(0, 0, 0, 0);

    if (date.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i]);
    const previous = new Date(dates[i - 1]);
    current.setHours(0, 0, 0, 0);
    previous.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  res.status(200).json({
    success: true,
    message: 'Listening streak calculated successfully',
    data: {
      currentStreak,
      longestStreak,
      lastActive,
    },
  });
};

/**
 * Get User Activity Heatmap (Optional)
 * GET /api/v1/users/stats/heatmap
 * Returns user activity aggregated by day and hour
 */
export const getActivityHeatmap = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;

  // Get last 30 days of activity
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const heatmapData = await ListeningSession.aggregate([
    {
      $match: {
        userId: userId,
        startTime: { $gte: startDate },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: '$startTime' },
          hour: { $hour: '$startTime' },
        },
        sessionCount: { $sum: 1 },
        totalMinutes: { $sum: { $divide: ['$durationSeconds', 60] } },
      },
    },
    {
      $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 },
    },
  ]);

  // Arabic day names
  const arabicDays = [
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت',
  ];

  const formattedData = heatmapData.map((item) => ({
    day: arabicDays[(item._id.dayOfWeek + 6) % 7], // Adjust for Sunday=1 in MongoDB
    dayOfWeek: item._id.dayOfWeek,
    hour: item._id.hour,
    sessionCount: item.sessionCount,
    minutes: Math.round(item.totalMinutes),
  }));

  res.status(200).json({
    success: true,
    message: 'Activity heatmap retrieved successfully',
    data: formattedData,
  });
};
