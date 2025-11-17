import { Request, Response } from 'express';
import { Category } from '../models/Category.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import { FilterQuery } from 'mongoose';
import { cacheGet, cacheSet, cacheDelPattern } from '../config/redis';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * @desc    Get all active categories
 * @route   GET /api/v1/categories
 * @access  Public
 */
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'categories:all';

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Serving categories from cache');
      res.status(200).json(cachedData);
      return;
    }

    // Query all active categories sorted by displayOrder
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .select('-deletedAt');

    const response = {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    };

    // Cache for 10 minutes (categories rarely change)
    await cacheSet(cacheKey, response, 10 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get all categories error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve categories';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get category by ID
 * @route   GET /api/v1/categories/:id
 * @access  Public
 */
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = `category:${id}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info(`Serving category ${id} from cache`);
      res.status(200).json(cachedData);
      return;
    }

    // Find category by ID
    const category = await Category.findOne({ _id: id, isActive: true })
      .select('-deletedAt');

    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    const response = {
      success: true,
      message: 'Category retrieved successfully',
      data: category,
    };

    // Cache for 10 minutes
    await cacheSet(cacheKey, response, 10 * 60);

    successResponse(res, category, 'Category retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get category by ID error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get tracks by category
 * @route   GET /api/v1/categories/:id/tracks
 * @access  Public
 */
export const getTracksByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      level,
      isPremium,
      limit = '20',
      page = '1',
    } = req.query;

    // Build cache key based on query params
    const cacheKey = `category:${id}:tracks:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info(`Serving category ${id} tracks from cache`);
      res.status(200).json(cachedData);
      return;
    }

    // Verify category exists
    const category = await Category.findOne({ _id: id, isActive: true });
    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Build query
    const query: FilterQuery<typeof Track> = {
      category: id,
      isActive: true,
    };

    if (level) {
      query.level = level as string;
    }

    if (isPremium !== undefined) {
      query.isPremium = isPremium === 'true';
    }

    // Pagination
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [tracks, total] = await Promise.all([
      Track.find(query)
        .populate('category', 'name nameEn icon color imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Track.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response = {
      success: true,
      message: 'Tracks retrieved successfully',
      data: tracks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, response, 5 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get tracks by category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get programs by category
 * @route   GET /api/v1/categories/:id/programs
 * @access  Public
 */
export const getProgramsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      level,
      isPremium,
      limit = '20',
      page = '1',
    } = req.query;

    // Build cache key based on query params
    const cacheKey = `category:${id}:programs:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info(`Serving category ${id} programs from cache`);
      res.status(200).json(cachedData);
      return;
    }

    // Verify category exists
    const category = await Category.findOne({ _id: id, isActive: true });
    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Build query
    const query: FilterQuery<typeof Program> = {
      category: id,
      isActive: true,
    };

    if (level) {
      query.level = level as string;
    }

    if (isPremium !== undefined) {
      query.isPremium = isPremium === 'true';
    }

    // Pagination
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [programs, total] = await Promise.all([
      Program.find(query)
        .populate('category', 'name nameEn icon color imageUrl')
        .populate('tracks.trackId', 'title imageUrl durationSeconds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Program.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response = {
      success: true,
      message: 'Programs retrieved successfully',
      data: programs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, response, 5 * 60);

    res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('Get programs by category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new category
 * @route   POST /api/v1/categories
 * @access  Private (Admin only)
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      nameEn,
      icon,
      color,
      imageUrl,
      description,
      displayOrder,
    } = req.body;

    // Check for duplicate name
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      errorResponse(res, 'Category with this name already exists', 400);
      return;
    }

    // Create category
    const category = await Category.create({
      name,
      nameEn,
      icon,
      color,
      imageUrl,
      description,
      displayOrder: displayOrder || 0,
      isActive: true,
    });

    // Invalidate categories cache
    await cacheDelPattern('categories:*');

    successResponse(
      res,
      category,
      'Category created successfully',
      201
    );
  } catch (error: unknown) {
    logger.error('Create category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/v1/categories/:id
 * @access  Private (Admin only)
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If name is being updated, check for duplicates
    if (updateData.name) {
      const existingCategory = await Category.findOne({
        name: updateData.name,
        _id: { $ne: id },
      });

      if (existingCategory) {
        errorResponse(res, 'Category with this name already exists', 400);
        return;
      }
    }

    // Find and update category
    const category = await Category.findOneAndUpdate(
      { _id: id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Invalidate cache
    await Promise.all([
      cacheDelPattern(`category:${id}*`),
      cacheDelPattern('categories:*'),
    ]);

    successResponse(res, category, 'Category updated successfully');
  } catch (error: unknown) {
    logger.error('Update category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/v1/categories/:id
 * @access  Private (Admin only)
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    // Check if any tracks use this category
    const tracksCount = await Track.countDocuments({ category: id, isActive: true });
    if (tracksCount > 0) {
      errorResponse(
        res,
        `Cannot delete category. ${tracksCount} active track(s) are using this category`,
        400
      );
      return;
    }

    // Check if any programs use this category
    const programsCount = await Program.countDocuments({ category: id, isActive: true });
    if (programsCount > 0) {
      errorResponse(
        res,
        `Cannot delete category. ${programsCount} active program(s) are using this category`,
        400
      );
      return;
    }

    if (hard === 'true') {
      // Hard delete: Remove from database
      const category = await Category.findByIdAndDelete(id);

      if (!category) {
        errorResponse(res, 'Category not found', 404);
        return;
      }

      logger.info(`Hard deleted category: ${id}`);
    } else {
      // Soft delete: Set isActive to false
      const category = await Category.findByIdAndUpdate(
        id,
        { isActive: false, deletedAt: new Date() },
        { new: true }
      );

      if (!category) {
        errorResponse(res, 'Category not found', 404);
        return;
      }

      logger.info(`Soft deleted category: ${id}`);
    }

    // Invalidate cache
    await Promise.all([
      cacheDelPattern(`category:${id}*`),
      cacheDelPattern('categories:*'),
    ]);

    successResponse(res, null, 'Category deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Reorder categories
 * @route   PUT /api/v1/categories/reorder
 * @access  Private (Admin only)
 */
export const reorderCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      errorResponse(res, 'Categories must be an array', 400);
      return;
    }

    // Update displayOrder for each category
    const updatePromises = categories.map(
      (item: { id: string; displayOrder: number }) =>
        Category.findByIdAndUpdate(
          item.id,
          { displayOrder: item.displayOrder },
          { new: true }
        )
    );

    await Promise.all(updatePromises);

    // Invalidate cache
    await cacheDelPattern('categories:*');

    successResponse(res, null, 'Categories reordered successfully');
  } catch (error: unknown) {
    logger.error('Reorder categories error:', error);
    const message = error instanceof Error ? error.message : 'Failed to reorder categories';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get category statistics
 * @route   GET /api/v1/admin/categories/:id/stats
 * @access  Private (Admin only)
 */
export const getCategoryStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify category exists
    const category = await Category.findById(id);
    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Count tracks and programs
    const [tracksCount, programsCount, topTracks] = await Promise.all([
      Track.countDocuments({ category: id, isActive: true }),
      Program.countDocuments({ category: id, isActive: true }),
      Track.find({ category: id, isActive: true })
        .sort({ playCount: -1 })
        .limit(5)
        .select('title playCount imageUrl durationSeconds'),
    ]);

    const stats = {
      category: {
        id: category._id,
        name: category.name,
        nameEn: category.nameEn,
        icon: category.icon,
      },
      tracksCount,
      programsCount,
      topTracks,
    };

    successResponse(res, stats, 'Category statistics retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get category stats error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve statistics';
    errorResponse(res, message, 500);
  }
};
