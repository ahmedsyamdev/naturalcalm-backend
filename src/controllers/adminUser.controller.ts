import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { Subscription } from '../models/Subscription.model';
import { UserProgram } from '../models/UserProgram.model';
import { UserFavorite } from '../models/UserFavorite.model';
import { ListeningSession } from '../models/ListeningSession.model';
import { Notification } from '../models/Notification.model';
import { Payment } from '../models/Payment.model';
import { Package } from '../models/Package.model';
import logger from '../utils/logger';
import { Parser } from 'json2csv';

/**
 * List all users with filters and pagination
 * GET /api/v1/admin/users
 */
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      role,
      isVerified,
      hasSubscription,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, unknown> = { deletedAt: null };

    // Search by name, phone, or email
    if (search && typeof search === 'string') {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by role
    if (role && (role === 'user' || role === 'admin')) {
      query.role = role;
    }

    // Filter by verification status
    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    // Filter by subscription status
    if (hasSubscription !== undefined) {
      if (hasSubscription === 'true') {
        query['subscription.status'] = 'active';
      } else {
        query['subscription.status'] = { $ne: 'active' };
      }
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -otp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

/**
 * Get user details with statistics
 * GET /api/v1/admin/users/:userId
 */
export const getUserDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Get user with subscription details
    const user = await User.findOne({ _id: userId, deletedAt: null })
      .select('-password -otp')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get subscription
    const subscription = await Subscription.findOne({ userId })
      .populate('packageId')
      .lean();

    // Get user statistics
    const [totalListeningTime, favoritesCount, enrolledPrograms, payments] =
      await Promise.all([
        ListeningSession.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: '$duration' } } },
        ]),
        UserFavorite.countDocuments({ userId }),
        UserProgram.countDocuments({ userId }),
        Payment.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      ]);

    const stats = {
      totalListeningTime:
        totalListeningTime.length > 0 ? totalListeningTime[0].total : 0,
      favoritesCount,
      enrolledPrograms,
      totalPayments: payments.length,
    };

    res.status(200).json({
      success: true,
      data: {
        user,
        subscription,
        stats,
        recentPayments: payments,
      },
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
    });
  }
};

/**
 * Update user
 * PUT /api/v1/admin/users/:userId
 */
export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Fields that can be updated
    const allowedFields = [
      'name',
      'email',
      'phone',
      'role',
      'isVerified',
      'avatar',
    ];

    // Filter update data to only allowed fields
    const filteredData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
      return;
    }

    // Update user
    const user = await User.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: filteredData },
      { new: true, runValidators: true }
    ).select('-password -otp');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    logger.info(`Admin ${req.user?.id} updated user ${userId}`);

    res.status(200).json({
      success: true,
      data: { user },
      message: 'User updated successfully',
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
    });
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/v1/admin/users/:userId
 */
export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Prevent deleting admin users (optional)
    if (user.role === 'admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot delete admin users',
      });
      return;
    }

    // Soft delete user
    user.deletedAt = new Date();
    await user.save();

    // Cancel active subscription if exists
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.cancellationDate = new Date();
      await subscription.save();
    }

    // Optionally soft delete related data
    const now = new Date();
    await Promise.all([
      UserFavorite.updateMany({ userId }, { deletedAt: now }),
      UserProgram.updateMany({ userId }, { deletedAt: now }),
      Notification.updateMany({ userId }, { deletedAt: now }),
    ]);

    logger.info(`Admin ${req.user?.id} deleted user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
    });
  }
};

/**
 * Ban user
 * POST /api/v1/admin/users/:userId/ban
 */
export const banUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;

    if (!reason || typeof reason !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Ban reason is required',
      });
      return;
    }

    // Find user
    const user = await User.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Set ban
    user.isBanned = true;
    user.banReason = reason;

    // Set ban duration if provided (in days)
    if (duration && typeof duration === 'number' && duration > 0) {
      const bannedUntil = new Date();
      bannedUntil.setDate(bannedUntil.getDate() + duration);
      user.bannedUntil = bannedUntil;
    }

    await user.save();

    logger.info(
      `Admin ${req.user?.id} banned user ${userId} for reason: ${reason}`
    );

    res.status(200).json({
      success: true,
      message: 'User banned successfully',
      data: {
        isBanned: user.isBanned,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
      },
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban user',
    });
  }
};

/**
 * Unban user
 * POST /api/v1/admin/users/:userId/unban
 */
export const unbanUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    if (!user.isBanned) {
      res.status(400).json({
        success: false,
        message: 'User is not banned',
      });
      return;
    }

    // Remove ban
    user.isBanned = false;
    user.bannedUntil = undefined;
    user.banReason = undefined;

    await user.save();

    logger.info(`Admin ${req.user?.id} unbanned user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'User unbanned successfully',
    });
  } catch (error) {
    logger.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban user',
    });
  }
};

/**
 * Manually grant subscription to user
 * POST /api/v1/admin/users/:userId/grant-subscription
 */
export const grantSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { packageId, durationDays } = req.body;

    if (!packageId || !durationDays) {
      res.status(400).json({
        success: false,
        message: 'Package ID and duration (in days) are required',
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if package exists
    const packageDoc = await Package.findById(packageId);

    if (!packageDoc) {
      res.status(404).json({
        success: false,
        message: 'Package not found',
      });
      return;
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(durationDays));

    // Check if user already has a subscription
    let subscription = await Subscription.findOne({ userId });

    if (subscription) {
      // Update existing subscription
      subscription.packageId = packageId;
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.autoRenew = false;
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await Subscription.create({
        userId,
        packageId,
        status: 'active',
        startDate,
        endDate,
        autoRenew: false,
      });
    }

    // Update user's subscription field
    user.subscription.status = 'active';
    user.subscription.packageId = packageId;
    user.subscription.startDate = startDate;
    user.subscription.endDate = endDate;
    await user.save();

    logger.info(
      `Admin ${req.user?.id} granted subscription to user ${userId}`
    );

    res.status(201).json({
      success: true,
      message: 'Subscription granted successfully',
      data: { subscription },
    });
  } catch (error) {
    logger.error('Grant subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant subscription',
    });
  }
};

/**
 * Export user data (GDPR)
 * GET /api/v1/admin/users/:userId/export
 */
export const exportUserData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { format = 'json' } = req.query;

    // Get user
    const user = await User.findOne({ _id: userId })
      .select('-password -otp')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Gather all user data
    const [
      subscription,
      sessions,
      favorites,
      programs,
      payments,
      notifications,
    ] = await Promise.all([
      Subscription.findOne({ userId }).populate('packageId').lean(),
      ListeningSession.find({ userId }).lean(),
      UserFavorite.find({ userId }).lean(),
      UserProgram.find({ userId }).lean(),
      Payment.find({ userId }).lean(),
      Notification.find({ userId }).lean(),
    ]);

    const userData = {
      user,
      subscription,
      sessions,
      favorites,
      programs,
      payments,
      notifications,
      exportedAt: new Date(),
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified version)
      try {
        const fields = [
          'user.name',
          'user.email',
          'user.phone',
          'user.createdAt',
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse([userData]);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="user-${userId}-data.csv"`
        );
        res.status(200).send(csv);
      } catch {
        res.status(500).json({
          success: false,
          message: 'Failed to generate CSV',
        });
      }
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="user-${userId}-data.json"`
      );
      res.status(200).json({
        success: true,
        data: userData,
      });
    }

    logger.info(`Admin ${req.user?.id} exported data for user ${userId}`);
  } catch (error) {
    logger.error('Export user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export user data',
    });
  }
};
