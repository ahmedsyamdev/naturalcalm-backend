import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRE: string;
  JWT_REFRESH_EXPIRE: string;
  REDIS_URL: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
}

class EnvValidator {
  private static validateRequired(
    key: string,
    value: string | undefined
  ): string {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  private static validateNumber(
    key: string,
    value: string | undefined
  ): number {
    const validated = this.validateRequired(key, value);
    const parsed = parseInt(validated, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
  }

  static validate(): EnvConfig {
    return {
      NODE_ENV: this.validateRequired('NODE_ENV', process.env.NODE_ENV),
      PORT: this.validateNumber('PORT', process.env.PORT),
      MONGODB_URI: this.validateRequired(
        'MONGODB_URI',
        process.env.MONGODB_URI
      ),
      JWT_SECRET: this.validateRequired('JWT_SECRET', process.env.JWT_SECRET),
      JWT_REFRESH_SECRET: this.validateRequired(
        'JWT_REFRESH_SECRET',
        process.env.JWT_REFRESH_SECRET
      ),
      JWT_EXPIRE: this.validateRequired('JWT_EXPIRE', process.env.JWT_EXPIRE),
      JWT_REFRESH_EXPIRE: this.validateRequired(
        'JWT_REFRESH_EXPIRE',
        process.env.JWT_REFRESH_EXPIRE
      ),
      REDIS_URL: this.validateRequired('REDIS_URL', process.env.REDIS_URL),
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    };
  }
}

// Validate and export environment configuration
export const env = EnvValidator.validate();
