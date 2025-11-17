import { Request, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Track, ITrack } from '../models/Track.model';
import { UserFavorite } from '../models/UserFavorite.model';
import { User } from '../models/User.model';
import { getR2Client, getR2BucketName } from '../config/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { cacheGet, cacheSet, cacheDelPattern } from '../config/redis';
import { getPopularTracks } from '../utils/listeningStats';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { createBulkNotifications } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * @desc    Get all tracks with filtering and pagination
 * @route   GET /api/v1/tracks
 * @access  Public
 */
export const getTracks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q,
      category,
      level,
      relaxationType,
      isPremium,
      limit = '20',
      page = '1',
    } = req.query;
    const userId = req.user?.id;

    // Build cache key based on query params and user
    const cacheKey = `tracks:list:${JSON.stringify(req.query)}:${userId || 'anonymous'}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving tracks from cache');
      res.status(200).json(cachedData);
      return;
    }

    // Build query
    const query: FilterQuery<ITrack> = { isActive: true };

    // Add text search if query provided
    if (q && String(q).trim()) {
      query.$text = { $search: String(q).trim() };
    }

    if (category) {
      query.category = category as string;
    }

    if (level) {
      query.level = level as string;
    }

    if (relaxationType) {
      query.relaxationType = relaxationType as string;
    }

    if (isPremium !== undefined) {
      query.isPremium = isPremium === 'true';
    }

    // Pagination
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Build projection with text score if searching
    const projection = q ? { score: { $meta: 'textScore' } } : {};

    // Execute query with pagination
    const trackQuery = Track.find(query, projection)
      .populate('category', 'name nameAr emoji')
      .skip(skip)
      .limit(limitNum);

    // Sort by relevance if text search, otherwise by creation date
    if (q) {
      trackQuery.sort({ score: { $meta: 'textScore' } });
    } else {
      trackQuery.sort({ createdAt: -1 });
    }

    const [tracks, total] = await Promise.all([
      trackQuery,
      Track.countDocuments(query),
    ]);

    // Check favorites for authenticated users (bulk check to avoid N+1)
    let favoritesMap: Record<string, boolean> = {};
    if (userId && tracks.length > 0) {
      const trackIds = tracks
        .map((track) => {
          try {
            return track._id ? String(track._id) : '';
          } catch {
            return '';
          }
        })
        .filter((id) => id);
      favoritesMap = await UserFavorite.checkMultipleFavorites(
        userId,
        trackIds,
        'track'
      );
    }

    // Add isFavorite field to each track
    const tracksWithFavorites = tracks.map((track) => {
      let trackIdString = '';
      try {
        trackIdString = track._id ? String(track._id) : '';
      } catch {
        trackIdString = '';
      }
      return {
        ...track.toObject(),
        isFavorite: userId && trackIdString ? favoritesMap[trackIdString] || false : false,
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    const response = {
      success: true,
      message: 'Tracks retrieved successfully',
      data: tracksWithFavorites,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    // Cache the response for 5 minutes
    await cacheSet(cacheKey, response, 5 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get track by ID
 * @route   GET /api/v1/tracks/:id
 * @access  Public (with optional auth for favorite check)
 */
export const getTrackById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Build cache key
    const cacheKey = `track:${id}:${userId || 'anonymous'}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info(`Serving track ${id} from cache`);
      res.status(200).json(cachedData);
      return;
    }

    // Find track
    const track = await Track.findOne({ _id: id, isActive: true })
      .populate('category', 'name nameAr emoji');

    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Check if user has favorited this track
    let isFavorite = false;
    if (userId) {
      isFavorite = await UserFavorite.isFavorited(userId, id, 'track');
    }

    const trackWithFavorite = {
      ...track.toObject(),
      isFavorite,
    };

    const response = {
      success: true,
      message: 'Track retrieved successfully',
      data: trackWithFavorite,
    };

    // Cache the response for 5 minutes
    await cacheSet(cacheKey, response, 5 * 60);

    successResponse(res, trackWithFavorite, 'Track retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get track by ID error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new track
 * @route   POST /api/v1/tracks
 * @access  Private (Admin only)
 */
export const createTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      durationSeconds,
      level,
      category,
      relaxationType,
      imageUrl,
      audioUrl,
      audioKey,
      isPremium,
      tags,
    } = req.body;

    // Create track
    const track = await Track.create({
      title,
      description,
      durationSeconds,
      level,
      category,
      relaxationType,
      imageUrl,
      audioUrl,
      audioKey,
      isPremium: isPremium || false,
      tags: tags || [],
    });

    // Populate category
    await track.populate('category', 'name nameAr emoji');

    // Invalidate tracks list cache
    await cacheDelPattern('tracks:list:*');

    // Send notification to all users about new track (async, don't wait)
    setImmediate(async () => {
      try {
        const users = await User.find({ deletedAt: null }).select('_id');
        const userIds = users.map(u => String(u._id));

        const notificationData = getNotificationTemplate(
          NOTIFICATION_TEMPLATES.NEW_TRACK,
          {
            trackName: track.title,
            trackNameAr: track.title,
          }
        );

        if (notificationData && userIds.length > 0) {
          notificationData.data = {
            trackId: String(track._id),
            imageUrl: track.imageUrl,
          };
          await createBulkNotifications(userIds, notificationData);
          logger.info(`New track notification sent to ${userIds.length} users`);
        }
      } catch (error) {
        logger.error('Failed to send new track notification:', error);
      }
    });

    successResponse(
      res,
      track,
      'Track created successfully',
      201
    );
  } catch (error: unknown) {
    logger.error('Create track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update track
 * @route   PUT /api/v1/tracks/:id
 * @access  Private (Admin only)
 */
export const updateTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find and update track
    const track = await Track.findOneAndUpdate(
      { _id: id, isActive: true },
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name nameAr emoji');

    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Invalidate cache
    await Promise.all([
      cacheDelPattern(`track:${id}:*`),
      cacheDelPattern('tracks:list:*'),
      cacheDelPattern('tracks:featured'),
      cacheDelPattern('tracks:search:*'),
    ]);

    successResponse(res, track, 'Track updated successfully');
  } catch (error: unknown) {
    logger.error('Update track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete track (soft delete or hard delete)
 * @route   DELETE /api/v1/tracks/:id
 * @access  Private (Admin only)
 */
export const deleteTrack = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    if (hard === 'true') {
      // Hard delete: Remove from database and R2
      const track = await Track.findById(id);

      if (!track) {
        errorResponse(res, 'Track not found', 404);
        return;
      }

      // Delete audio file from R2 if audioKey exists
      if (track.audioKey) {
        try {
          const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
          const r2Client = getR2Client();
          const bucketName = getR2BucketName();

          await r2Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: track.audioKey,
            })
          );

          logger.info(`Deleted audio file from R2: ${track.audioKey}`);
        } catch (r2Error) {
          logger.error('Failed to delete audio from R2:', r2Error);
          // Continue with database deletion even if R2 deletion fails
        }
      }

      // Delete from database
      await Track.deleteOne({ _id: id });

      // Delete associated favorites
      await UserFavorite.deleteMany({ trackId: id, type: 'track' });

      logger.info(`Hard deleted track: ${id}`);
    } else {
      // Soft delete: Set isActive to false
      const track = await Track.findByIdAndUpdate(
        id,
        { isActive: false, deletedAt: new Date() },
        { new: true }
      );

      if (!track) {
        errorResponse(res, 'Track not found', 404);
        return;
      }

      // Delete associated favorites when soft deleting
      await UserFavorite.deleteMany({ trackId: id, type: 'track' });

      logger.info(`Soft deleted track: ${id}`);
    }

    // Invalidate cache
    await Promise.all([
      cacheDelPattern(`track:${id}:*`),
      cacheDelPattern('tracks:list:*'),
      cacheDelPattern('tracks:featured'),
      cacheDelPattern('tracks:search:*'),
    ]);

    successResponse(res, null, 'Track deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete track error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete track';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get featured tracks
 * @route   GET /api/v1/tracks/featured
 * @access  Public
 */
export const getFeaturedTracks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = 'tracks:featured';

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving featured tracks from cache');
      res.status(200).json(cachedData);
      return;
    }

    // Get most played tracks (top 10)
    const tracks = await Track.find({ isActive: true })
      .populate('category', 'name nameAr emoji')
      .sort({ playCount: -1 })
      .limit(10);

    const response = {
      success: true,
      message: 'Featured tracks retrieved successfully',
      data: tracks,
    };

    // Cache for 10 minutes
    await cacheSet(cacheKey, response, 10 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get featured tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve featured tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get streaming URL for track
 * @route   GET /api/v1/tracks/:id/stream
 * @access  Private
 */
export const getStreamUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Find track
    const track = await Track.findOne({ _id: id, isActive: true });

    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Generate signed URL for R2 (1 hour expiration)
    let streamUrl: string;
    const expiresIn = 3600; // 1 hour in seconds

    if (track.audioKey) {
      // Generate signed URL from R2
      try {
        const r2Client = getR2Client();
        const bucketName = getR2BucketName();

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: track.audioKey,
        });

        streamUrl = await getSignedUrl(r2Client, command, { expiresIn });
      } catch (r2Error) {
        logger.error('Failed to generate signed URL:', r2Error);
        errorResponse(res, 'Failed to generate streaming URL', 500);
        return;
      }
    } else {
      // Use direct audioUrl if no audioKey
      streamUrl = track.audioUrl;
    }

    // Increment play count asynchronously (don't await)
    track.incrementPlayCount().catch((err) => {
      logger.error('Failed to increment play count:', err);
    });

    successResponse(
      res,
      {
        url: streamUrl,
        expiresIn,
      },
      'Streaming URL generated successfully'
    );
  } catch (error: unknown) {
    logger.error('Get stream URL error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate streaming URL';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Search tracks
 * @route   GET /api/v1/tracks/search
 * @access  Public
 */
export const searchTracks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, level } = req.query;

    // Build cache key
    const cacheKey = `tracks:search:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving search results from cache');
      res.status(200).json(cachedData);
      return;
    }

    // Build query
    const query: FilterQuery<ITrack> = {
      isActive: true,
      $text: { $search: q as string },
    };

    if (category) {
      query.category = category;
    }

    if (level) {
      query.level = level;
    }

    // Execute search
    const tracks = await Track.find(query)
      .populate('category', 'name nameAr emoji')
      .select('+score')
      .sort({ score: { $meta: 'textScore' } })
      .limit(50);

    const response = {
      success: true,
      message: 'Search completed successfully',
      data: tracks,
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, response, 5 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Search tracks error:', error);
    const message = error instanceof Error ? error.message : 'Search failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get popular tracks based on listening sessions
 * @route   GET /api/v1/tracks/popular
 * @access  Public
 */
export const getPopularTracksEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { days = '7', limit = '10' } = req.query;

    // Build cache key
    const cacheKey = `tracks:popular:${days}:${limit}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving popular tracks from cache');
      res.status(200).json(cachedData);
      return;
    }

    // Get popular tracks from listening sessions
    const popularTrackIds = await getPopularTracks(
      parseInt(days as string),
      parseInt(limit as string)
    );

    // Fetch full track details
    const trackIds = popularTrackIds.map(item => item.trackId);
    const tracks = await Track.find({ _id: { $in: trackIds }, isActive: true })
      .populate('category', 'name nameAr emoji');

    // Map tracks with their popularity stats
    const tracksWithStats = tracks.map(track => {
      const stats = popularTrackIds.find(
        item => item.trackId.toString() === (track._id as Types.ObjectId).toString()
      );
      return {
        ...track.toObject(),
        playCount: stats?.playCount || 0,
        uniqueListeners: stats?.uniqueListeners || 0,
      };
    });

    // Sort by play count
    tracksWithStats.sort((a, b) => b.playCount - a.playCount);

    const response = {
      success: true,
      message: 'Popular tracks retrieved successfully',
      data: tracksWithStats,
    };

    // Cache for 30 minutes
    await cacheSet(cacheKey, response, 30 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get popular tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve popular tracks';
    errorResponse(res, message, 500);
  }
};
