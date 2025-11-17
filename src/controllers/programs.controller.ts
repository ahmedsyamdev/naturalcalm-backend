import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Program, IProgram } from '../models/Program.model';
import { UserProgram } from '../models/UserProgram.model';
import { UserFavorite } from '../models/UserFavorite.model';
import { Track, ITrack } from '../models/Track.model';
import { User } from '../models/User.model';
import { cacheGet, cacheSet, cacheDelPattern } from '../config/redis';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { createBulkNotifications } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * @desc    Get all programs with filtering and pagination
 * @route   GET /api/v1/programs
 * @access  Public
 */
export const getPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q,
      category,
      level,
      isPremium,
      isFeatured,
      limit = '20',
      page = '1',
    } = req.query;
    const userId = req.user?.id;

    const cacheKey = `programs:list:${JSON.stringify(req.query)}:${userId || 'anonymous'}`;

    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving programs from cache');
      res.status(200).json(cachedData);
      return;
    }

    const query: FilterQuery<IProgram> = { isActive: true };

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

    if (isPremium !== undefined) {
      query.isPremium = isPremium === 'true';
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Build projection with text score if searching
    const projection = q ? { score: { $meta: 'textScore' } } : {};

    // Execute query with pagination
    const programQuery = Program.find(query, projection)
      .populate('category', 'name nameEn icon color imageUrl')
      .populate('tracks.trackId', 'title imageUrl durationSeconds contentAccess isPremium')
      .skip(skip)
      .limit(limitNum);

    // Sort by relevance if text search, otherwise by creation date
    if (q) {
      programQuery.sort({ score: { $meta: 'textScore' } });
    } else {
      programQuery.sort({ createdAt: -1 });
    }

    const [programs, total] = await Promise.all([
      programQuery,
      Program.countDocuments(query),
    ]);

    // Check favorites for authenticated users (bulk check to avoid N+1)
    let favoritesMap: Record<string, boolean> = {};
    if (userId && programs.length > 0) {
      const programIds = programs.map((program) => {
        try {
          const id = program._id || program.id;
          return id ? String(id) : ''; // Simple String() conversion handles all cases
        } catch {
          return '';
        }
      }).filter(id => id);
      favoritesMap = await UserFavorite.checkMultipleFavorites(
        userId,
        programIds,
        'program'
      );
    }

    // Add isFavorite field to each program
    const programsWithFavorites = programs.map((program) => {
      const programObj = program.toObject ? program.toObject() : program;

      // Filter out tracks with null/undefined trackId (deleted tracks)
      if (programObj.tracks && Array.isArray(programObj.tracks)) {
        programObj.tracks = programObj.tracks.filter((track: any) => track && track.trackId);
      }

      let idString = '';
      try {
        const id = program._id || program.id;
        idString = id ? String(id) : ''; // Simple String() conversion handles all cases
      } catch {
        idString = '';
      }

      return {
        ...programObj,
        isFavorite: userId && idString ? favoritesMap[idString] || false : false,
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    const response = {
      success: true,
      message: 'Programs retrieved successfully',
      data: programsWithFavorites,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    await cacheSet(cacheKey, response, 5 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get programs error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get program by ID
 * @route   GET /api/v1/programs/:id
 * @access  Public (with optional auth for enrollment and favorite check)
 */
export const getProgramById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const cacheKey = `program:${id}:${userId || 'anonymous'}`;

    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info(`Serving program ${id} from cache`);
      res.status(200).json(cachedData);
      return;
    }

    const program = await Program.findOne({ _id: id, isActive: true })
      .populate('category', 'name nameEn icon color imageUrl')
      .populate('tracks.trackId', 'title imageUrl durationSeconds level isPremium contentAccess');

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Convert to object and clean up null references
    const programObj = program.toObject();

    // Filter out tracks with null/undefined trackId (deleted tracks)
    if (programObj.tracks && Array.isArray(programObj.tracks)) {
      programObj.tracks = programObj.tracks.filter((track: any) => track && track.trackId);
    }

    let isEnrolled = false;
    let isFavorite = false;

    if (userId) {
      try {
        const [enrollment, favorite] = await Promise.all([
          UserProgram.findOne({ userId, programId: id }),
          UserFavorite.isFavorited(userId, id, 'program'),
        ]);

        isEnrolled = !!enrollment;
        isFavorite = favorite;
      } catch (favError) {
        logger.error('Error checking enrollment/favorite status:', favError);
        // Continue without favorite/enrollment status rather than failing the whole request
        isEnrolled = false;
        isFavorite = false;
      }
    }

    const programWithStatus = {
      ...programObj,
      isEnrolled,
      isFavorite,
    };

    const response = {
      success: true,
      message: 'Program retrieved successfully',
      data: programWithStatus,
    };

    await cacheSet(cacheKey, response, 5 * 60);

    successResponse(res, programWithStatus, 'Program retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get program by ID error:', error);
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    const message = error instanceof Error ? error.message : 'Failed to retrieve program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new program
 * @route   POST /api/v1/programs
 * @access  Private (Admin only)
 */
export const createProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      level,
      category,
      thumbnailUrl,
      thumbnailImages,
      tracks,
      isPremium,
      isFeatured,
    } = req.body;

    const trackIds = tracks.map((t: { trackId: string }) => t.trackId);
    const existingTracks = await Track.find({ _id: { $in: trackIds }, isActive: true });

    if (existingTracks.length !== trackIds.length) {
      errorResponse(res, 'One or more track IDs are invalid or inactive', 400);
      return;
    }

    const program = await Program.create({
      title,
      description,
      level,
      category,
      thumbnailUrl,
      thumbnailImages: thumbnailImages || [],
      tracks,
      isPremium: isPremium || false,
      isFeatured: isFeatured || false,
    });

    await program.populate([
      { path: 'category', select: 'name nameEn icon color imageUrl' },
      { path: 'tracks.trackId', select: 'title imageUrl durationSeconds contentAccess isPremium' },
    ]);

    await cacheDelPattern('programs:list:*');

    // Send notification to all users about new program (async, don't wait)
    setImmediate(async () => {
      try {
        const users = await User.find({ deletedAt: null }).select('_id');
        const userIds = users.map(u => String(u._id));

        const notificationData = getNotificationTemplate(
          NOTIFICATION_TEMPLATES.NEW_PROGRAM,
          {
            programName: program.title,
            programNameAr: program.title,
          }
        );

        if (notificationData && userIds.length > 0) {
          notificationData.data = {
            programId: String(program._id),
            thumbnailUrl: program.thumbnailUrl,
          };
          await createBulkNotifications(userIds, notificationData);
          logger.info(`New program notification sent to ${userIds.length} users`);
        }
      } catch (error) {
        logger.error('Failed to send new program notification:', error);
      }
    });

    successResponse(res, program, 'Program created successfully', 201);
  } catch (error: unknown) {
    logger.error('Create program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update program
 * @route   PUT /api/v1/programs/:id
 * @access  Private (Admin only)
 */
export const updateProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.tracks) {
      const trackIds = updateData.tracks.map((t: { trackId: string }) => t.trackId);
      const existingTracks = await Track.find({ _id: { $in: trackIds }, isActive: true });

      if (existingTracks.length !== trackIds.length) {
        errorResponse(res, 'One or more track IDs are invalid or inactive', 400);
        return;
      }
    }

    const program = await Program.findOneAndUpdate(
      { _id: id, isActive: true },
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'category', select: 'name nameEn icon color imageUrl' },
      { path: 'tracks.trackId', select: 'title imageUrl durationSeconds contentAccess isPremium' },
    ]);

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    await Promise.all([
      cacheDelPattern(`program:${id}:*`),
      cacheDelPattern('programs:list:*'),
      cacheDelPattern('programs:featured'),
    ]);

    successResponse(res, program, 'Program updated successfully');
  } catch (error: unknown) {
    logger.error('Update program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete program (soft delete or hard delete)
 * @route   DELETE /api/v1/programs/:id
 * @access  Private (Admin only)
 */
export const deleteProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    if (hard === 'true') {
      const program = await Program.findById(id);

      if (!program) {
        errorResponse(res, 'Program not found', 404);
        return;
      }

      const enrollmentCount = await UserProgram.countDocuments({ programId: id });

      if (enrollmentCount > 0) {
        errorResponse(
          res,
          `Cannot hard delete program with ${enrollmentCount} active enrollments. Use soft delete instead.`,
          400
        );
        return;
      }

      await Program.deleteOne({ _id: id });

      // Delete associated favorites
      await UserFavorite.deleteMany({ programId: id, type: 'program' });

      logger.info(`Hard deleted program: ${id}`);
    } else {
      const program = await Program.findByIdAndUpdate(
        id,
        { isActive: false, deletedAt: new Date() },
        { new: true }
      );

      if (!program) {
        errorResponse(res, 'Program not found', 404);
        return;
      }

      // Delete associated favorites when soft deleting
      await UserFavorite.deleteMany({ programId: id, type: 'program' });

      logger.info(`Soft deleted program: ${id}`);
    }

    await Promise.all([
      cacheDelPattern(`program:${id}:*`),
      cacheDelPattern('programs:list:*'),
      cacheDelPattern('programs:featured'),
    ]);

    successResponse(res, null, 'Program deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get program tracks with user progress
 * @route   GET /api/v1/programs/:id/tracks
 * @access  Public (with optional auth for progress tracking)
 */
export const getProgramTracks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const program = await Program.findOne({ _id: id, isActive: true })
      .populate('tracks.trackId');

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    let completedTrackIds: string[] = [];

    if (userId) {
      const userProgram = await UserProgram.findOne({ userId, programId: id });
      if (userProgram) {
        completedTrackIds = userProgram.completedTracks
          .filter((trackId) => trackId) // Filter out null/undefined
          .map((trackId) => {
            try {
              return String(trackId);
            } catch {
              return '';
            }
          })
          .filter((id) => id); // Remove empty strings
      }
    }

    const tracksWithProgress = program.tracks
      .filter((track) => track && track.trackId) // Filter out null/undefined tracks
      .map((track) => {
        const trackDoc = track.trackId as unknown as ITrack;
        let trackIdString = '';
        try {
          trackIdString = trackDoc._id ? String(trackDoc._id) : '';
        } catch {
          trackIdString = '';
        }
        const isCompleted = trackIdString ? completedTrackIds.includes(trackIdString) : false;

        return {
          ...trackDoc.toObject(),
          order: track.order,
          isCompleted,
        };
      });

    tracksWithProgress.sort((a, b) => a.order - b.order);

    successResponse(res, tracksWithProgress, 'Program tracks retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get program tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve program tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get featured programs
 * @route   GET /api/v1/programs/featured
 * @access  Public
 */
export const getFeaturedPrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = 'programs:featured';

    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving featured programs from cache');
      res.status(200).json(cachedData);
      return;
    }

    const programs = await Program.find({ isActive: true, isFeatured: true })
      .populate('category', 'name nameEn icon color imageUrl')
      .populate('tracks.trackId', 'title imageUrl durationSeconds contentAccess isPremium')
      .sort({ playCount: -1 })
      .limit(5)
      .lean();

    if (programs.length === 0) {
      const topPrograms = await Program.find({ isActive: true })
        .populate('category', 'name nameEn icon color imageUrl')
        .populate('tracks.trackId', 'title imageUrl durationSeconds contentAccess isPremium')
        .sort({ playCount: -1 })
        .limit(5)
        .lean();

      const response = {
        success: true,
        message: 'Featured programs retrieved successfully',
        data: topPrograms,
      };

      await cacheSet(cacheKey, response, 10 * 60);

      res.status(200).json(response);
      return;
    }

    const response = {
      success: true,
      message: 'Featured programs retrieved successfully',
      data: programs,
    };

    await cacheSet(cacheKey, response, 10 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get featured programs error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve featured programs';
    errorResponse(res, message, 500);
  }
};
