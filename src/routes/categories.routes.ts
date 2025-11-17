import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  getTracksByCategory,
  getProgramsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCategoryStats,
} from '../controllers/categories.controller';
import {
  validateCategoryId,
  validateCreateCategory,
  validateUpdateCategory,
  validateGetCategoryContent,
  validateReorderCategories,
} from '../validators/categories.validator';
import { protect, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Public routes
 */

// Get all active categories
router.get('/', asyncHandler(getAllCategories));

/**
 * Admin-only routes (must be before /:id routes to avoid conflicts)
 */

// Reorder categories
router.put(
  '/reorder',
  protect,
  authorize('admin'),
  validateReorderCategories,
  asyncHandler(reorderCategories)
);

// Create new category
router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateCategory,
  asyncHandler(createCategory)
);

/**
 * Public routes with ID parameter
 */

// Get category statistics (admin only, must be before /:id)
router.get(
  '/:id/stats',
  protect,
  authorize('admin'),
  validateCategoryId,
  asyncHandler(getCategoryStats)
);

// Get tracks by category
router.get(
  '/:id/tracks',
  validateGetCategoryContent,
  asyncHandler(getTracksByCategory)
);

// Get programs by category
router.get(
  '/:id/programs',
  validateGetCategoryContent,
  asyncHandler(getProgramsByCategory)
);

// Get category by ID
router.get('/:id', validateCategoryId, asyncHandler(getCategoryById));

/**
 * Admin update/delete routes
 */

// Update category
router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateCategory,
  asyncHandler(updateCategory)
);

// Delete category
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateCategoryId,
  asyncHandler(deleteCategory)
);

export default router;
