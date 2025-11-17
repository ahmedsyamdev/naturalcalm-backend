import { Router } from 'express';
import {
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramTracks,
  getFeaturedPrograms,
} from '../controllers/programs.controller';
import { getProgramLeaderboard } from '../controllers/userPrograms.controller';
import {
  validateCreateProgram,
  validateUpdateProgram,
  validateProgramId,
  validateGetPrograms,
} from '../validators/programs.validator';
import { protect, authorize, optionalAuth } from '../middlewares/auth.middleware';
import {
  optionalSubscriptionCheck,
  requireSubscriptionForProgram,
} from '../middlewares/subscription.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Public routes
 */

// Get all programs with filtering and pagination (with optional auth for favorites)
router.get('/', validateGetPrograms, optionalAuth, asyncHandler(getPrograms));

// Get featured programs (must be before /:id to avoid conflicts)
router.get('/featured', asyncHandler(getFeaturedPrograms));

// Get program by ID (with optional auth and premium check)
router.get(
  '/:id',
  validateProgramId,
  optionalAuth,
  optionalSubscriptionCheck,
  requireSubscriptionForProgram,
  asyncHandler(getProgramById)
);

// Get program tracks with user progress (with optional auth)
router.get(
  '/:id/tracks',
  validateProgramId,
  optionalAuth,
  asyncHandler(getProgramTracks)
);

// Get program leaderboard (public)
router.get(
  '/:programId/leaderboard',
  asyncHandler(getProgramLeaderboard)
);

/**
 * Admin-only routes
 */

// Create new program (admin only)
router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateProgram,
  asyncHandler(createProgram)
);

// Update program (admin only)
router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateProgram,
  asyncHandler(updateProgram)
);

// Delete program (admin only)
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateProgramId,
  asyncHandler(deleteProgram)
);

export default router;
