import { Router } from 'express';
import {
  startListeningSession,
  updateListeningSession,
  endListeningSession,
  getListeningStats,
} from '../controllers/listeningSessions.controller';
import {
  validateStartSession,
  validateUpdateSession,
  validateEndSession,
  validateGetListeningStats,
} from '../validators/listeningSessions.validator';
import { protect } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * All routes require authentication
 */

// Start listening session
router.post(
  '/',
  protect,
  validateStartSession,
  asyncHandler(startListeningSession)
);

// Update listening session position
router.put(
  '/:sessionId',
  protect,
  validateUpdateSession,
  asyncHandler(updateListeningSession)
);

// End listening session
router.post(
  '/:sessionId/end',
  protect,
  validateEndSession,
  asyncHandler(endListeningSession)
);

// Get listening statistics
router.get(
  '/stats',
  protect,
  validateGetListeningStats,
  asyncHandler(getListeningStats)
);

export default router;
