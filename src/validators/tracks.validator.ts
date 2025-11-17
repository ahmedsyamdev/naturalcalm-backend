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

  isValidLevel(level: unknown): boolean {
    if (typeof level !== 'string') return false;
    return ['مبتدأ', 'متوسط', 'متقدم'].includes(level);
  },

  isValidRelaxationType(type: unknown): boolean {
    if (typeof type !== 'string') return false;
    return ['استرخاء صباحي', 'استرخاء مسائي'].includes(type);
  },

  isValidUrl(url: unknown): boolean {
    if (typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  isValidDuration(duration: unknown): boolean {
    if (typeof duration !== 'number') return false;
    return duration >= 1;
  },

  isPositiveInteger(num: unknown): boolean {
    if (typeof num !== 'number') return false;
    return Number.isInteger(num) && num > 0;
  },

  isValidBoolean(value: unknown): boolean {
    return value === true || value === false || value === 'true' || value === 'false';
  },
};

/**
 * Validate request body fields
 */
const validateFields = (
  body: Record<string, unknown>,
  rules: {
    field: string;
    required?: boolean;
    validator?: (value: unknown) => boolean;
    message: string;
  }[]
): void => {
  for (const rule of rules) {
    const value = body[rule.field];

    // Check if required field is missing
    if (rule.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) {
      throw new ValidationError(rule.message, rule.field);
    }

    // Run custom validator if value exists
    if (value !== undefined && value !== null && rule.validator && !rule.validator(value)) {
      throw new ValidationError(rule.message, rule.field);
    }
  }
};

/**
 * Validate query parameters
 */
const validateQuery = (
  query: Record<string, unknown>,
  rules: {
    field: string;
    validator?: (value: unknown) => boolean;
    message: string;
  }[]
): void => {
  for (const rule of rules) {
    const value = query[rule.field];

    // Only validate if value exists
    if (value !== undefined && value !== null && rule.validator && !rule.validator(value)) {
      throw new ValidationError(rule.message, rule.field);
    }
  }
};

/**
 * Validate track creation
 */
export const validateCreateTrack = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'title',
        required: true,
        message: 'Title is required',
      },
      {
        field: 'durationSeconds',
        required: true,
        validator: validators.isValidDuration,
        message: 'Duration must be at least 1 second',
      },
      {
        field: 'level',
        required: true,
        validator: validators.isValidLevel,
        message: 'Level must be one of: مبتدأ, متوسط, متقدم',
      },
      {
        field: 'category',
        required: true,
        validator: validators.isValidObjectId,
        message: 'Valid category ID is required',
      },
      {
        field: 'imageUrl',
        required: true,
        validator: validators.isValidUrl,
        message: 'Valid image URL is required',
      },
      {
        field: 'audioUrl',
        required: true,
        validator: validators.isValidUrl,
        message: 'Valid audio URL is required',
      },
    ]);

    // Optional fields validation
    if (req.body.relaxationType) {
      if (!validators.isValidRelaxationType(req.body.relaxationType)) {
        throw new ValidationError(
          'Relaxation type must be one of: استرخاء صباحي, استرخاء مسائي',
          'relaxationType'
        );
      }
    }

    if (req.body.isPremium !== undefined) {
      if (!validators.isValidBoolean(req.body.isPremium)) {
        throw new ValidationError('isPremium must be a boolean', 'isPremium');
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
 * Validate track update
 */
export const validateUpdateTrack = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate ObjectId in params
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid track ID', 'id');
    }

    // All fields are optional for update
    if (req.body.durationSeconds !== undefined) {
      if (!validators.isValidDuration(req.body.durationSeconds)) {
        throw new ValidationError('Duration must be at least 1 second', 'durationSeconds');
      }
    }

    if (req.body.level !== undefined) {
      if (!validators.isValidLevel(req.body.level)) {
        throw new ValidationError('Level must be one of: مبتدأ, متوسط, متقدم', 'level');
      }
    }

    if (req.body.category !== undefined) {
      if (!validators.isValidObjectId(req.body.category)) {
        throw new ValidationError('Valid category ID is required', 'category');
      }
    }

    if (req.body.relaxationType !== undefined) {
      if (!validators.isValidRelaxationType(req.body.relaxationType)) {
        throw new ValidationError(
          'Relaxation type must be one of: استرخاء صباحي, استرخاء مسائي',
          'relaxationType'
        );
      }
    }

    if (req.body.imageUrl !== undefined) {
      if (!validators.isValidUrl(req.body.imageUrl)) {
        throw new ValidationError('Valid image URL is required', 'imageUrl');
      }
    }

    if (req.body.audioUrl !== undefined) {
      if (!validators.isValidUrl(req.body.audioUrl)) {
        throw new ValidationError('Valid audio URL is required', 'audioUrl');
      }
    }

    if (req.body.isPremium !== undefined) {
      if (!validators.isValidBoolean(req.body.isPremium)) {
        throw new ValidationError('isPremium must be a boolean', 'isPremium');
      }
    }

    if (req.body.isActive !== undefined) {
      if (!validators.isValidBoolean(req.body.isActive)) {
        throw new ValidationError('isActive must be a boolean', 'isActive');
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
 * Validate track ID parameter
 */
export const validateTrackId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid track ID', 'id');
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
 * Validate get tracks query parameters
 */
export const validateGetTracks = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateQuery(req.query, [
      {
        field: 'category',
        validator: validators.isValidObjectId,
        message: 'Invalid category ID',
      },
      {
        field: 'level',
        validator: validators.isValidLevel,
        message: 'Level must be one of: مبتدأ, متوسط, متقدم',
      },
      {
        field: 'relaxationType',
        validator: validators.isValidRelaxationType,
        message: 'Relaxation type must be one of: استرخاء صباحي, استرخاء مسائي',
      },
    ]);

    // Validate pagination parameters
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100', 'limit');
      }
    }

    if (req.query.page) {
      const page = parseInt(req.query.page as string);
      if (isNaN(page) || page < 1) {
        throw new ValidationError('Page must be a positive integer', 'page');
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
 * Validate search query
 */
export const validateSearchTracks = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.query.q || typeof req.query.q !== 'string' || !req.query.q.trim()) {
      throw new ValidationError('Search query is required', 'q');
    }

    // Validate optional filters
    validateQuery(req.query, [
      {
        field: 'category',
        validator: validators.isValidObjectId,
        message: 'Invalid category ID',
      },
      {
        field: 'level',
        validator: validators.isValidLevel,
        message: 'Level must be one of: مبتدأ, متوسط, متقدم',
      },
    ]);

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
