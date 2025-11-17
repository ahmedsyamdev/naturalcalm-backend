import { Request, Response } from 'express';
import {
  uploadImage as uploadImageToR2,
  uploadAudio as uploadAudioToR2,
  deleteFromR2,
  generateSignedUrl,
  getAudioDuration,
} from '../utils/fileUpload';
import {
  uploadImageLocal,
  uploadAudioLocal,
  deleteFromLocal,
  generateLocalSignedUrl,
} from '../utils/localStorage';
import { Track } from '../models/Track.model';
import { Settings } from '../models/Settings.model';
import logger from '../utils/logger';
import { isR2Configured } from '../config/r2';

/**
 * Get current storage type from settings
 */
const getStorageType = async (): Promise<'local' | 'r2'> => {
  try {
    const settings = await Settings.findOne();
    return settings?.storageType || 'local';
  } catch (error) {
    logger.warn('Failed to get storage type from settings, defaulting to local');
    return 'local';
  }
};

/**
 * Upload image endpoint
 * POST /api/v1/upload/image
 */
export const uploadImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Check if file exists
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    // Get category from request body
    const { category } = req.body;

    // Validate category
    const validCategories = ['track', 'program', 'category', 'avatar'];
    if (!category || !validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        message: `Invalid category. Allowed: ${validCategories.join(', ')}`,
      });
      return;
    }

    // Get storage type from settings
    const storageType = await getStorageType();

    // Check if R2 is configured when using R2 storage
    if (storageType === 'r2' && !isR2Configured()) {
      res.status(500).json({
        success: false,
        message: 'R2 storage is selected but not configured. Please configure R2 or switch to local storage.',
      });
      return;
    }

    // Upload image based on storage type
    const result = storageType === 'r2'
      ? await uploadImageToR2(req.file.buffer, category)
      : await uploadImageLocal(req.file.buffer, category);

    logger.info(`Image uploaded successfully to ${storageType}: ${result.key}`);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageUrl: result.url,
        key: result.key,
        size: result.size,
      },
    });
  } catch (error: unknown) {
    logger.error('Upload image error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload image';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Upload audio endpoint
 * POST /api/v1/upload/audio
 */
export const uploadAudio = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Check if file exists
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    // Get trackId from request body (optional)
    const { trackId } = req.body;

    // Get storage type from settings
    const storageType = await getStorageType();

    // Check if R2 is configured when using R2 storage
    if (storageType === 'r2' && !isR2Configured()) {
      res.status(500).json({
        success: false,
        message: 'R2 storage is selected but not configured. Please configure R2 or switch to local storage.',
      });
      return;
    }

    // Get audio duration
    const duration = await getAudioDuration(req.file.buffer);

    // Generate a unique ID for the audio file if no trackId is provided
    const audioId = trackId || `audio-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Upload audio based on storage type
    const result = storageType === 'r2'
      ? await uploadAudioToR2(req.file.buffer, audioId, req.file.mimetype)
      : await uploadAudioLocal(req.file.buffer, audioId, req.file.mimetype);

    // If trackId is provided and track exists, update it
    if (trackId) {
      const track = await Track.findById(trackId);
      if (track) {
        track.audioUrl = result.url;
        track.audioKey = result.key;
        if (duration > 0) {
          track.durationSeconds = duration;
        }
        await track.save();
        logger.info(`Audio uploaded to ${storageType} and track updated for ${trackId}: ${result.key}`);
      } else {
        logger.warn(`Track ${trackId} not found, audio uploaded but track not updated`);
      }
    } else {
      logger.info(`Audio uploaded to ${storageType} without trackId: ${result.key}`);
    }

    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      data: {
        audioUrl: result.url,
        key: result.key,
        size: result.size,
        duration: duration,
        trackId: trackId || null,
      },
    });
  } catch (error: unknown) {
    logger.error('Upload audio error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload audio';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Delete file endpoint
 * DELETE /api/v1/upload/:key
 */
export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get key from params
    const { key } = req.params;

    if (!key) {
      res.status(400).json({
        success: false,
        message: 'File key is required',
      });
      return;
    }

    // Decode the key (it might be URL encoded)
    const decodedKey = decodeURIComponent(key);

    // Get storage type from settings
    const storageType = await getStorageType();

    // Check if R2 is configured when using R2 storage
    if (storageType === 'r2' && !isR2Configured()) {
      res.status(500).json({
        success: false,
        message: 'R2 storage is selected but not configured. Please configure R2 or switch to local storage.',
      });
      return;
    }

    // Delete based on storage type
    if (storageType === 'r2') {
      await deleteFromR2(decodedKey);
    } else {
      await deleteFromLocal(decodedKey);
    }

    logger.info(`File deleted successfully from ${storageType}: ${decodedKey}`);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Delete file error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete file';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Generate signed URL endpoint
 * GET /api/v1/upload/signed-url/:key
 */
export const getSignedUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get key from params
    const { key } = req.params;

    if (!key) {
      res.status(400).json({
        success: false,
        message: 'File key is required',
      });
      return;
    }

    // Get expiration time from query (default 1 hour)
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600;

    // Decode the key
    const decodedKey = decodeURIComponent(key);

    // Get storage type from settings
    const storageType = await getStorageType();

    // Check if R2 is configured when using R2 storage
    if (storageType === 'r2' && !isR2Configured()) {
      res.status(500).json({
        success: false,
        message: 'R2 storage is selected but not configured. Please configure R2 or switch to local storage.',
      });
      return;
    }

    // Generate signed URL based on storage type
    const signedUrl = storageType === 'r2'
      ? await generateSignedUrl(decodedKey, expiresIn)
      : await generateLocalSignedUrl(decodedKey, expiresIn);

    logger.info(`Signed URL generated for ${storageType}: ${decodedKey}`);

    res.status(200).json({
      success: true,
      message: 'Signed URL generated successfully',
      data: {
        signedUrl,
        expiresIn,
        key: decodedKey,
      },
    });
  } catch (error: unknown) {
    logger.error('Generate signed URL error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate signed URL';
    res.status(500).json({
      success: false,
      message,
    });
  }
};
