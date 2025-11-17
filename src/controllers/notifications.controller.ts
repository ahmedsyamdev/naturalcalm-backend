import { Request, Response } from 'express';
import { Notification as NotificationModel } from '../models/Notification.model';
import { User } from '../models/User.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { getRedisClient } from '../config/redis';
import { createNotification, createBulkNotifications, NotificationData } from '../services/notification.service';
import { NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';
import { getFCMTokenStats } from '../services/fcmTokenCleanup.service';

/**
 * @desc    Get user notifications with pagination
 * @route   GET /api/v1/notifications
 * @access  Private
 */
export const getUserNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const notifications = await NotificationModel.find({ userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await NotificationModel.countDocuments({ userId, deletedAt: null });

    successResponse(
      res,
      {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Notifications retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get user notifications error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get notifications';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const cacheKey = `notification:unread:${userId}`;

    try {
      const redisClient = getRedisClient();
      const cached = await redisClient.get(cacheKey);
      if (cached !== null) {
        successResponse(
          res,
          { count: parseInt(cached as string) },
          'Unread count retrieved from cache'
        );
        return;
      }
    } catch (redisError) {
      logger.warn('Redis get error, falling back to database:', redisError);
    }

    const count = await NotificationModel.countDocuments({
      userId,
      isRead: false,
      deletedAt: null,
    });

    try {
      const redisClient = getRedisClient();
      await redisClient.setEx(cacheKey, 60, count.toString());
    } catch (redisError) {
      logger.warn('Redis set error:', redisError);
    }

    successResponse(res, { count }, 'Unread count retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get unread count error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get unread count';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @access  Private
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const notification = await NotificationModel.findOne({
      _id: notificationId,
      userId,
      deletedAt: null,
    });

    if (!notification) {
      errorResponse(res, 'Notification not found', 404);
      return;
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      const cacheKey = `notification:unread:${userId}`;
      try {
        const redisClient = getRedisClient();
        await redisClient.del(cacheKey);
      } catch (redisError) {
        logger.warn('Redis delete error:', redisError);
      }
    }

    successResponse(
      res,
      { notification },
      'Notification marked as read successfully'
    );
  } catch (error: unknown) {
    logger.error('Mark notification as read error:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/mark-all-read
 * @access  Private
 */
export const markAllAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const result = await NotificationModel.updateMany(
      { userId, isRead: false, deletedAt: null },
      { $set: { isRead: true, readAt: new Date() } }
    );

    const cacheKey = `notification:unread:${userId}`;
    try {
      const redisClient = getRedisClient();
      await redisClient.del(cacheKey);
    } catch (redisError) {
      logger.warn('Redis delete error:', redisError);
    }

    successResponse(
      res,
      { modifiedCount: result.modifiedCount },
      'All notifications marked as read successfully'
    );
  } catch (error: unknown) {
    logger.error('Mark all as read error:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/v1/notifications/:notificationId
 * @access  Private
 */
export const deleteNotification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const notification = await NotificationModel.findOne({
      _id: notificationId,
      userId,
      deletedAt: null,
    });

    if (!notification) {
      errorResponse(res, 'Notification not found', 404);
      return;
    }

    notification.deletedAt = new Date();
    await notification.save();

    if (!notification.isRead) {
      const cacheKey = `notification:unread:${userId}`;
      try {
        const redisClient = getRedisClient();
        await redisClient.del(cacheKey);
      } catch (redisError) {
        logger.warn('Redis delete error:', redisError);
      }
    }

    successResponse(res, null, 'Notification deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete notification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete notification';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get notification preferences
 * @route   GET /api/v1/notifications/preferences
 * @access  Private
 */
export const getNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const user = await User.findById(userId).select('preferences.notifications');

    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    const preferences = user.preferences?.notifications || {
      newContent: true,
      achievements: true,
      reminders: true,
      subscription: true,
    };

    successResponse(
      res,
      { preferences },
      'Notification preferences retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get notification preferences error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get notification preferences';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update notification preferences
 * @route   PUT /api/v1/notifications/preferences
 * @access  Private
 */
export const updateNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const { newContent, achievements, reminders, subscription } = req.body;

    const user = await User.findById(userId);

    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

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

    if (!user.preferences.notifications) {
      user.preferences.notifications = {
        newContent: true,
        achievements: true,
        reminders: true,
        subscription: true,
      };
    }

    if (newContent !== undefined) user.preferences.notifications.newContent = newContent;
    if (achievements !== undefined) user.preferences.notifications.achievements = achievements;
    if (reminders !== undefined) user.preferences.notifications.reminders = reminders;
    if (subscription !== undefined) user.preferences.notifications.subscription = subscription;

    await user.save();

    successResponse(
      res,
      { preferences: user.preferences.notifications },
      'Notification preferences updated successfully'
    );
  } catch (error: unknown) {
    logger.error('Update notification preferences error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update notification preferences';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Register device token for push notifications
 * @route   POST /api/v1/notifications/register-device
 * @access  Private
 */
export const registerDeviceToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { fcmToken, platform, browser } = req.body;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    if (!fcmToken) {
      errorResponse(res, 'FCM token is required', 400);
      return;
    }

    const user = await User.findById(userId);

    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens.findIndex(
      (device) => device.token === fcmToken
    );

    if (existingTokenIndex >= 0) {
      // Update existing token's lastUsedAt
      user.fcmTokens[existingTokenIndex].lastUsedAt = new Date();
      logger.info('FCM token updated:', {
        userId,
        token: fcmToken.substring(0, 20) + '...',
      });
    } else {
      // Add new token
      user.fcmTokens.push({
        token: fcmToken,
        platform: platform || 'web',
        browser: browser || undefined,
        addedAt: new Date(),
        lastUsedAt: new Date(),
      });
      logger.info('New FCM token registered:', {
        userId,
        token: fcmToken.substring(0, 20) + '...',
        platform: platform || 'web',
      });
    }

    await user.save();

    successResponse(
      res,
      {
        message: 'Device token registered successfully',
        tokenCount: user.fcmTokens.length
      },
      'Device token registered successfully'
    );
  } catch (error: unknown) {
    logger.error('Register device token error:', error);
    const message = error instanceof Error ? error.message : 'Failed to register device token';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Send notification to specific user (Admin only)
 * @route   POST /api/v1/notifications/send
 * @access  Private/Admin
 */
export const sendNotificationToUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, type, title, message, data, icon, imageUrl, sendPush } = req.body;

    if (!userId || !type || !title || !message) {
      errorResponse(res, 'userId, type, title, and message are required', 400);
      return;
    }

    const user = await User.findById(userId);
    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Use the notification service which handles both in-app and push notifications
    const notificationData: NotificationData = {
      type,
      title,
      message,
      icon,
      imageUrl,
      data: data || {},
    };

    await createNotification(userId, notificationData, sendPush !== false);

    successResponse(
      res,
      { message: 'Notification sent successfully (in-app and push if enabled)' },
      'Notification sent successfully'
    );
  } catch (error: unknown) {
    logger.error('Send notification to user error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Broadcast notification to all users (Admin only)
 * @route   POST /api/v1/admin/notifications/broadcast
 * @access  Private/Admin
 */
export const broadcastNotification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type, title, message, data, icon, imageUrl, targetUsers, sendPush, subscribersOnly } = req.body;

    if (!type || !title || !message) {
      errorResponse(res, 'type, title, and message are required', 400);
      return;
    }

    let userIds: string[];

    if (targetUsers && Array.isArray(targetUsers) && targetUsers.length > 0) {
      // Send to specific users
      userIds = targetUsers;
    } else if (subscribersOnly) {
      // Send to active subscribers only
      const users = await User.find({
        deletedAt: null,
        'subscription.status': 'active'
      }).select('_id');
      userIds = users.map(user => String(user._id));
    } else {
      // Send to all users
      const users = await User.find({ deletedAt: null }).select('_id');
      userIds = users.map(user => String(user._id));
    }

    // Use the notification service which handles both in-app and push notifications
    const notificationData: NotificationData = {
      type,
      title,
      message,
      icon,
      imageUrl,
      data: data || {},
    };

    const count = await createBulkNotifications(userIds, notificationData, sendPush !== false);

    successResponse(
      res,
      { count, userCount: userIds.length, pushSent: sendPush !== false },
      'Notification broadcast successfully'
    );
  } catch (error: unknown) {
    logger.error('Broadcast notification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to broadcast notification';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get users list for notification recipients (Admin only)
 * @route   GET /api/v1/admin/notifications/users
 * @access  Private/Admin
 */
export const getUsersForNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { search } = req.query;
    const query: any = { deletedAt: null };

    if (search && String(search).trim()) {
      query.$or = [
        { name: { $regex: String(search).trim(), $options: 'i' } },
        { email: { $regex: String(search).trim(), $options: 'i' } },
        { phone: { $regex: String(search).trim(), $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('_id name email phone avatar subscription.status')
      .limit(100)
      .lean();

    successResponse(
      res,
      { users, count: users.length },
      'Users retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get users for notifications error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get users';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get tracks list for notification linking (Admin only)
 * @route   GET /api/v1/admin/notifications/tracks
 * @access  Private/Admin
 */
export const getTracksForNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { search } = req.query;
    const query: any = { isActive: true };

    if (search && String(search).trim()) {
      query.title = { $regex: String(search).trim(), $options: 'i' };
    }

    const tracks = await Track.find(query)
      .select('_id title imageUrl category level')
      .populate('category', 'name')
      .limit(100)
      .sort({ createdAt: -1 })
      .lean();

    // Transform category object to string
    const transformedTracks = tracks.map((track: any) => ({
      _id: track._id,
      title: track.title,
      imageUrl: track.imageUrl,
      category: track.category?.name || track.category || '',
      level: track.level,
    }));

    successResponse(
      res,
      { tracks: transformedTracks, count: transformedTracks.length },
      'Tracks retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get tracks for notifications error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get programs list for notification linking (Admin only)
 * @route   GET /api/v1/admin/notifications/programs
 * @access  Private/Admin
 */
export const getProgramsForNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { search } = req.query;
    const query: any = { isActive: true };

    if (search && String(search).trim()) {
      query.title = { $regex: String(search).trim(), $options: 'i' };
    }

    const programs = await Program.find(query)
      .select('_id title thumbnailImages category level')
      .populate('category', 'name')
      .limit(100)
      .sort({ createdAt: -1 })
      .lean();

    // Transform category object to string
    const transformedPrograms = programs.map((program: any) => ({
      _id: program._id,
      title: program.title,
      thumbnailImages: program.thumbnailImages,
      category: program.category?.name || program.category || '',
      level: program.level,
    }));

    successResponse(
      res,
      { programs: transformedPrograms, count: transformedPrograms.length },
      'Programs retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get programs for notifications error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get notification templates (Admin only)
 * @route   GET /api/v1/admin/notifications/templates
 * @access  Private/Admin
 */
export const getNotificationTemplates = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Convert template constants to array format for admin panel
    const templates = Object.entries(NOTIFICATION_TEMPLATES).map(([key, value]) => ({
      id: value,
      name: key.split('_').map((word: string) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' '),
      key: value,
    }));

    successResponse(
      res,
      { templates, count: templates.length },
      'Notification templates retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get notification templates error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get notification templates';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get notification statistics (Admin only)
 * @route   GET /api/v1/admin/notifications/stats
 * @access  Private/Admin
 */
export const getNotificationStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total notifications sent
    const totalNotifications = await NotificationModel.countDocuments({ deletedAt: null });

    // Notifications sent today
    const notificationsToday = await NotificationModel.countDocuments({
      createdAt: { $gte: today },
      deletedAt: null,
    });

    // Notifications sent in last 30 days
    const notificationsLast30Days = await NotificationModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      deletedAt: null,
    });

    // Notifications by type
    const notificationsByType = await NotificationModel.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Read rate (notifications read vs unread)
    const totalRead = await NotificationModel.countDocuments({ isRead: true, deletedAt: null });
    const readRate = totalNotifications > 0 ? (totalRead / totalNotifications) * 100 : 0;

    // Notifications per day (last 30 days)
    const notificationsPerDay = await NotificationModel.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // FCM token statistics
    const fcmStats = await getFCMTokenStats();

    // Push notification opt-in rate
    const pushOptInRate = fcmStats.totalUsers > 0
      ? (fcmStats.usersWithTokens / fcmStats.totalUsers) * 100
      : 0;

    successResponse(
      res,
      {
        totalNotifications,
        notificationsToday,
        notificationsLast30Days,
        notificationsByType,
        readRate: Math.round(readRate * 100) / 100,
        notificationsPerDay,
        fcmStats: {
          ...fcmStats,
          pushOptInRate: Math.round(pushOptInRate * 100) / 100,
        },
      },
      'Notification statistics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get notification stats error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get notification statistics';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get notification history/requests (Admin only)
 * @route   GET /api/v1/admin/notifications/history
 * @access  Private/Admin
 */
export const getNotificationHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const type = req.query.type as string;

    // Build query
    const query: any = { deletedAt: null };
    if (type && type !== 'all') {
      query.type = type;
    }

    // Get notifications with user details
    const notifications = await NotificationModel.find(query)
      .populate('userId', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await NotificationModel.countDocuments(query);

    // Group notifications by broadcast batches (same title, message, and created within 5 seconds)
    const groupedNotifications: any[] = [];
    const processedIds = new Set();

    for (const notification of notifications) {
      if (processedIds.has(notification._id.toString())) continue;

      // Check if this is part of a broadcast (multiple notifications with same title/message)
      const broadcastCount = await NotificationModel.countDocuments({
        title: notification.title,
        message: notification.message,
        createdAt: {
          $gte: new Date(notification.createdAt.getTime() - 5000),
          $lte: new Date(notification.createdAt.getTime() + 5000),
        },
        deletedAt: null,
      });

      if (broadcastCount > 1) {
        // This is a broadcast notification
        const recipients = await NotificationModel.find({
          title: notification.title,
          message: notification.message,
          createdAt: {
            $gte: new Date(notification.createdAt.getTime() - 5000),
            $lte: new Date(notification.createdAt.getTime() + 5000),
          },
          deletedAt: null,
        })
          .populate('userId', 'name')
          .limit(5)
          .lean();

        recipients.forEach((n: any) => processedIds.add(n._id.toString()));

        groupedNotifications.push({
          ...notification,
          isBroadcast: true,
          recipientCount: broadcastCount,
          sampleRecipients: recipients.map((r: any) => ({
            _id: r.userId?._id,
            name: r.userId?.name || 'مستخدم محذوف',
          })),
        });
      } else {
        // Single notification
        processedIds.add(notification._id.toString());
        groupedNotifications.push({
          ...notification,
          isBroadcast: false,
          recipientCount: 1,
          recipient: notification.userId ? {
            _id: (notification.userId as any)._id,
            name: (notification.userId as any).name || 'مستخدم محذوف',
            email: (notification.userId as any).email,
            phone: (notification.userId as any).phone,
            avatar: (notification.userId as any).avatar,
          } : null,
        });
      }
    }

    successResponse(
      res,
      {
        notifications: groupedNotifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Notification history retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get notification history error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get notification history';
    errorResponse(res, message, 500);
  }
};
