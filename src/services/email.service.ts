import { Resend } from 'resend';
import { env } from '../config/env';
import logger from '../utils/logger';

class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string = 'Naturacalm <noreply@naturacalm.site>';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
      logger.info('Resend email service initialized');
    } else {
      logger.warn('RESEND_API_KEY not configured. Email sending will be simulated in development mode.');
    }
  }

  async sendOTPEmail(email: string, otp: string): Promise<void> {
    const subject = 'رمز التحقق - Naturacalm';
    const html = this.getOTPEmailTemplate(otp);

    if (!this.resend) {
      // Development mode - log OTP to console
      logger.info(`[DEV MODE] OTP for ${email}: ${otp}`);
      logger.info(`[DEV MODE] Email would be sent with subject: ${subject}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject,
        html,
      });

      if (error) {
        logger.error('Failed to send OTP email:', error);
        throw new Error('Failed to send verification email');
      }

      logger.info(`OTP email sent to ${email}`);
    } catch (error) {
      logger.error('Failed to send OTP email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const subject = 'إعادة تعيين كلمة المرور - Naturacalm';
    const html = this.getPasswordResetEmailTemplate(otp);

    if (!this.resend) {
      logger.info(`[DEV MODE] Password reset OTP for ${email}: ${otp}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject,
        html,
      });

      if (error) {
        logger.error('Failed to send password reset email:', error);
        throw new Error('Failed to send password reset email');
      }

      logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  private getOTPEmailTemplate(otp: string): string {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>رمز التحقق</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          direction: rtl;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #7ca78b 0%, #5a8a6a 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .content p {
          color: #555555;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .otp-code {
          background-color: #f8f9fa;
          border: 2px dashed #7ca78b;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .otp-code span {
          font-size: 36px;
          font-weight: bold;
          color: #7ca78b;
          letter-spacing: 8px;
        }
        .warning {
          color: #888888;
          font-size: 14px;
          margin-top: 20px;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #888888;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Naturacalm</h1>
        </div>
        <div class="content">
          <p>مرحباً بك في Naturacalm!</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <div class="otp-code">
            <span>${otp}</span>
          </div>
          <p class="warning">هذا الرمز صالح لمدة 5 دقائق فقط.<br>لا تشارك هذا الرمز مع أي شخص.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Naturacalm. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private getPasswordResetEmailTemplate(otp: string): string {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>إعادة تعيين كلمة المرور</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          direction: rtl;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #7ca78b 0%, #5a8a6a 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .content p {
          color: #555555;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .otp-code {
          background-color: #f8f9fa;
          border: 2px dashed #7ca78b;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .otp-code span {
          font-size: 36px;
          font-weight: bold;
          color: #7ca78b;
          letter-spacing: 8px;
        }
        .warning {
          color: #888888;
          font-size: 14px;
          margin-top: 20px;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #888888;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Naturacalm</h1>
        </div>
        <div class="content">
          <p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بك.</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <div class="otp-code">
            <span>${otp}</span>
          </div>
          <p class="warning">هذا الرمز صالح لمدة 5 دقائق فقط.<br>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Naturacalm. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

export const emailService = new EmailService();
export default emailService;
