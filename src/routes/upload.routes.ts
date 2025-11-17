import { Router, Request, Response, NextFunction } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import {
  uploadImage as uploadImageMiddleware,
  uploadAudio as uploadAudioMiddleware,
  handleMulterError,
} from '../middlewares/upload.middleware';
import {
  uploadImage,
  uploadAudio,
  deleteFile,
  getSignedUrl,
} from '../controllers/upload.controller';

const router = Router();

/**
 * Wrapper to handle multer errors
 */
const multerErrorHandler = (
  middleware: (req: Request, res: Response, callback: (error?: unknown) => void) => void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (error?: unknown) => {
      if (error) {
        const message = handleMulterError(error, req);
        res.status(400).json({
          success: false,
          message,
        });
        return;
      }
      next();
    });
  };
};

/**
 * @route   POST /api/v1/upload/image
 * @desc    Upload image (track, program, category, avatar)
 * @access  Protected (Admin only)
 */
router.post(
  '/image',
  protect,
  authorize('admin'),
  multerErrorHandler(uploadImageMiddleware),
  uploadImage
);

/**
 * @route   POST /api/v1/upload/audio
 * @desc    Upload audio file for a track
 * @access  Protected (Admin only)
 */
router.post(
  '/audio',
  protect,
  authorize('admin'),
  multerErrorHandler(uploadAudioMiddleware),
  uploadAudio
);

/**
 * @route   DELETE /api/v1/upload/:key
 * @desc    Delete file from R2
 * @access  Protected (Admin only)
 */
router.delete(
  '/:key',
  protect,
  authorize('admin'),
  deleteFile
);

/**
 * @route   GET /api/v1/upload/signed-url/:key
 * @desc    Generate signed URL for private file access
 * @access  Protected (Any authenticated user)
 */
router.get(
  '/signed-url/:key',
  protect,
  getSignedUrl
);

export default router;
