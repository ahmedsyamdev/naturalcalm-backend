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

  isValidUrl(url: unknown): boolean {
    if (typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  isValidBoolean(value: unknown): boolean {
    return value === true || value === false || value === 'true' || value === 'false';
  },

  isValidArray(value: unknown): boolean {
    return Array.isArray(value);
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

    if (rule.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) {
      throw new ValidationError(rule.message, rule.field);
    }

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

    if (value !== undefined && value !== null && rule.validator && !rule.validator(value)) {
      throw new ValidationError(rule.message, rule.field);
    }
  }
};

/**
 * Validate program creation
 */
export const validateCreateProgram = (
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
        field: 'thumbnailUrl',
        required: true,
        validator: validators.isValidUrl,
        message: 'Valid thumbnail URL is required',
      },
      {
        field: 'tracks',
        required: true,
        validator: validators.isValidArray,
        message: 'Tracks must be an array',
      },
    ]);

    // Validate tracks array structure
    if (Array.isArray(req.body.tracks)) {
      for (let i = 0; i < req.body.tracks.length; i++) {
        const track = req.body.tracks[i];

        if (!track.trackId || !validators.isValidObjectId(track.trackId)) {
          throw new ValidationError(
            `Invalid track ID at index ${i}`,
            `tracks[${i}].trackId`
          );
        }

        if (track.order === undefined || typeof track.order !== 'number' || track.order < 1) {
          throw new ValidationError(
            `Track order at index ${i} must be a positive number`,
            `tracks[${i}].order`
          );
        }
      }
    }

    // Validate optional thumbnailImages array
    if (req.body.thumbnailImages !== undefined) {
      if (!validators.isValidArray(req.body.thumbnailImages)) {
        throw new ValidationError('thumbnailImages must be an array', 'thumbnailImages');
      }

      const images = req.body.thumbnailImages as unknown[];
      if (images.length > 4) {
        throw new ValidationError('Cannot have more than 4 thumbnail images', 'thumbnailImages');
      }

      for (let i = 0; i < images.length; i++) {
        if (!validators.isValidUrl(images[i])) {
          throw new ValidationError(
            `Invalid URL at thumbnailImages[${i}]`,
            `thumbnailImages[${i}]`
          );
        }
      }
    }

    // Validate optional boolean fields
    if (req.body.isPremium !== undefined && !validators.isValidBoolean(req.body.isPremium)) {
      throw new ValidationError('isPremium must be a boolean', 'isPremium');
    }

    if (req.body.isFeatured !== undefined && !validators.isValidBoolean(req.body.isFeatured)) {
      throw new ValidationError('isFeatured must be a boolean', 'isFeatured');
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
 * Validate program update
 */
export const validateUpdateProgram = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid program ID', 'id');
    }

    // All fields are optional for update
    if (req.body.level !== undefined && !validators.isValidLevel(req.body.level)) {
      throw new ValidationError('Level must be one of: مبتدأ, متوسط, متقدم', 'level');
    }

    if (req.body.category !== undefined && !validators.isValidObjectId(req.body.category)) {
      throw new ValidationError('Valid category ID is required', 'category');
    }

    if (req.body.thumbnailUrl !== undefined && !validators.isValidUrl(req.body.thumbnailUrl)) {
      throw new ValidationError('Valid thumbnail URL is required', 'thumbnailUrl');
    }

    // Validate tracks array if provided
    if (req.body.tracks !== undefined) {
      if (!validators.isValidArray(req.body.tracks)) {
        throw new ValidationError('Tracks must be an array', 'tracks');
      }

      for (let i = 0; i < req.body.tracks.length; i++) {
        const track = req.body.tracks[i];

        if (!track.trackId || !validators.isValidObjectId(track.trackId)) {
          throw new ValidationError(
            `Invalid track ID at index ${i}`,
            `tracks[${i}].trackId`
          );
        }

        if (track.order === undefined || typeof track.order !== 'number' || track.order < 1) {
          throw new ValidationError(
            `Track order at index ${i} must be a positive number`,
            `tracks[${i}].order`
          );
        }
      }
    }

    // Validate thumbnailImages if provided
    if (req.body.thumbnailImages !== undefined) {
      if (!validators.isValidArray(req.body.thumbnailImages)) {
        throw new ValidationError('thumbnailImages must be an array', 'thumbnailImages');
      }

      const images = req.body.thumbnailImages as unknown[];
      if (images.length > 4) {
        throw new ValidationError('Cannot have more than 4 thumbnail images', 'thumbnailImages');
      }

      for (let i = 0; i < images.length; i++) {
        if (!validators.isValidUrl(images[i])) {
          throw new ValidationError(
            `Invalid URL at thumbnailImages[${i}]`,
            `thumbnailImages[${i}]`
          );
        }
      }
    }

    if (req.body.isPremium !== undefined && !validators.isValidBoolean(req.body.isPremium)) {
      throw new ValidationError('isPremium must be a boolean', 'isPremium');
    }

    if (req.body.isFeatured !== undefined && !validators.isValidBoolean(req.body.isFeatured)) {
      throw new ValidationError('isFeatured must be a boolean', 'isFeatured');
    }

    if (req.body.isActive !== undefined && !validators.isValidBoolean(req.body.isActive)) {
      throw new ValidationError('isActive must be a boolean', 'isActive');
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
 * Validate program ID parameter
 */
export const validateProgramId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid program ID', 'id');
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
 * Validate get programs query parameters
 */
export const validateGetPrograms = (
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
