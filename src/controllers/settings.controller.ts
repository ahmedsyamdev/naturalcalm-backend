import { Request, Response } from 'express';
import { Settings } from '../models/Settings.model';
import { User } from '../models/User.model';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';
import { isR2Configured } from '../config/r2';

/**
 * Get current settings
 * GET /api/v1/admin/settings
 */
export const getSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
      return;
    }

    // Check if R2 is actually configured in environment
    const r2IsConfigured = isR2Configured();

    res.status(200).json({
      success: true,
      data: {
        storageType: settings.storageType,
        adminProfile: settings.adminProfile,
        r2Config: {
          isConfigured: r2IsConfigured,
        },
        localStoragePath: settings.localStoragePath,
      },
    });
  } catch (error: unknown) {
    logger.error('Get settings error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get settings';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Update admin profile
 * PUT /api/v1/admin/settings/profile
 */
export const updateAdminProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
      return;
    }

    const settings = await Settings.findOne();

    if (!settings) {
      res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
      return;
    }

    settings.adminProfile = {
      name,
      email,
      phone: phone || settings.adminProfile.phone,
    };

    await settings.save();

    logger.info(`Admin profile updated: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        adminProfile: settings.adminProfile,
      },
    });
  } catch (error: unknown) {
    logger.error('Update admin profile error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Change admin password
 * PUT /api/v1/admin/settings/password
 */
export const changeAdminPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Get admin user with password
    const admin = await User.findById(userId).select('+password');

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
      return;
    }

    if (admin.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Only admin users can change password',
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await admin.comparePassword(currentPassword);

    if (!isPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    await admin.save();

    logger.info(`Admin password changed: ${admin.email || admin.phone}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: unknown) {
    logger.error('Change admin password error:', error);
    const message = error instanceof Error ? error.message : 'Failed to change password';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Update storage settings
 * PUT /api/v1/admin/settings/storage
 */
export const updateStorageSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storageType } = req.body;

    if (!storageType || !['local', 'r2'].includes(storageType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid storage type. Must be "local" or "r2"',
      });
      return;
    }

    // Check if R2 is configured when trying to switch to R2
    if (storageType === 'r2' && !isR2Configured()) {
      res.status(400).json({
        success: false,
        message: 'R2 is not configured. Please set R2 environment variables in .env file',
      });
      return;
    }

    const settings = await Settings.findOne();

    if (!settings) {
      res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
      return;
    }

    settings.storageType = storageType;
    await settings.save();

    logger.info(`Storage type updated to: ${storageType}`);

    res.status(200).json({
      success: true,
      message: `Storage type updated to ${storageType}`,
      data: {
        storageType: settings.storageType,
      },
    });
  } catch (error: unknown) {
    logger.error('Update storage settings error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update storage settings';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Initialize default settings
 * POST /api/v1/admin/settings/initialize
 */
export const initializeSettings = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    let settings = await Settings.findOne();

    if (settings) {
      res.status(200).json({
        success: true,
        message: 'Settings already initialized',
        data: settings,
      });
      return;
    }

    settings = await Settings.create({
      storageType: 'local',
      adminProfile: {
        name: 'Admin',
        email: 'admin@naturacalm.com',
      },
      localStoragePath: './public/uploads',
    });

    logger.info('Default settings initialized');

    res.status(201).json({
      success: true,
      message: 'Settings initialized successfully',
      data: settings,
    });
  } catch (error: unknown) {
    logger.error('Initialize settings error:', error);
    const message = error instanceof Error ? error.message : 'Failed to initialize settings';
    res.status(500).json({
      success: false,
      message,
    });
  }
};
