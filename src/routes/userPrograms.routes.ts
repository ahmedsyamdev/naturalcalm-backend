import { Router } from 'express';
import {
  enrollInProgram,
  getEnrolledPrograms,
  getProgramProgress,
  markTrackComplete,
  getCustomPrograms,
  createCustomProgram,
  updateCustomProgram,
  deleteCustomProgram,
  getCustomProgramById,
  unenrollFromProgram,
} from '../controllers/userPrograms.controller';
import {
  validateProgramId,
  validateTrackId,
  validateCustomProgramId,
  validateCreateCustomProgram,
  validateUpdateCustomProgram,
} from '../validators/userPrograms.validator';
import { protect } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Program Enrollment Routes
 * All routes require authentication
 */

// Enroll in a program
router.post(
  '/programs/:programId/enroll',
  protect,
  validateProgramId,
  asyncHandler(enrollInProgram)
);

// Get all enrolled programs
router.get(
  '/programs',
  protect,
  asyncHandler(getEnrolledPrograms)
);

// Get progress for a specific program
router.get(
  '/programs/:programId/progress',
  protect,
  validateProgramId,
  asyncHandler(getProgramProgress)
);

// Mark a track as complete in a program
router.post(
  '/programs/:programId/tracks/:trackId/complete',
  protect,
  validateProgramId,
  validateTrackId,
  asyncHandler(markTrackComplete)
);

// Unenroll from a program (optional)
router.delete(
  '/programs/:programId/enroll',
  protect,
  validateProgramId,
  asyncHandler(unenrollFromProgram)
);

/**
 * Custom Programs Routes
 * All routes require authentication
 */

// Get all custom programs for the authenticated user
router.get(
  '/programs/custom',
  protect,
  asyncHandler(getCustomPrograms)
);

// Create a new custom program
router.post(
  '/programs/custom',
  protect,
  validateCreateCustomProgram,
  asyncHandler(createCustomProgram)
);

// Get a custom program by ID
router.get(
  '/programs/custom/:id',
  protect,
  validateCustomProgramId,
  asyncHandler(getCustomProgramById)
);

// Update a custom program
router.put(
  '/programs/custom/:id',
  protect,
  validateUpdateCustomProgram,
  asyncHandler(updateCustomProgram)
);

// Delete a custom program
router.delete(
  '/programs/custom/:id',
  protect,
  validateCustomProgramId,
  asyncHandler(deleteCustomProgram)
);

export default router;
