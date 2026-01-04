import { emailService } from './email.service';
import logger from '../utils/logger';

class OTPService {
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
   * Send OTP via Email
   */
  async sendOTP(email: string, otp: string): Promise<void> {
    try {
      await emailService.sendOTPEmail(email, otp);

      logger.info('\n' + '='.repeat(60));
      logger.info('📧 OTP VERIFICATION CODE');
      logger.info('='.repeat(60));
      logger.info(`📬 Email: ${email}`);
      logger.info(`🔐 OTP Code: ${otp}`);
      logger.info(`⏰ Valid for: 5 minutes`);
      logger.info('='.repeat(60) + '\n');
    } catch (error: unknown) {
      logger.error(`Failed to send OTP to ${email}:`, error);
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Send password reset OTP via Email
   */
  async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    try {
      await emailService.sendPasswordResetEmail(email, otp);

      logger.info('\n' + '='.repeat(60));
      logger.info('📧 PASSWORD RESET OTP');
      logger.info('='.repeat(60));
      logger.info(`📬 Email: ${email}`);
      logger.info(`🔐 OTP Code: ${otp}`);
      logger.info(`⏰ Valid for: 5 minutes`);
      logger.info('='.repeat(60) + '\n');
    } catch (error: unknown) {
      logger.error(`Failed to send password reset OTP to ${email}:`, error);
      throw new Error('Failed to send password reset email. Please try again.');
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
