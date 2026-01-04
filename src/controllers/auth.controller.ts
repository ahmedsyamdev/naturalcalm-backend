import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { otpService } from '../services/otp.service';
import { tokenService } from '../services/token.service';
import { socialAuthService } from '../services/socialAuth.service';
import { JWTUtil } from '../utils/jwt';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      errorResponse(res, 'Email is already registered', 400);
      return;
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      isVerified: false,
    });

    // Generate and send OTP
    const otp = otpService.generateOTP();
    const otpExpires = otpService.getOTPExpiration();

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP via Email
    await otpService.sendOTP(email, otp);

    // Return user without password
    const userResponse = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
    };

    successResponse(
      res,
      {
        user: userResponse,
      },
      'User registered successfully. OTP sent to your email.',
      201
    );
  } catch (error: unknown) {
    logger.error('Register error:', error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Send OTP to email
 * @route   POST /api/v1/auth/otp/send
 * @access  Public
 */
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpires');
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check rate limit
    // TODO: Fix rate limiting - currently disabled for development/testing
    // if (user.otpExpires && otpService.isRateLimited(user.otpExpires)) {
    //   errorResponse(
    //     res,
    //     'Please wait at least 1 minute before requesting another OTP',
    //     429
    //   );
    //   return;
    // }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    const otpExpires = otpService.getOTPExpiration();

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await otpService.sendOTP(email, otp);

    successResponse(res, null, 'OTP sent successfully');
  } catch (error: unknown) {
    logger.error('Send OTP error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Verify OTP and mark user as verified
 * @route   POST /api/v1/auth/otp/verify
 * @access  Public
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    // Find user with OTP fields
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpires');
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check if OTP exists
    if (!user.otp || !user.otpExpires) {
      errorResponse(res, 'No OTP found. Please request a new one.', 400);
      return;
    }

    // Verify OTP
    const isValid = otpService.verifyOTP(user.otp, otp, user.otpExpires);
    if (!isValid) {
      errorResponse(res, 'Invalid or expired OTP', 400);
      return;
    }

    // Mark user as verified and clear OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate tokens
    const accessToken = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    // Store refresh token in Redis
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await tokenService.storeRefreshToken(
      String(user._id),
      refreshToken,
      refreshTokenExpiry
    );

    // Return user and tokens
    const userResponse = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      role: user.role,
      subscription: user.subscription,
    };

    successResponse(
      res,
      {
        user: userResponse,
        accessToken,
        refreshToken,
      },
      'OTP verified successfully'
    );
  } catch (error: unknown) {
    logger.error('Verify OTP error:', error);
    const message = error instanceof Error ? error.message : 'OTP verification failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      errorResponse(res, 'Invalid credentials', 401);
      return;
    }

    // Check if user is deleted
    if (user.deletedAt) {
      errorResponse(res, 'Account is deactivated', 403);
      return;
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      errorResponse(res, 'Invalid credentials', 401);
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      errorResponse(
        res,
        'Please verify your account with OTP before logging in',
        403
      );
      return;
    }

    // Generate tokens
    const accessToken = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    // Store refresh token in Redis
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await tokenService.storeRefreshToken(
      String(user._id),
      refreshToken,
      refreshTokenExpiry
    );

    // Return user and tokens
    const userResponse = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      role: user.role,
      subscription: user.subscription,
    };

    successResponse(
      res,
      {
        user: userResponse,
        accessToken,
        refreshToken,
      },
      'Login successful'
    );
  } catch (error: unknown) {
    logger.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    // Verify refresh token
    let decoded;
    try {
      decoded = JWTUtil.verifyRefreshToken(token);
    } catch {
      errorResponse(res, 'Invalid or expired refresh token', 401);
      return;
    }

    // Check if refresh token exists in Redis
    const storedToken = await tokenService.getRefreshToken(decoded.id);
    if (!storedToken || storedToken !== token) {
      errorResponse(res, 'Refresh token is invalid or has been revoked', 401);
      return;
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || user.deletedAt) {
      errorResponse(res, 'User not found or deactivated', 404);
      return;
    }

    // Generate new tokens
    const newAccessToken = user.generateJWT();
    const newRefreshToken = user.generateRefreshToken();

    // Invalidate old refresh token
    await tokenService.invalidateRefreshToken(String(user._id));

    // Store new refresh token
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await tokenService.storeRefreshToken(
      String(user._id),
      newRefreshToken,
      refreshTokenExpiry
    );

    successResponse(
      res,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      'Token refreshed successfully'
    );
  } catch (error: unknown) {
    logger.error('Refresh token error:', error);
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      // Get token expiration
      const expiration = JWTUtil.getTokenExpiration(token);
      if (expiration) {
        const secondsUntilExpiry =
          tokenService.getSecondsUntilExpiration(expiration);
        // Blacklist access token
        await tokenService.blacklistToken(token, secondsUntilExpiry);
      }
    }

    // Invalidate refresh token
    await tokenService.invalidateRefreshToken(userId);

    successResponse(res, null, 'Logout successful');
  } catch (error: unknown) {
    logger.error('Logout error:', error);
    const message = error instanceof Error ? error.message : 'Logout failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Forgot password - Send OTP
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpires');
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check rate limit
    // TODO: Fix rate limiting - currently disabled for development/testing
    // if (user.otpExpires && otpService.isRateLimited(user.otpExpires)) {
    //   errorResponse(
    //     res,
    //     'Please wait at least 1 minute before requesting another OTP',
    //     429
    //   );
    //   return;
    // }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    const otpExpires = otpService.getOTPExpiration();

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await otpService.sendPasswordResetOTP(email, otp);

    successResponse(res, null, 'Password reset OTP sent successfully');
  } catch (error: unknown) {
    logger.error('Forgot password error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Reset password with OTP
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find user with OTP fields
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpires');
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check if OTP exists
    if (!user.otp || !user.otpExpires) {
      errorResponse(res, 'No OTP found. Please request a new one.', 400);
      return;
    }

    // Verify OTP
    const isValid = otpService.verifyOTP(user.otp, otp, user.otpExpires);
    if (!isValid) {
      errorResponse(res, 'Invalid or expired OTP', 400);
      return;
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Invalidate all existing refresh tokens for security
    await tokenService.invalidateRefreshToken(String(user._id));

    successResponse(res, null, 'Password reset successfully. Please login.');
  } catch (error: unknown) {
    logger.error('Reset password error:', error);
    const message = error instanceof Error ? error.message : 'Password reset failed';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Social auth - Google, Facebook, Apple
 * @route   POST /api/v1/auth/social/{provider}
 * @access  Public
 */
export const socialAuth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const provider = req.params.provider as 'google' | 'facebook' | 'apple';
    const { token, user: appleUser, phone } = req.body;

    // Validate provider
    if (!['google', 'facebook', 'apple'].includes(provider)) {
      errorResponse(res, 'Invalid provider', 400);
      return;
    }

    // Verify social token and get user info
    const socialPayload = await socialAuthService.verifySocialToken(
      provider,
      token,
      appleUser
    );

    // Check if user exists with this social provider
    let user = await User.findOne({
      'socialProviders.provider': provider,
      'socialProviders.providerId': socialPayload.providerId,
    });

    if (user) {
      // User exists - login
      if (user.deletedAt) {
        errorResponse(res, 'Account is deactivated', 403);
        return;
      }

      // Update user info if changed
      if (socialPayload.name && user.name !== socialPayload.name) {
        user.name = socialPayload.name;
      }
      if (socialPayload.avatar && user.avatar !== socialPayload.avatar) {
        user.avatar = socialPayload.avatar;
      }
      if (socialPayload.email && user.email !== socialPayload.email) {
        user.email = socialPayload.email;
      }
      await user.save();
    } else {
      // New user - create account
      // For social auth, phone is optional but recommended
      interface CreateUserData {
        name: string;
        email?: string;
        avatar?: string;
        phone?: string;
        isVerified: boolean;
        socialProviders: Array<{
          provider: string;
          providerId: string;
          email?: string;
        }>;
      }

      const userData: CreateUserData = {
        name: socialPayload.name || 'User',
        email: socialPayload.email,
        avatar: socialPayload.avatar,
        phone: phone || undefined,
        isVerified: true, // Social auth users are auto-verified
        socialProviders: [
          {
            provider,
            providerId: socialPayload.providerId,
            email: socialPayload.email,
          },
        ],
      };

      // Check if email already exists (from another provider or regular registration)
      if (socialPayload.email) {
        const existingUser = await User.findOne({ email: socialPayload.email });
        if (existingUser) {
          // User exists with this email - link the social provider
          existingUser.socialProviders = existingUser.socialProviders || [];
          existingUser.socialProviders.push({
            provider,
            providerId: socialPayload.providerId,
            email: socialPayload.email,
          });

          // Update info if not set
          if (!existingUser.avatar && socialPayload.avatar) {
            existingUser.avatar = socialPayload.avatar;
          }
          if (!existingUser.isVerified) {
            existingUser.isVerified = true;
          }

          await existingUser.save();
          user = existingUser;
        } else {
          user = await User.create(userData);
        }
      } else {
        user = await User.create(userData);
      }
    }

    // Generate tokens
    const accessToken = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    // Store refresh token in Redis
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await tokenService.storeRefreshToken(
      String(user._id),
      refreshToken,
      refreshTokenExpiry
    );

    // Return user and tokens
    const userResponse = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      role: user.role,
      subscription: user.subscription,
    };

    successResponse(
      res,
      {
        user: userResponse,
        accessToken,
        refreshToken,
      },
      'Authentication successful'
    );
  } catch (error: unknown) {
    logger.error('Social auth error:', error);
    const message = error instanceof Error ? error.message : 'Social authentication failed';
    errorResponse(res, message, 500);
  }
};
