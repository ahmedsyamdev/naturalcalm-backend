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
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: boolean;
  API_URL?: string;
  FRONTEND_URL?: string;
  CORS_ORIGINS?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  // Resend Email Configuration
  RESEND_API_KEY?: string;
  // Twilio (optional, for backwards compatibility)
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
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
      REDIS_URL: process.env.REDIS_URL,
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_TLS: process.env.REDIS_TLS === 'true',
      API_URL: process.env.API_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
      // Resend Email Configuration
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      // Twilio (optional)
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
      APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
      APPLE_KEY_ID: process.env.APPLE_KEY_ID,
      APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
      STRIPE_SECRET_KEY: this.validateRequired(
        'STRIPE_SECRET_KEY',
        process.env.STRIPE_SECRET_KEY
      ),
      STRIPE_PUBLISHABLE_KEY: this.validateRequired(
        'STRIPE_PUBLISHABLE_KEY',
        process.env.STRIPE_PUBLISHABLE_KEY
      ),
      STRIPE_WEBHOOK_SECRET: this.validateRequired(
        'STRIPE_WEBHOOK_SECRET',
        process.env.STRIPE_WEBHOOK_SECRET
      ),
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }
}

// Validate and export environment configuration
export const env = EnvValidator.validate();
