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

  isValidNumber(num: unknown): boolean {
    return typeof num === 'number' && !isNaN(num);
  },

  isValidBoolean(value: unknown): boolean {
    return value === true || value === false || value === 'true' || value === 'false';
  },

  isValidDate(date: unknown): boolean {
    if (typeof date !== 'string') return false;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  },

  isPositiveInteger(num: unknown): boolean {
    if (typeof num !== 'number') return false;
    return Number.isInteger(num) && num > 0;
  },
};

/**
 * Validate start listening session request
 */
export const validateStartSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate trackId
    if (!req.body.trackId || !validators.isValidObjectId(req.body.trackId)) {
      throw new ValidationError('Valid track ID is required', 'trackId');
    }

    // Validate programId if provided
    if (req.body.programId && !validators.isValidObjectId(req.body.programId)) {
      throw new ValidationError('Valid program ID is required if provided', 'programId');
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
 * Validate update listening session request
 */
export const validateUpdateSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate sessionId parameter
    if (!validators.isValidObjectId(req.params.sessionId)) {
      throw new ValidationError('Valid session ID is required', 'sessionId');
    }

    // Validate currentTime
    if (req.body.currentTime === undefined || req.body.currentTime === null) {
      throw new ValidationError('Current time is required', 'currentTime');
    }

    const currentTime = Number(req.body.currentTime);
    if (!validators.isValidNumber(currentTime) || currentTime < 0) {
      throw new ValidationError('Current time must be a non-negative number', 'currentTime');
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
 * Validate end listening session request
 */
export const validateEndSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate sessionId parameter
    if (!validators.isValidObjectId(req.params.sessionId)) {
      throw new ValidationError('Valid session ID is required', 'sessionId');
    }

    // Validate completed
    if (req.body.completed === undefined || req.body.completed === null) {
      throw new ValidationError('Completed flag is required', 'completed');
    }

    if (!validators.isValidBoolean(req.body.completed)) {
      throw new ValidationError('Completed must be a boolean', 'completed');
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
 * Validate get listening history request
 */
export const validateGetHistory = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate page parameter
    if (req.query.page) {
      const page = parseInt(req.query.page as string);
      if (isNaN(page) || page < 1) {
        throw new ValidationError('Page must be a positive integer', 'page');
      }
    }

    // Validate limit parameter
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100', 'limit');
      }
    }

    // Validate startDate if provided
    if (req.query.startDate && !validators.isValidDate(req.query.startDate)) {
      throw new ValidationError('Start date must be a valid ISO 8601 date', 'startDate');
    }

    // Validate endDate if provided
    if (req.query.endDate && !validators.isValidDate(req.query.endDate)) {
      throw new ValidationError('End date must be a valid ISO 8601 date', 'endDate');
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
 * Validate get recent tracks request
 */
export const validateGetRecentTracks = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate limit parameter
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string);
      if (isNaN(limit) || limit < 1 || limit > 50) {
        throw new ValidationError('Limit must be between 1 and 50', 'limit');
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
 * Validate get listening stats request
 */
export const validateGetListeningStats = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate period parameter
    if (req.query.period) {
      const validPeriods = ['week', 'month', 'year'];
      if (!validPeriods.includes(req.query.period as string)) {
        throw new ValidationError('Period must be one of: week, month, year', 'period');
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
