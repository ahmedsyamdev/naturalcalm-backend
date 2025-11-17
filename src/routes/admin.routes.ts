import { Router } from 'express';
import { getSubscriptionStats } from '../controllers/subscriptions.controller';
import {
  getDashboardAnalytics,
  getUserGrowthAnalytics,
  getContentEngagementAnalytics,
  getRevenueAnalytics,
  getRetentionAnalytics,
  exportAnalytics,
  getRealtimeAnalytics,
  getPopularTracksAnalytics,
} from '../controllers/adminAnalytics.controller';
import {
  listUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  banUser,
  unbanUser,
  grantSubscription,
  exportUserData,
} from '../controllers/adminUser.controller';
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
} from '../controllers/adminCoupon.controller';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/adminCategory.controller';
import {
  getAllTracks,
  getTrackById,
  createTrack,
  updateTrack,
  deleteTrack,
} from '../controllers/adminTrack.controller';
import {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
} from '../controllers/adminProgram.controller';
import {
  getAllPackages,
  getPackageById,
  updatePackage,
} from '../controllers/adminPackage.controller';
import {
  getAllPayments,
  getPaymentById,
  exportPayments,
} from '../controllers/adminPayment.controller';
import { refundPayment } from '../controllers/payments.controller';
import { getSystemHealth } from '../controllers/adminHealth.controller';
import {
  getSettings,
  updateAdminProfile,
  changeAdminPassword,
  updateStorageSettings,
  initializeSettings,
} from '../controllers/settings.controller';
import {
  sendNotificationToUser,
  broadcastNotification,
  getNotificationTemplates,
  getNotificationStats,
  getNotificationHistory,
  getUsersForNotifications,
  getTracksForNotifications,
  getProgramsForNotifications,
} from '../controllers/notifications.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * All routes require authentication and admin role
 */

// User Management
router.get('/users', protect, authorize('admin'), asyncHandler(listUsers));
router.get('/users/:userId', protect, authorize('admin'), asyncHandler(getUserDetails));
router.put('/users/:userId', protect, authorize('admin'), asyncHandler(updateUser));
router.delete('/users/:userId', protect, authorize('admin'), asyncHandler(deleteUser));
router.post('/users/:userId/ban', protect, authorize('admin'), asyncHandler(banUser));
router.post('/users/:userId/unban', protect, authorize('admin'), asyncHandler(unbanUser));
router.post('/users/:userId/grant-subscription', protect, authorize('admin'), asyncHandler(grantSubscription));
router.get('/users/:userId/export', protect, authorize('admin'), asyncHandler(exportUserData));

// Coupon Management
router.get('/coupons', protect, authorize('admin'), asyncHandler(listCoupons));
router.post('/coupons', protect, authorize('admin'), asyncHandler(createCoupon));
router.put('/coupons/:couponId', protect, authorize('admin'), asyncHandler(updateCoupon));
router.delete('/coupons/:couponId', protect, authorize('admin'), asyncHandler(deleteCoupon));
router.get('/coupons/:couponId/stats', protect, authorize('admin'), asyncHandler(getCouponStats));

// System Health
router.get('/health', protect, authorize('admin'), asyncHandler(getSystemHealth));

// Get subscription statistics
router.get('/subscriptions/stats', protect, authorize('admin'), getSubscriptionStats);

// Admin analytics endpoints
router.get('/analytics/dashboard', protect, authorize('admin'), asyncHandler(getDashboardAnalytics));
router.get('/analytics/users', protect, authorize('admin'), asyncHandler(getUserGrowthAnalytics));
router.get('/analytics/content', protect, authorize('admin'), asyncHandler(getContentEngagementAnalytics));
router.get('/analytics/revenue', protect, authorize('admin'), asyncHandler(getRevenueAnalytics));
router.get('/analytics/retention', protect, authorize('admin'), asyncHandler(getRetentionAnalytics));
router.get('/analytics/export', protect, authorize('admin'), asyncHandler(exportAnalytics));
router.get('/analytics/realtime', protect, authorize('admin'), asyncHandler(getRealtimeAnalytics));
router.get('/analytics/tracks/popular', protect, authorize('admin'), asyncHandler(getPopularTracksAnalytics));

// Category Management
router.get('/categories', protect, authorize('admin'), asyncHandler(getAllCategories));
router.post('/categories', protect, authorize('admin'), asyncHandler(createCategory));
router.put('/categories/:id', protect, authorize('admin'), asyncHandler(updateCategory));
router.delete('/categories/:id', protect, authorize('admin'), asyncHandler(deleteCategory));

// Track Management
router.get('/tracks', protect, authorize('admin'), asyncHandler(getAllTracks));
router.get('/tracks/:id', protect, authorize('admin'), asyncHandler(getTrackById));
router.post('/tracks', protect, authorize('admin'), asyncHandler(createTrack));
router.put('/tracks/:id', protect, authorize('admin'), asyncHandler(updateTrack));
router.delete('/tracks/:id', protect, authorize('admin'), asyncHandler(deleteTrack));

// Program Management
router.get('/programs', protect, authorize('admin'), asyncHandler(getAllPrograms));
router.get('/programs/:id', protect, authorize('admin'), asyncHandler(getProgramById));
router.post('/programs', protect, authorize('admin'), asyncHandler(createProgram));
router.put('/programs/:id', protect, authorize('admin'), asyncHandler(updateProgram));
router.delete('/programs/:id', protect, authorize('admin'), asyncHandler(deleteProgram));

// Package Management
router.get('/packages', protect, authorize('admin'), asyncHandler(getAllPackages));
router.get('/packages/:id', protect, authorize('admin'), asyncHandler(getPackageById));
router.put('/packages/:id', protect, authorize('admin'), asyncHandler(updatePackage));

// Payment Management
router.get('/payments/export', protect, authorize('admin'), asyncHandler(exportPayments));
router.get('/payments', protect, authorize('admin'), asyncHandler(getAllPayments));
router.get('/payments/:id', protect, authorize('admin'), asyncHandler(getPaymentById));
router.post('/payments/:id/refund', protect, authorize('admin'), refundPayment);

// Settings Management
router.get('/settings', protect, authorize('admin'), asyncHandler(getSettings));
router.put('/settings/profile', protect, authorize('admin'), asyncHandler(updateAdminProfile));
router.put('/settings/password', protect, authorize('admin'), asyncHandler(changeAdminPassword));
router.put('/settings/storage', protect, authorize('admin'), asyncHandler(updateStorageSettings));
router.post('/settings/initialize', protect, authorize('admin'), asyncHandler(initializeSettings));

// Notification Management
router.get('/notifications/templates', protect, authorize('admin'), asyncHandler(getNotificationTemplates));
router.get('/notifications/stats', protect, authorize('admin'), asyncHandler(getNotificationStats));
router.get('/notifications/history', protect, authorize('admin'), asyncHandler(getNotificationHistory));
router.get('/notifications/users', protect, authorize('admin'), asyncHandler(getUsersForNotifications));
router.get('/notifications/tracks', protect, authorize('admin'), asyncHandler(getTracksForNotifications));
router.get('/notifications/programs', protect, authorize('admin'), asyncHandler(getProgramsForNotifications));
router.post('/notifications/send', protect, authorize('admin'), asyncHandler(sendNotificationToUser));
router.post('/notifications/broadcast', protect, authorize('admin'), asyncHandler(broadcastNotification));

export default router;
