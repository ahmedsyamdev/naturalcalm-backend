import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import logger from './logger';
import { env } from '../config/env';

export interface UploadResult {
  key: string;
  url: string;
  size?: number;
  contentType?: string;
}

// Base upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Public URL base
const getPublicUrl = (key: string): string => {
  const baseUrl = env.API_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${key}`;
};

/**
 * Ensure directory exists, create if it doesn't
 */
const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
};

/**
 * Upload file buffer to local storage
 */
export const uploadToLocal = async (
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> => {
  try {
    const filePath = path.join(UPLOAD_DIR, key);
    const fileDir = path.dirname(filePath);

    // Ensure directory exists
    await ensureDir(fileDir);

    // Write file
    await fs.writeFile(filePath, buffer);

    logger.info(`File uploaded to local storage: ${key}`);

    return {
      key,
      url: getPublicUrl(key),
      size: buffer.length,
      contentType,
    };
  } catch (error) {
    logger.error('Error uploading to local storage:', error);
    throw new Error('Failed to upload file to local storage');
  }
};

/**
 * Delete file from local storage
 */
export const deleteFromLocal = async (key: string): Promise<void> => {
  try {
    const filePath = path.join(UPLOAD_DIR, key);

    await fs.unlink(filePath);

    logger.info(`File deleted from local storage: ${key}`);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      logger.warn(`File not found for deletion: ${key}`);
      return;
    }
    logger.error('Error deleting from local storage:', error);
    throw new Error('Failed to delete file from local storage');
  }
};

/**
 * Check if file exists in local storage
 */
export const fileExistsLocally = async (key: string): Promise<boolean> => {
  try {
    const filePath = path.join(UPLOAD_DIR, key);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Generate signed URL for local file access
 * For local storage, we just return the public URL since files are publicly accessible
 */
export const generateLocalSignedUrl = async (
  key: string,
  _expiresIn: number = 3600
): Promise<string> => {
  return getPublicUrl(key);
};

/**
 * Process and optimize image
 */
export interface ImageProcessOptions {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
}

export const processImage = async (
  buffer: Buffer,
  options: ImageProcessOptions = {}
): Promise<Buffer> => {
  try {
    const {
      width,
      height,
      format = 'webp',
      quality = 80,
    } = options;

    let image = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      image = image.resize(width, height, {
        fit: 'cover',
        position: 'center',
      });
    }

    // Convert to format
    switch (format) {
      case 'jpeg':
        image = image.jpeg({ quality });
        break;
      case 'png':
        image = image.png({ quality });
        break;
      case 'webp':
      default:
        image = image.webp({ quality });
        break;
    }

    return await image.toBuffer();
  } catch (error) {
    logger.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Upload image with processing to local storage
 */
export const uploadImageLocal = async (
  buffer: Buffer,
  category: 'track' | 'program' | 'category' | 'avatar',
  options: ImageProcessOptions = {}
): Promise<UploadResult> => {
  try {
    // Set default dimensions based on category
    const defaults: Record<string, ImageProcessOptions> = {
      track: { width: 400, height: 400, format: 'webp', quality: 85 },
      program: { width: 400, height: 400, format: 'webp', quality: 85 },
      category: { width: 400, height: 400, format: 'webp', quality: 85 },
      avatar: { width: 200, height: 200, format: 'webp', quality: 80 },
    };

    const processOptions = { ...defaults[category], ...options };

    // Process image
    const processedBuffer = await processImage(buffer, processOptions);

    // Generate unique key
    const uuid = randomUUID();
    const format = processOptions.format || 'webp';
    const key = `images/${category}/${uuid}.${format}`;

    // Upload to local storage
    return await uploadToLocal(
      processedBuffer,
      key,
      `image/${format}`
    );
  } catch (error) {
    logger.error('Error uploading image to local storage:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload audio file to local storage
 */
export const uploadAudioLocal = async (
  buffer: Buffer,
  trackId: string,
  contentType: string
): Promise<UploadResult> => {
  try {
    // Generate key for audio file
    const extension = contentType.split('/')[1] || 'mp3';
    const key = `audio/${trackId}.${extension}`;

    // Upload to local storage
    return await uploadToLocal(
      buffer,
      key,
      contentType
    );
  } catch (error) {
    logger.error('Error uploading audio to local storage:', error);
    throw new Error('Failed to upload audio');
  }
};

/**
 * Initialize local storage directory structure
 */
export const initializeLocalStorage = async (): Promise<void> => {
  try {
    await ensureDir(UPLOAD_DIR);
    await ensureDir(path.join(UPLOAD_DIR, 'images', 'track'));
    await ensureDir(path.join(UPLOAD_DIR, 'images', 'program'));
    await ensureDir(path.join(UPLOAD_DIR, 'images', 'category'));
    await ensureDir(path.join(UPLOAD_DIR, 'images', 'avatar'));
    await ensureDir(path.join(UPLOAD_DIR, 'audio'));
    logger.info('Local storage initialized');
  } catch (error) {
    logger.error('Error initializing local storage:', error);
    throw new Error('Failed to initialize local storage');
  }
};
