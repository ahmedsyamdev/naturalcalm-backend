import twilio from 'twilio';
import { env } from '../config/env';
import logger from '../utils/logger';

class OTPService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;

  constructor() {
    this.fromNumber = env.TWILIO_PHONE_NUMBER;
  }

  /**
   * Initialize Twilio client lazily
   */
  private getClient(): twilio.Twilio {
    if (!this.client) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
    return this.client;
  }

  /**
   * Generate a 6-digit OTP code
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get OTP expiration time (5 minutes from now)
   */
  getOTPExpiration(): Date {
    return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Check if Twilio is properly configured
   */
  private isTwilioConfigured(): boolean {
    return (
      env.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid' &&
      env.TWILIO_AUTH_TOKEN !== 'your-twilio-auth-token' &&
      env.TWILIO_PHONE_NUMBER !== 'your-twilio-phone-number' &&
      env.TWILIO_ACCOUNT_SID.length > 0 &&
      env.TWILIO_AUTH_TOKEN.length > 0 &&
      env.TWILIO_PHONE_NUMBER.length > 0 &&
      env.TWILIO_ACCOUNT_SID.startsWith('AC') // Twilio Account SIDs must start with AC
    );
  }

  /**
   * Send OTP via SMS using Twilio (or log to console if not configured)
   */
  async sendOTP(phone: string, otp: string): Promise<void> {
    try {
      const message = `رمز التحقق الخاص بك في Naturacalm هو: ${otp}\nصالح لمدة 5 دقائق.`;

      // Check if Twilio is configured
      if (!this.isTwilioConfigured()) {
        // Development mode: Log OTP to console
        logger.info('\n' + '='.repeat(60));
        logger.info('📱 OTP VERIFICATION CODE (Development Mode)');
        logger.info('='.repeat(60));
        logger.info(`📞 Phone: ${phone}`);
        logger.info(`🔐 OTP Code: ${otp}`);
        logger.info(`⏰ Valid for: 5 minutes`);
        logger.info(`💬 Message: ${message}`);
        logger.info('='.repeat(60) + '\n');
        logger.info(`OTP logged for ${phone} (Twilio not configured)`);
        return;
      }

      // Production mode: Send via Twilio
      const client = this.getClient();
      await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phone,
      });

      logger.info(`OTP sent successfully to ${phone}`);
    } catch (error: unknown) {
      logger.error(`Failed to send OTP to ${phone}:`, error);
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify if OTP is valid and not expired
   */
  verifyOTP(storedOTP: string, inputOTP: string, expiresAt: Date): boolean {
    // Check if OTP has expired
    if (new Date() > expiresAt) {
      return false;
    }

    // Check if OTP matches
    return storedOTP === inputOTP;
  }

  /**
   * Check rate limit for OTP requests (stored in user model or Redis)
   * Returns true if rate limit exceeded
   */
  isRateLimited(lastOTPSentAt: Date | undefined): boolean {
    if (!lastOTPSentAt) {
      return false;
    }

    // Allow max 1 OTP per minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    return lastOTPSentAt > oneMinuteAgo;
  }
}

export const otpService = new OTPService();
