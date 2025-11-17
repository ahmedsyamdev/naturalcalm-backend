import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import { Payment } from '../models/Payment.model';
import { ListeningSession } from '../models/ListeningSession.model';
import { UserProgram } from '../models/UserProgram.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import cache from '../utils/cache';
import { parse } from 'json2csv';

/**
 * @desc    Get admin dashboard analytics
 * @route   GET /api/v1/admin/analytics/dashboard
 * @access  Private (Admin)
 */
export const getDashboardAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = 'admin_dashboard_analytics';
    const cached = cache.get<{
      totalUsers: number;
      activeUsers: number;
      totalTracks: number;
      totalPrograms: number;
      totalRevenue: number;
      activeSubscriptions: number;
    }>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'Dashboard analytics retrieved successfully'
      );
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      activeUsers,
      totalTracks,
      totalPrograms,
      revenueData,
      activeSubscriptions,
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({
        deletedAt: null,
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      Track.countDocuments({ deletedAt: null }),
      Program.countDocuments({ deletedAt: null }),
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
          },
        },
      ]),
      User.countDocuments({
        'subscription.status': 'active',
        deletedAt: null,
      }),
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    const stats = {
      totalUsers,
      activeUsers,
      totalTracks,
      totalPrograms,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      activeSubscriptions,
    };

    cache.set(cacheKey, stats, 300);

    successResponse(
      res,
      stats,
      'Dashboard analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get dashboard analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get dashboard analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get admin user growth analytics
 * @route   GET /api/v1/admin/analytics/users
 * @access  Private (Admin)
 */
export const getUserGrowthAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { period = 'month' } = req.query;

    if (!['week', 'month', 'year'].includes(period as string)) {
      errorResponse(res, 'Invalid period. Must be week, month, or year', 400);
      return;
    }

    const cacheKey = `admin_user_growth_${period}`;
    const cached = cache.get<Array<{
      period: string;
      count: number;
      growthRate: number;
    }>>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'User growth analytics retrieved successfully'
      );
      return;
    }

    let groupBy: object;
    let daysBack: number;

    switch (period) {
      case 'week':
        daysBack = 90;
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      case 'year':
        daysBack = 1095;
        groupBy = {
          year: { $year: '$createdAt' },
        };
        break;
      default:
        daysBack = 365;
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const result = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 },
      },
    ]);

    const formattedResult = result.map((item, index) => {
      let periodLabel = '';
      if (period === 'week') {
        periodLabel = `Week ${item._id.week}, ${item._id.year}`;
      } else if (period === 'year') {
        periodLabel = `${item._id.year}`;
      } else {
        periodLabel = `${item._id.month}/${item._id.year}`;
      }

      const previousCount = index > 0 ? result[index - 1].count : item.count;
      const growthRate =
        previousCount > 0
          ? Math.round(((item.count - previousCount) / previousCount) * 100)
          : 0;

      return {
        period: periodLabel,
        count: item.count,
        growthRate,
      };
    });

    cache.set(cacheKey, formattedResult, 300);

    successResponse(
      res,
      formattedResult,
      'User growth analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get user growth analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get user growth analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get admin content engagement analytics
 * @route   GET /api/v1/admin/analytics/content
 * @access  Private (Admin)
 */
export const getContentEngagementAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = 'admin_content_engagement';
    const cached = cache.get<{
      topTracks: unknown[];
      topPrograms: unknown[];
      averageCompletionRate: number;
      totalSessions: number;
    }>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'Content engagement analytics retrieved successfully'
      );
      return;
    }

    const [topTracks, topPrograms, completionStats, totalSessions] =
      await Promise.all([
        Track.find({ deletedAt: null })
          .select('title playCount')
          .sort({ playCount: -1 })
          .limit(10)
          .lean(),

        UserProgram.aggregate([
          {
            $match: { deletedAt: null },
          },
          {
            $group: {
              _id: '$programId',
              enrollmentCount: { $sum: 1 },
              completedCount: {
                $sum: { $cond: ['$isCompleted', 1, 0] },
              },
            },
          },
          {
            $lookup: {
              from: 'programs',
              localField: '_id',
              foreignField: '_id',
              as: 'program',
            },
          },
          {
            $unwind: '$program',
          },
          {
            $project: {
              _id: 0,
              programId: '$_id',
              title: '$program.title',
              enrollmentCount: 1,
              completedCount: 1,
              completionRate: {
                $cond: [
                  { $gt: ['$enrollmentCount', 0] },
                  {
                    $multiply: [
                      { $divide: ['$completedCount', '$enrollmentCount'] },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
          {
            $sort: { enrollmentCount: -1 },
          },
          {
            $limit: 10,
          },
        ]),

        UserProgram.aggregate([
          {
            $match: { deletedAt: null },
          },
          {
            $group: {
              _id: null,
              totalPrograms: { $sum: 1 },
              completedPrograms: {
                $sum: { $cond: ['$isCompleted', 1, 0] },
              },
              averageProgress: { $avg: '$progress' },
            },
          },
        ]),

        ListeningSession.countDocuments({ deletedAt: null }),
      ]);

    const averageCompletionRate =
      completionStats[0]?.averageProgress || 0;

    const analytics = {
      topTracks,
      topPrograms,
      averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
      totalSessions,
    };

    cache.set(cacheKey, analytics, 300);

    successResponse(
      res,
      analytics,
      'Content engagement analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get content engagement analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get content engagement analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get admin revenue analytics
 * @route   GET /api/v1/admin/analytics/revenue
 * @access  Private (Admin)
 */
export const getRevenueAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { period = 'month' } = req.query;

    if (!['week', 'month', 'year'].includes(period as string)) {
      errorResponse(res, 'Invalid period. Must be week, month, or year', 400);
      return;
    }

    const cacheKey = `admin_revenue_${period}`;
    const cached = cache.get<{
      totalRevenue: number;
      mrr: number;
      arr: number;
      revenueByPackage: unknown[];
      revenueOverTime: unknown[];
      churnRate: number;
    }>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'Revenue analytics retrieved successfully'
      );
      return;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [totalRevenueData, monthlyRevenue, revenueByPackage, churnData] =
      await Promise.all([
        Payment.aggregate([
          {
            $match: {
              status: 'completed',
              deletedAt: null,
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$finalAmount' },
            },
          },
        ]),

        Payment.aggregate([
          {
            $match: {
              status: 'completed',
              createdAt: { $gte: thirtyDaysAgo },
              deletedAt: null,
            },
          },
          {
            $group: {
              _id: null,
              monthlyRevenue: { $sum: '$finalAmount' },
            },
          },
        ]),

        Payment.aggregate([
          {
            $match: {
              status: 'completed',
              deletedAt: null,
            },
          },
          {
            $lookup: {
              from: 'subscriptions',
              localField: 'subscriptionId',
              foreignField: '_id',
              as: 'subscription',
            },
          },
          {
            $unwind: '$subscription',
          },
          {
            $lookup: {
              from: 'packages',
              localField: 'subscription.packageId',
              foreignField: '_id',
              as: 'package',
            },
          },
          {
            $unwind: '$package',
          },
          {
            $group: {
              _id: '$package._id',
              packageName: { $first: '$package.name' },
              revenue: { $sum: '$finalAmount' },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { revenue: -1 },
          },
        ]),

        User.aggregate([
          {
            $match: { deletedAt: null },
          },
          {
            $group: {
              _id: null,
              totalSubscriptions: { $sum: 1 },
              activeSubscriptions: {
                $sum: {
                  $cond: [{ $eq: ['$subscription.status', 'active'] }, 1, 0],
                },
              },
              cancelledSubscriptions: {
                $sum: {
                  $cond: [
                    { $eq: ['$subscription.status', 'cancelled'] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;
    const mrr = monthlyRevenue[0]?.monthlyRevenue || 0;
    const arr = mrr * 12;

    let groupBy: object;
    let daysBack: number;

    switch (period) {
      case 'week':
        daysBack = 90;
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      case 'year':
        daysBack = 1095;
        groupBy = {
          year: { $year: '$createdAt' },
        };
        break;
      default:
        daysBack = 365;
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const revenueOverTime = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$finalAmount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 },
      },
    ]);

    const totalSubscriptions = churnData[0]?.totalSubscriptions || 1;
    const cancelledSubscriptions = churnData[0]?.cancelledSubscriptions || 0;
    const churnRate =
      (cancelledSubscriptions / totalSubscriptions) * 100;

    const analytics = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      revenueByPackage,
      revenueOverTime,
      churnRate: Math.round(churnRate * 100) / 100,
    };

    cache.set(cacheKey, analytics, 300);

    successResponse(
      res,
      analytics,
      'Revenue analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get revenue analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get revenue analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get admin retention analytics
 * @route   GET /api/v1/admin/analytics/retention
 * @access  Private (Admin)
 */
export const getRetentionAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = 'admin_retention';
    const cached = cache.get<{
      day1Retention: number;
      day7Retention: number;
      day30Retention: number;
      monthlyRetention: unknown[];
    }>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'Retention analytics retrieved successfully'
      );
      return;
    }

    const now = new Date();

    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      usersCreatedDay1,
      usersActiveDay1,
      usersCreatedDay7,
      usersActiveDay7,
      usersCreatedDay30,
      usersActiveDay30,
    ] = await Promise.all([
      User.countDocuments({
        createdAt: { $gte: oneDayAgo },
        deletedAt: null,
      }),

      User.countDocuments({
        createdAt: { $gte: oneDayAgo },
        updatedAt: { $gte: oneDayAgo },
        deletedAt: null,
      }),

      User.countDocuments({
        createdAt: { $gte: sevenDaysAgo, $lt: oneDayAgo },
        deletedAt: null,
      }),

      User.countDocuments({
        createdAt: { $gte: sevenDaysAgo, $lt: oneDayAgo },
        updatedAt: { $gte: oneDayAgo },
        deletedAt: null,
      }),

      User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo },
        deletedAt: null,
      }),

      User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo },
        updatedAt: { $gte: oneDayAgo },
        deletedAt: null,
      }),
    ]);

    const day1Retention =
      usersCreatedDay1 > 0 ? (usersActiveDay1 / usersCreatedDay1) * 100 : 0;

    const day7Retention =
      usersCreatedDay7 > 0 ? (usersActiveDay7 / usersCreatedDay7) * 100 : 0;

    const day30Retention =
      usersCreatedDay30 > 0
        ? (usersActiveDay30 / usersCreatedDay30) * 100
        : 0;

    const monthlyRetention = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 6, 1) },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [
                { $gte: ['$updatedAt', '$createdAt'] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          period: {
            $concat: [
              { $toString: '$_id.month' },
              '/',
              { $toString: '$_id.year' },
            ],
          },
          retentionRate: {
            $cond: [
              { $gt: ['$totalUsers', 0] },
              {
                $multiply: [
                  { $divide: ['$activeUsers', '$totalUsers'] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: { period: 1 },
      },
    ]);

    const analytics = {
      day1Retention: Math.round(day1Retention * 100) / 100,
      day7Retention: Math.round(day7Retention * 100) / 100,
      day30Retention: Math.round(day30Retention * 100) / 100,
      monthlyRetention,
    };

    cache.set(cacheKey, analytics, 300);

    successResponse(
      res,
      analytics,
      'Retention analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get retention analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get retention analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Export analytics data
 * @route   GET /api/v1/admin/analytics/export
 * @access  Private (Admin)
 */
export const exportAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type = 'users' } = req.query;

    if (!['users', 'revenue', 'engagement'].includes(type as string)) {
      errorResponse(
        res,
        'Invalid type. Must be users, revenue, or engagement',
        400
      );
      return;
    }

    let data: unknown[] = [];
    let fields: string[] = [];

    switch (type) {
      case 'users':
        data = await User.find({ deletedAt: null })
          .select('name email phone subscription.status createdAt')
          .lean();
        fields = ['name', 'email', 'phone', 'subscription.status', 'createdAt'];
        break;

      case 'revenue':
        data = await Payment.find({ status: 'completed', deletedAt: null })
          .populate('userId', 'name email')
          .select('amount finalAmount currency createdAt')
          .lean();
        fields = ['userId', 'amount', 'finalAmount', 'currency', 'createdAt'];
        break;

      case 'engagement':
        data = await ListeningSession.find({ deletedAt: null })
          .populate('userId', 'name')
          .populate('trackId', 'title')
          .select('durationSeconds completed startTime')
          .lean();
        fields = ['userId', 'trackId', 'durationSeconds', 'completed', 'startTime'];
        break;
    }

    const csv = parse(data, { fields });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}_analytics_${Date.now()}.csv"`
    );

    res.send(csv);
  } catch (error: unknown) {
    logger.error('Export analytics error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to export analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get real-time analytics
 * @route   GET /api/v1/admin/analytics/realtime
 * @access  Private (Admin)
 */
export const getRealtimeAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const [recentSignups, activeSessions, recentActivity] = await Promise.all([
      User.countDocuments({
        createdAt: { $gte: oneHourAgo },
        deletedAt: null,
      }),

      ListeningSession.countDocuments({
        startTime: { $gte: fiveMinutesAgo },
        endTime: null,
        deletedAt: null,
      }),

      User.countDocuments({
        updatedAt: { $gte: fiveMinutesAgo },
        deletedAt: null,
      }),
    ]);

    const analytics = {
      recentSignups,
      activeSessions,
      activeUsersNow: recentActivity,
      timestamp: new Date(),
    };

    successResponse(
      res,
      analytics,
      'Real-time analytics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get real-time analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get real-time analytics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get popular tracks for admin dashboard
 * @route   GET /api/v1/admin/analytics/tracks/popular
 * @access  Private (Admin)
 */
export const getPopularTracksAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit = '5' } = req.query;

    const cacheKey = `admin_popular_tracks_${limit}`;
    const cached = cache.get<unknown[]>(cacheKey);

    if (cached) {
      successResponse(
        res,
        cached,
        'Popular tracks retrieved successfully'
      );
      return;
    }

    const popularTracks = await Track.find({ deletedAt: null, isActive: true })
      .select('title category imageUrl playCount')
      .sort({ playCount: -1 })
      .limit(parseInt(limit as string))
      .populate('category', 'name nameAr emoji')
      .lean();

    const formattedTracks = popularTracks.map(track => ({
      id: track._id,
      title: track.title,
      category: (track.category as any)?.name || 'غير مصنف',
      playCount: track.playCount || 0,
      imageUrl: track.imageUrl,
    }));

    cache.set(cacheKey, formattedTracks, 300);

    successResponse(
      res,
      formattedTracks,
      'Popular tracks retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get popular tracks analytics error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get popular tracks';
    errorResponse(res, message, 500);
  }
};
