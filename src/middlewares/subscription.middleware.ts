import { Request, Response, NextFunction } from 'express';
import { Subscription, ISubscription } from '../models/Subscription.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import logger from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    subscription?: ISubscription | null;
    content?: {
      isPremium: boolean;
      type: 'track' | 'program';
    };
  }
}

/**
 * Check if user has active subscription access
 * This middleware checks if the user has an active subscription
 * and attaches it to the request object
 */
export const checkSubscriptionAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gt: new Date() },
    }).populate('packageId');

    req.subscription = subscription;

    next();
  } catch (error) {
    logger.error('Subscription middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
    });
  }
};

/**
 * Check if track is premium and require subscription
 * This middleware should be used after checkSubscriptionAccess
 */
export const requireSubscriptionForTrack = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trackId = req.params.id || req.params.trackId;

    if (!trackId) {
      res.status(400).json({
        success: false,
        message: 'Track ID is required',
      });
      return;
    }

    const track = await Track.findById(trackId);

    if (!track) {
      res.status(404).json({
        success: false,
        message: 'Track not found',
      });
      return;
    }

    req.content = {
      isPremium: track.isPremium,
      type: 'track',
    };

    if (track.isPremium && !req.subscription) {
      res.status(403).json({
        success: false,
        message: 'This track requires an active subscription',
        requiresSubscription: true,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Track subscription check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking track access',
    });
  }
};

/**
 * Check if program is premium and require subscription
 * This middleware should be used after checkSubscriptionAccess
 */
export const requireSubscriptionForProgram = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const programId = req.params.id || req.params.programId;

    if (!programId) {
      res.status(400).json({
        success: false,
        message: 'Program ID is required',
      });
      return;
    }

    const program = await Program.findById(programId);

    if (!program) {
      res.status(404).json({
        success: false,
        message: 'Program not found',
      });
      return;
    }

    req.content = {
      isPremium: program.isPremium,
      type: 'program',
    };

    if (program.isPremium && !req.subscription) {
      res.status(403).json({
        success: false,
        message: 'This program requires an active subscription',
        requiresSubscription: true,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Program subscription check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking program access',
    });
  }
};

/**
 * Optional subscription check - doesn't block access but attaches subscription to request
 */
export const optionalSubscriptionCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      next();
      return;
    }

    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gt: new Date() },
    }).populate('packageId');

    req.subscription = subscription;

    next();
  } catch (error) {
    logger.error('Optional subscription check error:', error);
    next();
  }
};
