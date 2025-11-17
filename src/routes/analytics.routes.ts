import { Router } from 'express';
import {
  getUserStatistics,
  getWeeklyStatistics,
  getMonthlyStatistics,
  getTopTracks,
  getTopCategories,
  getListeningStreak,
  getActivityHeatmap,
} from '../controllers/userAnalytics.controller';
import {
  getDashboardAnalytics,
  getUserGrowthAnalytics,
  getContentEngagementAnalytics,
  getRevenueAnalytics,
  getRetentionAnalytics,
  exportAnalytics,
  getRealtimeAnalytics,
} from '../controllers/adminAnalytics.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * User Analytics Routes (Protected)
 * GET /api/v1/analytics/stats
 * GET /api/v1/analytics/weekly
 * GET /api/v1/analytics/monthly
 * GET /api/v1/analytics/top-tracks
 * GET /api/v1/analytics/top-categories
 * GET /api/v1/analytics/streak
 * GET /api/v1/analytics/heatmap
 */

// User statistics - total minutes, tracks, programs
router.get(
  '/stats',
  protect,
  asyncHandler(getUserStatistics)
);

// Weekly listening statistics
router.get(
  '/weekly',
  protect,
  asyncHandler(getWeeklyStatistics)
);

// Monthly listening statistics
router.get(
  '/monthly',
  protect,
  asyncHandler(getMonthlyStatistics)
);

// Top listened tracks
router.get(
  '/top-tracks',
  protect,
  asyncHandler(getTopTracks)
);

// Top listened categories
router.get(
  '/top-categories',
  protect,
  asyncHandler(getTopCategories)
);

// Listening streak calculation
router.get(
  '/streak',
  protect,
  asyncHandler(getListeningStreak)
);

// Activity heatmap (optional)
router.get(
  '/heatmap',
  protect,
  asyncHandler(getActivityHeatmap)
);

/**
 * Admin Analytics Routes (Protected, Admin Only)
 * GET /api/v1/analytics/admin/dashboard
 * GET /api/v1/analytics/admin/users
 * GET /api/v1/analytics/admin/content
 * GET /api/v1/analytics/admin/revenue
 * GET /api/v1/analytics/admin/retention
 * GET /api/v1/analytics/admin/export
 * GET /api/v1/analytics/admin/realtime
 */

// Admin dashboard overview
router.get(
  '/admin/dashboard',
  protect,
  authorize('admin'),
  asyncHandler(getDashboardAnalytics)
);

// User growth analytics
router.get(
  '/admin/users',
  protect,
  authorize('admin'),
  asyncHandler(getUserGrowthAnalytics)
);

// Content engagement analytics
router.get(
  '/admin/content',
  protect,
  authorize('admin'),
  asyncHandler(getContentEngagementAnalytics)
);

// Revenue analytics
router.get(
  '/admin/revenue',
  protect,
  authorize('admin'),
  asyncHandler(getRevenueAnalytics)
);

// Retention analytics
router.get(
  '/admin/retention',
  protect,
  authorize('admin'),
  asyncHandler(getRetentionAnalytics)
);

// Export analytics data
router.get(
  '/admin/export',
  protect,
  authorize('admin'),
  asyncHandler(exportAnalytics)
);

// Real-time analytics (optional)
router.get(
  '/admin/realtime',
  protect,
  authorize('admin'),
  asyncHandler(getRealtimeAnalytics)
);

export default router;
