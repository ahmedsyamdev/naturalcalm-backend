import { Router } from 'express';
import {
  getFavoriteTracks,
  getFavoritePrograms,
  addTrackToFavorites,
  removeTrackFromFavorites,
  addProgramToFavorites,
  removeProgramFromFavorites,
  getFavoriteCounts,
} from '../controllers/favorites.controller';
import { protect } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * All routes are protected (require authentication)
 */

// Get favorite counts
router.get('/count', protect, asyncHandler(getFavoriteCounts));

// Get user's favorite tracks
router.get('/tracks', protect, asyncHandler(getFavoriteTracks));

// Get user's favorite programs
router.get('/programs', protect, asyncHandler(getFavoritePrograms));

// Add track to favorites
router.post('/tracks/:trackId', protect, asyncHandler(addTrackToFavorites));

// Remove track from favorites
router.delete(
  '/tracks/:trackId',
  protect,
  asyncHandler(removeTrackFromFavorites)
);

// Add program to favorites
router.post('/programs/:programId', protect, asyncHandler(addProgramToFavorites));

// Remove program from favorites
router.delete(
  '/programs/:programId',
  protect,
  asyncHandler(removeProgramFromFavorites)
);

export default router;
