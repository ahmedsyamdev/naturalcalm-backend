import { Router } from 'express';
import {
  getTracks,
  getTrackById,
  createTrack,
  updateTrack,
  deleteTrack,
  getFeaturedTracks,
  getStreamUrl,
  searchTracks,
  getPopularTracksEndpoint,
} from '../controllers/tracks.controller';
import {
  validateCreateTrack,
  validateUpdateTrack,
  validateTrackId,
  validateGetTracks,
  validateSearchTracks,
} from '../validators/tracks.validator';
import { protect, authorize, optionalAuth } from '../middlewares/auth.middleware';
import {
  checkSubscriptionAccess,
  requireSubscriptionForTrack,
} from '../middlewares/subscription.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Public routes
 */

// Get all tracks with filtering and pagination (with optional auth for favorites)
router.get('/', validateGetTracks, optionalAuth, asyncHandler(getTracks));

// Get featured tracks (must be before /:id to avoid conflicts)
router.get('/featured', asyncHandler(getFeaturedTracks));

// Get popular tracks (must be before /:id to avoid conflicts)
router.get('/popular', asyncHandler(getPopularTracksEndpoint));

// Search tracks (must be before /:id to avoid conflicts)
router.get('/search', validateSearchTracks, asyncHandler(searchTracks));

// Get track by ID (with optional auth for favorite check)
router.get('/:id', validateTrackId, optionalAuth, asyncHandler(getTrackById));

/**
 * Protected routes
 */

// Get streaming URL for track (requires authentication and checks premium access)
router.get(
  '/:id/stream',
  validateTrackId,
  protect,
  checkSubscriptionAccess,
  requireSubscriptionForTrack,
  asyncHandler(getStreamUrl)
);

/**
 * Admin-only routes
 */

// Create new track (admin only)
router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateTrack,
  asyncHandler(createTrack)
);

// Update track (admin only)
router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateTrack,
  asyncHandler(updateTrack)
);

// Delete track (admin only)
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateTrackId,
  asyncHandler(deleteTrack)
);

export default router;
