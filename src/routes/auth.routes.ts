import { Router } from 'express';
import {
  register,
  sendOTP,
  verifyOTP,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  socialAuth,
} from '../controllers/auth.controller';
import {
  validateRegister,
  validateLogin,
  validateOTPSend,
  validateOTPVerify,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
  validateSocialAuth,
} from '../validators/auth.validator';
import { protect } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Public routes
 */

// Register new user
router.post('/register', validateRegister, asyncHandler(register));

// OTP routes
router.post('/otp/send', validateOTPSend, asyncHandler(sendOTP));
router.post('/otp/verify', validateOTPVerify, asyncHandler(verifyOTP));

// Login
router.post('/login', validateLogin, asyncHandler(login));

// Refresh token
router.post(
  '/refresh-token',
  validateRefreshToken,
  asyncHandler(refreshToken)
);

// Forgot password
router.post(
  '/forgot-password',
  validateForgotPassword,
  asyncHandler(forgotPassword)
);

// Reset password
router.post(
  '/reset-password',
  validateResetPassword,
  asyncHandler(resetPassword)
);

// Social auth routes
router.post(
  '/social/:provider',
  validateSocialAuth,
  asyncHandler(socialAuth)
);

/**
 * Protected routes
 */

// Logout (requires authentication)
router.post('/logout', protect, asyncHandler(logout));

export default router;
