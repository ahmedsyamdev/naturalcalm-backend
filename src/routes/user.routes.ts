import { Router } from 'express';
import {
  getCurrentUser,
  updateCurrentUser,
  getListeningPatterns,
} from '../controllers/user.controller';
import {
  getListeningHistory,
  getRecentTracks,
} from '../controllers/listeningSessions.controller';
import {
  getUserSubscription,
  getSubscriptionHistory,
} from '../controllers/subscriptions.controller';
import { getPaymentHistory } from '../controllers/payments.controller';
import {
  getUserStats,
  getWeeklyStats,
  getMonthlyStats,
  getUserHeatmap,
  getTopTracks,
  getTopCategories,
  getUserStreak,
} from '../controllers/userStats.controller';
import {
  validateGetHistory,
  validateGetRecentTracks,
} from '../validators/listeningSessions.validator';
import { protect } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * All routes are protected (require authentication)
 */

// Get current user profile
router.get('/me', protect, asyncHandler(getCurrentUser));

// Update current user profile
router.put('/me', protect, asyncHandler(updateCurrentUser));

// Get listening history
router.get(
  '/history',
  protect,
  validateGetHistory,
  asyncHandler(getListeningHistory)
);

// Get recent tracks
router.get(
  '/history/recent',
  protect,
  validateGetRecentTracks,
  asyncHandler(getRecentTracks)
);

// Get listening patterns
router.get(
  '/listening-patterns',
  protect,
  asyncHandler(getListeningPatterns)
);

// Get user's current subscription
router.get('/subscription', protect, getUserSubscription);

// Get subscription history
router.get('/subscriptions/history', protect, getSubscriptionHistory);

// Get payment history
router.get('/payments/history', protect, getPaymentHistory);

// User statistics endpoints
router.get('/stats', protect, asyncHandler(getUserStats));
router.get('/stats/weekly', protect, asyncHandler(getWeeklyStats));
router.get('/stats/monthly', protect, asyncHandler(getMonthlyStats));
router.get('/stats/heatmap', protect, asyncHandler(getUserHeatmap));
router.get('/stats/top-tracks', protect, asyncHandler(getTopTracks));
router.get('/stats/top-categories', protect, asyncHandler(getTopCategories));
router.get('/stats/streak', protect, asyncHandler(getUserStreak));

export default router;
