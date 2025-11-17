import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Track, ITrack } from '../models/Track.model';
import { Category } from '../models/Category.model';
import { UserFavorite } from '../models/UserFavorite.model';
import { UserProgram } from '../models/UserProgram.model';
import { User } from '../models/User.model';
import { cacheDelPattern } from '../config/redis';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { createBulkNotifications } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * @desc    Get all tracks with admin filters
 * @route   GET /api/v1/admin/tracks
 * @access  Private/Admin
 */
export const getAllTracks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      level,
      isPremium,
      isActive,
      page = '1',
      limit = '10',
    } = req.query;

    // Build query
    const query: FilterQuery<ITrack> = {};

    if (search && String(search).trim()) {
      query.$or = [
        { title: { $regex: String(search).trim(), $options: 'i' } },
        { description: { $regex: String(search).trim(), $options: 'i' } },
      ];
    }

    // If filtering by category name, convert to ObjectId
    if (category && String(category).trim()) {
      const categoryDoc = await Category.findOne({ name: String(category).trim() });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    if (level && String(level).trim()) query.level = String(level).trim();
    if (isPremium !== undefined && isPremium !== '') query.isPremium = isPremium === 'true';
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Pagination
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [tracks, total] = await Promise.all([
      Track.find(query)
        .populate('category', 'name icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-deletedAt'),
      Track.countDocuments(query),
    ]);

    const response = {
      tracks,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    };

    successResponse(res, response, 'Tracks retrieved successfully');
  } catch (error: unknown) {
    logger.error('Admin get all tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get track by ID
 * @route   GET /api/v1/admin/tracks/:id
 * @access  Private/Admin
 */
export const getTrackById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const track = await Track.findById(id).populate('category', 'name icon');
    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    successResponse(res, track, 'Track retrieved successfully');
  } catch (error: unknown) {
    logger.error('Admin get track by ID error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new track
 * @route   POST /api/v1/admin/tracks
 * @access  Private/Admin
 */
export const createTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      level,
      relaxationType,
      imageUrl,
      audioUrl,
      duration,
      durationSeconds,
      isPremium = false,
      contentAccess,
      isActive = true,
    } = req.body;

    // Find category by name to get ObjectId
    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Determine content access level and sync with isPremium
    let finalContentAccess: 'free' | 'basic' | 'premium' = 'free';
    let finalIsPremium = false;

    if (contentAccess) {
      finalContentAccess = contentAccess;
      // Sync isPremium with contentAccess for backward compatibility
      finalIsPremium = contentAccess === 'premium';
    } else if (isPremium) {
      finalContentAccess = 'premium';
      finalIsPremium = true;
    }

    // Accept either durationSeconds or duration field
    const finalDuration = durationSeconds || duration || 0;

    const track = await Track.create({
      title,
      description,
      category: categoryDoc._id,
      level,
      relaxationType,
      imageUrl,
      audioUrl,
      durationSeconds: finalDuration,
      playCount: 0,
      isPremium: finalIsPremium,
      contentAccess: finalContentAccess,
      isActive,
    });

    await track.populate('category', 'name icon');

    // Clear tracks cache
    await cacheDelPattern('tracks:*');

    logger.info(`Track created: ${track.title} by admin ${req.user?.id}`);

    // Send automated notification to all users (async, don't wait)
    if (isActive) {
      setImmediate(async () => {
        try {
          const users = await User.find({ deletedAt: null }).select('_id');
          const userIds = users.map(u => String(u._id));

          const notificationTemplate = getNotificationTemplate(NOTIFICATION_TEMPLATES.NEW_TRACK, {
            trackNameAr: track.title,
            trackName: track.title,
          });

          if (notificationTemplate && userIds.length > 0) {
            // Add deep link data for navigation
            notificationTemplate.data = {
              ...notificationTemplate.data,
              trackId: String(track._id),
              action: 'view_track',
              deepLink: `/player/${track._id}`,
            };

            await createBulkNotifications(userIds, notificationTemplate, true);
            logger.info(`Sent new track notification to ${userIds.length} users for track: ${track.title}`);
          }
        } catch (error) {
          logger.error('Failed to send new track notification:', error);
        }
      });
    }

    successResponse(res, track, 'Track created successfully', 201);
  } catch (error: unknown) {
    logger.error('Create track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update track
 * @route   PUT /api/v1/admin/tracks/:id
 * @access  Private/Admin
 */
export const updateTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      level,
      relaxationType,
      imageUrl,
      audioUrl,
      duration,
      durationSeconds,
      isPremium,
      contentAccess,
      isActive,
    } = req.body;

    const track = await Track.findById(id);
    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Update fields
    if (title !== undefined) track.title = title;
    if (description !== undefined) track.description = description;

    // If updating category, convert name to ObjectId
    if (category !== undefined) {
      const categoryDoc = await Category.findOne({ name: category });
      if (!categoryDoc) {
        errorResponse(res, 'Category not found', 404);
        return;
      }
      track.category = categoryDoc._id as any;
    }

    if (level !== undefined) track.level = level;
    if (relaxationType !== undefined) track.relaxationType = relaxationType;
    if (imageUrl !== undefined) track.imageUrl = imageUrl;
    if (audioUrl !== undefined) track.audioUrl = audioUrl;

    // Accept either durationSeconds or duration field
    if (durationSeconds !== undefined) {
      track.durationSeconds = durationSeconds;
    } else if (duration !== undefined) {
      track.durationSeconds = duration;
    }

    // Update content access and sync with isPremium
    if (contentAccess !== undefined) {
      track.contentAccess = contentAccess;
      // Sync isPremium with contentAccess for backward compatibility
      track.isPremium = contentAccess === 'premium';
    } else if (isPremium !== undefined) {
      // For backward compatibility, update contentAccess based on isPremium
      track.contentAccess = isPremium ? 'premium' : 'free';
      track.isPremium = isPremium;
    }

    if (isActive !== undefined) track.isActive = isActive;

    await track.save();
    await track.populate('category', 'name icon');

    // Clear tracks cache
    await cacheDelPattern('tracks:*');

    logger.info(`Track updated: ${track.title} by admin ${req.user?.id}`);
    successResponse(res, track, 'Track updated successfully');
  } catch (error: unknown) {
    logger.error('Update track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete track
 * @route   DELETE /api/v1/admin/tracks/:id
 * @access  Private/Admin
 */
export const deleteTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const track = await Track.findById(id);
    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Remove track from all user favorites
    await UserFavorite.updateMany(
      { trackIds: id },
      { $pull: { trackIds: id } }
    );

    // Remove track from all user program enrollments
    await UserProgram.updateMany(
      {},
      { $pull: { completedTracks: id, tracks: id } }
    );

    await track.deleteOne();

    // Clear cache
    await cacheDelPattern('tracks:*');
    await cacheDelPattern('favorites:*');

    logger.info(`Track deleted: ${track.title} by admin ${req.user?.id}`);
    successResponse(res, null, 'Track deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete track';
    errorResponse(res, message, 500);
  }
};
