import { Request, Response, NextFunction } from 'express';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation helper functions
 */
const validators = {
  isValidObjectId(id: unknown): boolean {
    if (typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  },

  isValidBoolean(value: unknown): boolean {
    return value === true || value === false || value === 'true' || value === 'false';
  },

  isValidNotificationType(type: unknown): boolean {
    const validTypes = ['new_content', 'achievement', 'reminder', 'subscription', 'system'];
    return typeof type === 'string' && validTypes.includes(type);
  },

  isValidString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  },
};

/**
 * Validate get notifications request
 */
export const validateGetNotifications = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.query.page) {
      const page = parseInt(req.query.page as string);
      if (isNaN(page) || page < 1) {
        throw new ValidationError('Page must be a positive integer', 'page');
      }
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100', 'limit');
      }
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate mark notification as read request
 */
export const validateMarkAsRead = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.notificationId)) {
      throw new ValidationError('Valid notification ID is required', 'notificationId');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate delete notification request
 */
export const validateDeleteNotification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.notificationId)) {
      throw new ValidationError('Valid notification ID is required', 'notificationId');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate update notification preferences request
 */
export const validateUpdatePreferences = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { newContent, achievements, reminders, subscription } = req.body;

    if (newContent !== undefined && !validators.isValidBoolean(newContent)) {
      throw new ValidationError('newContent must be a boolean', 'newContent');
    }

    if (achievements !== undefined && !validators.isValidBoolean(achievements)) {
      throw new ValidationError('achievements must be a boolean', 'achievements');
    }

    if (reminders !== undefined && !validators.isValidBoolean(reminders)) {
      throw new ValidationError('reminders must be a boolean', 'reminders');
    }

    if (subscription !== undefined && !validators.isValidBoolean(subscription)) {
      throw new ValidationError('subscription must be a boolean', 'subscription');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate register device token request
 */
export const validateRegisterDevice = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.body.fcmToken || !validators.isValidString(req.body.fcmToken)) {
      throw new ValidationError('Valid FCM token is required', 'fcmToken');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate send notification to user request
 */
export const validateSendNotification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.body.userId || !validators.isValidObjectId(req.body.userId)) {
      throw new ValidationError('Valid user ID is required', 'userId');
    }

    if (!req.body.type || !validators.isValidNotificationType(req.body.type)) {
      throw new ValidationError(
        'Valid notification type is required (new_content, achievement, reminder, subscription, system)',
        'type'
      );
    }

    if (!req.body.title || !validators.isValidString(req.body.title)) {
      throw new ValidationError('Valid title is required', 'title');
    }

    if (!req.body.message || !validators.isValidString(req.body.message)) {
      throw new ValidationError('Valid message is required', 'message');
    }

    if (req.body.title.length > 100) {
      throw new ValidationError('Title cannot exceed 100 characters', 'title');
    }

    if (req.body.message.length > 500) {
      throw new ValidationError('Message cannot exceed 500 characters', 'message');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Validate broadcast notification request
 */
export const validateBroadcastNotification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.body.type || !validators.isValidNotificationType(req.body.type)) {
      throw new ValidationError(
        'Valid notification type is required (new_content, achievement, reminder, subscription, system)',
        'type'
      );
    }

    if (!req.body.title || !validators.isValidString(req.body.title)) {
      throw new ValidationError('Valid title is required', 'title');
    }

    if (!req.body.message || !validators.isValidString(req.body.message)) {
      throw new ValidationError('Valid message is required', 'message');
    }

    if (req.body.title.length > 100) {
      throw new ValidationError('Title cannot exceed 100 characters', 'title');
    }

    if (req.body.message.length > 500) {
      throw new ValidationError('Message cannot exceed 500 characters', 'message');
    }

    if (req.body.targetUsers && !Array.isArray(req.body.targetUsers)) {
      throw new ValidationError('targetUsers must be an array', 'targetUsers');
    }

    if (req.body.targetUsers && Array.isArray(req.body.targetUsers)) {
      for (const userId of req.body.targetUsers) {
        if (!validators.isValidObjectId(userId)) {
          throw new ValidationError('All target user IDs must be valid', 'targetUsers');
        }
      }
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    } else {
      next(error);
    }
  }
};
