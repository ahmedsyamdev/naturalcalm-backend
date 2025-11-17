import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';
import logger from '../utils/logger';

/**
 * Cloudflare R2 Client Configuration
 * R2 is S3-compatible, so we use the AWS SDK with a custom endpoint
 */

// Check if R2 is configured
export const isR2Configured = (): boolean => {
  return !!(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
  );
};

// Create R2 client instance
let r2Client: S3Client | null = null;

export const getR2Client = (): S3Client => {
  if (!isR2Configured()) {
    throw new Error(
      'R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env'
    );
  }

  if (!r2Client) {
    const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    r2Client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });

    logger.info('R2 client initialized successfully');
  }

  return r2Client;
};

// Get R2 bucket name
export const getR2BucketName = (): string => {
  if (!env.R2_BUCKET_NAME) {
    throw new Error('R2_BUCKET_NAME is not configured');
  }
  return env.R2_BUCKET_NAME;
};

// Get R2 public URL
export const getR2PublicUrl = (): string => {
  if (!env.R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL is not configured');
  }
  return env.R2_PUBLIC_URL;
};

// Construct public URL for a file key
export const getFileUrl = (key: string): string => {
  const publicUrl = getR2PublicUrl();
  return `${publicUrl}/${key}`;
};
