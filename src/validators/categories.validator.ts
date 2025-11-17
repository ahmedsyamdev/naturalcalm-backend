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

  isValidInteger(num: unknown): boolean {
    if (typeof num !== 'number') return false;
    return Number.isInteger(num);
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
 * Validate category ID parameter
 */
export const validateCategoryId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid category ID', 'id');
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
 * Validate category creation
 */
export const validateCreateCategory = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'name',
        required: true,
        message: 'Category name is required',
      },
      {
        field: 'icon',
        required: true,
        message: 'Category icon is required',
      },
      {
        field: 'color',
        required: true,
        message: 'Category color is required',
      },
      {
        field: 'imageUrl',
        required: true,
        validator: validators.isValidUrl,
        message: 'Valid image URL is required',
      },
    ]);

    // Optional fields validation
    if (req.body.displayOrder !== undefined) {
      if (!validators.isValidInteger(req.body.displayOrder)) {
        throw new ValidationError('Display order must be an integer', 'displayOrder');
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
 * Validate category update
 */
export const validateUpdateCategory = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate ObjectId in params
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid category ID', 'id');
    }

    // All fields are optional for update
    if (req.body.imageUrl !== undefined) {
      if (!validators.isValidUrl(req.body.imageUrl)) {
        throw new ValidationError('Valid image URL is required', 'imageUrl');
      }
    }

    if (req.body.displayOrder !== undefined) {
      if (!validators.isValidInteger(req.body.displayOrder)) {
        throw new ValidationError('Display order must be an integer', 'displayOrder');
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
 * Validate get category tracks/programs query parameters
 */
export const validateGetCategoryContent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate category ID in params
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid category ID', 'id');
    }

    // Validate query parameters
    validateQuery(req.query, [
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

/**
 * Validate category reorder
 */
export const validateReorderCategories = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { categories } = req.body;

    if (!categories) {
      throw new ValidationError('Categories array is required', 'categories');
    }

    if (!Array.isArray(categories)) {
      throw new ValidationError('Categories must be an array', 'categories');
    }

    if (categories.length === 0) {
      throw new ValidationError('Categories array cannot be empty', 'categories');
    }

    // Validate each category item
    for (let i = 0; i < categories.length; i++) {
      const item = categories[i];

      if (!item.id) {
        throw new ValidationError(`Category at index ${i} is missing id`, 'categories');
      }

      if (!validators.isValidObjectId(item.id)) {
        throw new ValidationError(`Invalid category ID at index ${i}`, 'categories');
      }

      if (item.displayOrder === undefined || item.displayOrder === null) {
        throw new ValidationError(`Category at index ${i} is missing displayOrder`, 'categories');
      }

      if (!validators.isValidInteger(item.displayOrder)) {
        throw new ValidationError(`Invalid displayOrder at index ${i}`, 'categories');
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
