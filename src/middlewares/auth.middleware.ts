import { Request, Response, NextFunction } from 'express';
import { JWTUtil, TokenPayload } from '../utils/jwt';
import { tokenService } from '../services/token.service';
import { User } from '../models/User.model';
import logger from '../utils/logger';

// Extend Express Request type to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      phone: string;
      role: string;
    };
  }
}

/**
 * Protect middleware - Verify JWT and attach user to request
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Not authorized. No token provided.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized. Invalid token format.',
      });
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        message: 'Token is no longer valid. Please login again.',
      });
      return;
    }

    // Verify token
    let decoded: TokenPayload;
    try {
      decoded = JWTUtil.verifyAccessToken(token);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && error.message === 'Access token expired'
          ? 'Token expired. Please refresh your token.'
          : 'Invalid token. Please login again.';

      res.status(401).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    // Check if user still exists
    const user = await User.findById(decoded.id).select('-password -otp');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
      return;
    }

    // Check if user is soft-deleted
    if (user.deletedAt) {
      res.status(401).json({
        success: false,
        message: 'User account is deactivated.',
      });
      return;
    }

    // Check if user is banned
    if (user.isBanned) {
      // Check if ban is temporary and has expired
      if (user.bannedUntil && new Date() > user.bannedUntil) {
        // Auto-unban user
        user.isBanned = false;
        user.bannedUntil = undefined;
        user.banReason = undefined;
        await user.save();
      } else {
        // User is still banned
        const banMessage = user.bannedUntil
          ? `Your account is temporarily banned until ${user.bannedUntil.toISOString()}. Reason: ${user.banReason || 'Not specified'}`
          : `Your account has been permanently banned. Reason: ${user.banReason || 'Not specified'}`;

        res.status(403).json({
          success: false,
          message: banMessage,
        });
        return;
      }
    }

    // Attach user to request
    req.user = {
      id: String(user._id),
      phone: user.phone,
      role: user.role,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
    });
  }
};

/**
 * Authorize middleware - Check if user has required role(s)
 * Usage: authorize('admin') or authorize('admin', 'moderator')
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is attached to request (protect middleware should run first)
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized. Please login.',
      });
      return;
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
};

/**
 * Optional auth middleware - Attach user if token is valid, but don't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      next();
      return;
    }

    // Verify token
    try {
      const decoded = JWTUtil.verifyAccessToken(token);

      // Check if user exists
      const user = await User.findById(decoded.id).select('-password -otp');

      if (user && !user.deletedAt) {
        req.user = {
          id: String(user._id),
          phone: user.phone,
          role: user.role,
        };
      }
    } catch (error: unknown) {
      // Token is invalid, but we don't care - continue without user
      logger.debug('Optional auth failed:', error);
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    // Continue without user
    next();
  }
};
