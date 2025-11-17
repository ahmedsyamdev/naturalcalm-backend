import { Request, Response } from 'express';
import { Category } from '../models/Category.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import { cacheDelPattern } from '../config/redis';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * @desc    Get all categories (including inactive)
 * @route   GET /api/v1/admin/categories
 * @access  Private/Admin
 */
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('-deletedAt');

    successResponse(res, categories, 'Categories retrieved successfully', 200);
  } catch (error: unknown) {
    logger.error('Admin get all categories error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve categories';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create new category
 * @route   POST /api/v1/admin/categories
 * @access  Private/Admin
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, icon, color, imageUrl, displayOrder, isActive = true } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      errorResponse(res, 'Category with this name already exists', 400);
      return;
    }

    const category = await Category.create({
      name,
      icon,
      color,
      imageUrl,
      displayOrder: displayOrder || 0,
      isActive,
    });

    // Clear categories cache
    await cacheDelPattern('categories:*');

    logger.info(`Category created: ${category.name} by admin ${req.user?.id}`);
    successResponse(res, category, 'Category created successfully', 201);
  } catch (error: unknown) {
    logger.error('Create category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/v1/admin/categories/:id
 * @access  Private/Admin
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, icon, color, imageUrl, displayOrder, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        errorResponse(res, 'Category with this name already exists', 400);
        return;
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (imageUrl !== undefined) category.imageUrl = imageUrl;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    // Clear categories cache
    await cacheDelPattern('categories:*');

    logger.info(`Category updated: ${category.name} by admin ${req.user?.id}`);
    successResponse(res, category, 'Category updated successfully');
  } catch (error: unknown) {
    logger.error('Update category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update category';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/v1/admin/categories/:id
 * @access  Private/Admin
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      errorResponse(res, 'Category not found', 404);
      return;
    }

    // Check if category has associated tracks or programs
    const tracksCount = await Track.countDocuments({ category: category.name });
    const programsCount = await Program.countDocuments({ category: category.name });

    if (tracksCount > 0 || programsCount > 0) {
      errorResponse(
        res,
        `Cannot delete category. It has ${tracksCount} tracks and ${programsCount} programs associated with it`,
        400
      );
      return;
    }

    await category.deleteOne();

    // Clear categories cache
    await cacheDelPattern('categories:*');

    logger.info(`Category deleted: ${category.name} by admin ${req.user?.id}`);
    successResponse(res, null, 'Category deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete category error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete category';
    errorResponse(res, message, 500);
  }
};
