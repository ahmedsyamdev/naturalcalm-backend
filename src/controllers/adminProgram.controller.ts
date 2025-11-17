import { Request, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Program, IProgram } from '../models/Program.model';
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
 * @desc    Get all programs with admin filters
 * @route   GET /api/v1/admin/programs
 * @access  Private/Admin
 */
export const getAllPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      level,
      isPremium,
      isFeatured,
      isActive,
      page = '1',
      limit = '10',
    } = req.query;

    // Build query
    const query: FilterQuery<IProgram> = {};

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
    if (isFeatured !== undefined && isFeatured !== '') query.isFeatured = isFeatured === 'true';
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Pagination
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [programs, total] = await Promise.all([
      Program.find(query)
        .populate('category', 'name icon')
        .populate('tracks.trackId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-deletedAt'),
      Program.countDocuments(query),
    ]);

    const response = {
      programs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    };

    successResponse(res, response, 'Programs retrieved successfully');
  } catch (error: unknown) {
    logger.error('Admin get all programs error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get program by ID
 * @route   GET /api/v1/admin/programs/:id
 * @access  Private/Admin
 */
export const getProgramById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const program = await Program.findById(id)
      .populate('category', 'name icon')
      .populate('tracks.trackId');
    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    successResponse(res, program, 'Program retrieved successfully');
  } catch (error: unknown) {
    logger.error('Admin get program by ID error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new program
 * @route   POST /api/v1/admin/programs
 * @access  Private/Admin
 */
export const createProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      level,
      thumbnailImages,
      trackIds,
      isPremium = false,
      contentAccess,
      isFeatured = false,
      isActive = true,
    } = req.body;

    // Validate trackIds array
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      errorResponse(res, 'At least one track is required', 400);
      return;
    }

    // Validate thumbnailImages array
    if (!thumbnailImages || !Array.isArray(thumbnailImages) || thumbnailImages.length < 1) {
      errorResponse(res, 'At least 1 thumbnail image is required', 400);
      return;
    }

    // Find category by name to get ObjectId
    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Determine content access level
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

    const program = await Program.create({
      title,
      description,
      category: categoryDoc._id,
      level,
      thumbnailUrl: thumbnailImages[0], // Use first image as main thumbnail
      thumbnailImages,
      // Transform trackIds array into proper track objects with order
      tracks: trackIds.map((trackId: string, index: number) => ({
        trackId: new Types.ObjectId(trackId) as any,
        order: index + 1,
      })),
      isPremium: finalIsPremium,
      contentAccess: finalContentAccess,
      isFeatured,
      isActive,
    });

    // Populate category and tracks
    await program.populate('category', 'name icon');
    await program.populate('tracks.trackId');

    // Clear programs cache
    await cacheDelPattern('programs:*');

    logger.info(`Program created: ${program.title} by admin ${req.user?.id}`);

    // Send automated notification to all users (async, don't wait)
    if (isActive) {
      setImmediate(async () => {
        try {
          const users = await User.find({ deletedAt: null }).select('_id');
          const userIds = users.map(u => String(u._id));

          const notificationTemplate = getNotificationTemplate(NOTIFICATION_TEMPLATES.NEW_PROGRAM, {
            programNameAr: program.title,
            programName: program.title,
          });

          if (notificationTemplate && userIds.length > 0) {
            // Add deep link data for navigation
            notificationTemplate.data = {
              ...notificationTemplate.data,
              programId: String(program._id),
              action: 'view_program',
              deepLink: `/program/${program._id}`,
            };

            await createBulkNotifications(userIds, notificationTemplate, true);
            logger.info(`Sent new program notification to ${userIds.length} users for program: ${program.title}`);
          }
        } catch (error) {
          logger.error('Failed to send new program notification:', error);
        }
      });
    }

    successResponse(res, program, 'Program created successfully', 201);
  } catch (error: unknown) {
    logger.error('Create program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update program
 * @route   PUT /api/v1/admin/programs/:id
 * @access  Private/Admin
 */
export const updateProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      level,
      thumbnailImages,
      trackIds,
      isPremium,
      contentAccess,
      isFeatured,
      isActive,
    } = req.body;

    const program = await Program.findById(id);
    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Update fields
    if (title !== undefined) program.title = title;
    if (description !== undefined) program.description = description;

    // If updating category, convert name to ObjectId
    if (category !== undefined) {
      const categoryDoc = await Category.findOne({ name: category });
      if (!categoryDoc) {
        errorResponse(res, 'Category not found', 404);
        return;
      }
      program.category = categoryDoc._id as any;
    }

    if (level !== undefined) program.level = level;
    if (thumbnailImages !== undefined) {
      if (!Array.isArray(thumbnailImages) || thumbnailImages.length < 1) {
        errorResponse(res, 'At least 1 thumbnail image is required', 400);
        return;
      }
      program.thumbnailUrl = thumbnailImages[0]; // Use first image as main thumbnail
      program.thumbnailImages = thumbnailImages;
    }
    if (trackIds !== undefined) {
      if (!Array.isArray(trackIds) || trackIds.length === 0) {
        errorResponse(res, 'At least one track is required', 400);
        return;
      }
      // Transform trackIds array into proper track objects with order
      program.tracks = trackIds.map((trackId: string, index: number) => ({
        trackId: new Types.ObjectId(trackId) as any,
        order: index + 1,
      }));
    }
    // Update content access if provided, or derive from isPremium
    if (contentAccess !== undefined) {
      program.contentAccess = contentAccess;
      // Sync isPremium with contentAccess for backward compatibility
      program.isPremium = contentAccess === 'premium';
    } else if (isPremium !== undefined) {
      // For backward compatibility, update contentAccess based on isPremium
      program.contentAccess = isPremium ? 'premium' : 'free';
      program.isPremium = isPremium;
    }

    if (isFeatured !== undefined) program.isFeatured = isFeatured;
    if (isActive !== undefined) program.isActive = isActive;

    await program.save();
    await program.populate('category', 'name icon');
    await program.populate('tracks.trackId');

    // Clear programs cache
    await cacheDelPattern('programs:*');

    logger.info(`Program updated: ${program.title} by admin ${req.user?.id}`);
    successResponse(res, program, 'Program updated successfully');
  } catch (error: unknown) {
    logger.error('Update program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete program
 * @route   DELETE /api/v1/admin/programs/:id
 * @access  Private/Admin
 */
export const deleteProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const program = await Program.findById(id);
    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Check if program has user enrollments
    const enrollmentCount = await UserProgram.countDocuments({ programId: id });
    if (enrollmentCount > 0) {
      logger.warn(
        `Deleting program ${program.title} with ${enrollmentCount} user enrollments`
      );
    }

    // Remove program from all user favorites
    await UserFavorite.updateMany(
      { programIds: id },
      { $pull: { programIds: id } }
    );

    // Remove all user program enrollments
    await UserProgram.deleteMany({ programId: id });

    await program.deleteOne();

    // Clear cache
    await cacheDelPattern('programs:*');
    await cacheDelPattern('favorites:*');

    logger.info(`Program deleted: ${program.title} by admin ${req.user?.id}`);
    successResponse(res, null, 'Program deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete program';
    errorResponse(res, message, 500);
  }
};
