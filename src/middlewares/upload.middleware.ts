import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import logger from '../utils/logger';

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  audio: 50 * 1024 * 1024, // 50MB
};

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/x-m4a',
];

/**
 * File filter for images
 */
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`Invalid image type: ${file.mimetype}`);
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      )
    );
  }
};

/**
 * File filter for audio
 */
const audioFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`Invalid audio type: ${file.mimetype}`);
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`
      )
    );
  }
};

/**
 * Multer configuration for image uploads
 * Stores files in memory as Buffer
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMITS.image,
  },
  fileFilter: imageFileFilter,
}).single('file');

/**
 * Multer configuration for audio uploads
 * Stores files in memory as Buffer
 */
export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMITS.audio,
  },
  fileFilter: audioFileFilter,
}).single('file');

/**
 * Error handler for multer errors
 */
export const handleMulterError = (error: unknown, _req: Request): string => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return `File too large. Maximum size: ${
          error.field === 'audio'
            ? FILE_SIZE_LIMITS.audio / (1024 * 1024)
            : FILE_SIZE_LIMITS.image / (1024 * 1024)
        }MB`;
      case 'LIMIT_FILE_COUNT':
        return 'Too many files uploaded';
      case 'LIMIT_UNEXPECTED_FILE':
        return 'Unexpected field name. Use "file" as the field name';
      default:
        return `Upload error: ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : 'File upload failed';
};
