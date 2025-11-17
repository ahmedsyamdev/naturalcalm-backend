import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { getR2Client, getR2BucketName, getFileUrl } from '../config/r2';
import logger from './logger';

export interface UploadResult {
  key: string;
  url: string;
  size?: number;
  contentType?: string;
}

/**
 * Upload file buffer to R2
 */
export const uploadToR2 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> => {
  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    await client.send(command);

    logger.info(`File uploaded to R2: ${key}`);

    return {
      key,
      url: getFileUrl(key),
      size: buffer.length,
      contentType,
    };
  } catch (error) {
    logger.error('Error uploading to R2:', error);
    throw new Error('Failed to upload file to storage');
  }
};

/**
 * Delete file from R2
 */
export const deleteFromR2 = async (key: string): Promise<void> => {
  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    logger.info(`File deleted from R2: ${key}`);
  } catch (error) {
    logger.error('Error deleting from R2:', error);
    throw new Error('Failed to delete file from storage');
  }
};

/**
 * Check if file exists in R2
 */
export const fileExistsInR2 = async (key: string): Promise<boolean> => {
  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotFound') {
      return false;
    }
    logger.error('Error checking file existence in R2:', error);
    throw new Error('Failed to check file existence');
  }
};

/**
 * Generate signed URL for private file access
 * Default expiration: 1 hour
 */
export const generateSignedUrl = async (
  key: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const client = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    logger.info(`Signed URL generated for: ${key}`);

    return signedUrl;
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
};

/**
 * Generate unique filename with UUID
 */
export const generateUniqueFilename = (
  originalName: string,
  prefix?: string
): string => {
  const extension = originalName.split('.').pop() || '';
  const uuid = randomUUID();
  const filename = prefix ? `${prefix}-${uuid}` : uuid;
  return `${filename}.${extension}`;
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
 * Upload image with processing
 */
export const uploadImage = async (
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

    // Upload to R2
    return await uploadToR2(
      processedBuffer,
      key,
      `image/${format}`,
      { category }
    );
  } catch (error) {
    logger.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload audio file
 */
export const uploadAudio = async (
  buffer: Buffer,
  trackId: string,
  contentType: string
): Promise<UploadResult> => {
  try {
    // Generate key for audio file
    const extension = contentType.split('/')[1] || 'mp3';
    const key = `audio/${trackId}.${extension}`;

    // Upload to R2
    return await uploadToR2(
      buffer,
      key,
      contentType,
      { trackId }
    );
  } catch (error) {
    logger.error('Error uploading audio:', error);
    throw new Error('Failed to upload audio');
  }
};

/**
 * Get audio duration using music-metadata
 * Returns duration in seconds
 */
export const getAudioDuration = async (buffer: Buffer): Promise<number> => {
  try {
    const { parseBuffer } = await import('music-metadata');
    const metadata = await parseBuffer(buffer, { mimeType: 'audio/mpeg' });

    if (metadata.format.duration) {
      return Math.round(metadata.format.duration);
    }

    logger.warn('Could not determine audio duration from metadata');
    return 0;
  } catch (error) {
    logger.error('Error getting audio duration:', error);
    return 0;
  }
};
