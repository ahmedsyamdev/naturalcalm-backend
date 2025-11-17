import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { getUserListeningPatterns, updateUserListeningPatterns } from '../utils/listeningStats';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/users/me
 * @access  Private
 */
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Find user and exclude sensitive fields
    const user = await User.findById(userId)
      .select('-password -otp')
      .populate('preferences.categories', 'name nameAr emoji');

    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Return user profile
    const userResponse = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      role: user.role,
      subscription: user.subscription,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    successResponse(res, { user: userResponse }, 'User profile retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get current user error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get user profile';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update current user profile
 * @route   PUT /api/v1/users/me
 * @access  Private
 */
export const updateCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Find user
    const user = await User.findById(userId);

    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Fields that can be updated
    const { name, email, avatar, preferences } = req.body;

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;
    if (preferences !== undefined) {
      // Update preferences while maintaining structure
      if (preferences.categories)
        user.preferences.categories = preferences.categories;
      if (preferences.notifications) {
        user.preferences.notifications = {
          ...user.preferences.notifications,
          ...preferences.notifications,
        };
      }
    }

    await user.save();

    // Return updated user
    const userResponse = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      role: user.role,
      subscription: user.subscription,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    successResponse(
      res,
      { user: userResponse },
      'Profile updated successfully'
    );
  } catch (error: unknown) {
    logger.error('Update current user error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user listening patterns
 * @route   GET /api/v1/users/listening-patterns
 * @access  Private
 */
export const getListeningPatterns = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Get listening patterns
    const patterns = await getUserListeningPatterns(userId);

    // Update user preferences with patterns (fire and forget)
    updateUserListeningPatterns(userId).catch((error) => {
      logger.error('Failed to update user listening patterns in preferences:', error);
    });

    successResponse(
      res,
      patterns,
      'Listening patterns retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get listening patterns error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve listening patterns';
    errorResponse(res, message, 500);
  }
};
