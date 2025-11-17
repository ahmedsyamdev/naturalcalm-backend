import { Router } from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDeviceToken,
  sendNotificationToUser,
  broadcastNotification,
} from '../controllers/notifications.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  validateGetNotifications,
  validateMarkAsRead,
  validateDeleteNotification,
  validateUpdatePreferences,
  validateRegisterDevice,
  validateSendNotification,
  validateBroadcastNotification,
} from '../validators/notifications.validator';

const router = Router();

/**
 * User notification routes (protected)
 */
router.get(
  '/',
  protect,
  validateGetNotifications,
  asyncHandler(getUserNotifications)
);

router.get(
  '/unread-count',
  protect,
  asyncHandler(getUnreadCount)
);

router.put(
  '/:notificationId/read',
  protect,
  validateMarkAsRead,
  asyncHandler(markNotificationAsRead)
);

router.put(
  '/mark-all-read',
  protect,
  asyncHandler(markAllAsRead)
);

router.delete(
  '/:notificationId',
  protect,
  validateDeleteNotification,
  asyncHandler(deleteNotification)
);

router.get(
  '/preferences',
  protect,
  asyncHandler(getNotificationPreferences)
);

router.put(
  '/preferences',
  protect,
  validateUpdatePreferences,
  asyncHandler(updateNotificationPreferences)
);

router.post(
  '/register-device',
  protect,
  validateRegisterDevice,
  asyncHandler(registerDeviceToken)
);

/**
 * Admin notification routes (protected + admin only)
 */
router.post(
  '/send',
  protect,
  authorize('admin'),
  validateSendNotification,
  asyncHandler(sendNotificationToUser)
);

router.post(
  '/broadcast',
  protect,
  authorize('admin'),
  validateBroadcastNotification,
  asyncHandler(broadcastNotification)
);

export default router;
