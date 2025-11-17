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

  isValidArray(value: unknown): boolean {
    return Array.isArray(value);
  },

  isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  },
};

/**
 * Validate fields helper
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
 * Validate program ID parameter
 */
export const validateProgramId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.programId)) {
      throw new ValidationError('Invalid program ID', 'programId');
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
    if (!validators.isValidObjectId(req.params.trackId)) {
      throw new ValidationError('Invalid track ID', 'trackId');
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
 * Validate custom program ID parameter
 */
export const validateCustomProgramId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid custom program ID', 'id');
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
 * Validate create custom program request
 */
export const validateCreateCustomProgram = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'name',
        required: true,
        validator: validators.isNonEmptyString,
        message: 'Custom program name is required',
      },
      {
        field: 'trackIds',
        required: true,
        validator: validators.isValidArray,
        message: 'Track IDs must be provided as an array',
      },
    ]);

    // Validate trackIds array
    const trackIds = req.body.trackIds as unknown[];

    if (trackIds.length === 0) {
      throw new ValidationError('At least one track is required', 'trackIds');
    }

    for (let i = 0; i < trackIds.length; i++) {
      if (!validators.isValidObjectId(trackIds[i])) {
        throw new ValidationError(
          `Invalid track ID at index ${i}`,
          `trackIds[${i}]`
        );
      }
    }

    // Validate optional description
    if (req.body.description !== undefined && req.body.description !== null) {
      if (typeof req.body.description !== 'string') {
        throw new ValidationError('Description must be a string', 'description');
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
 * Validate update custom program request
 */
export const validateUpdateCustomProgram = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!validators.isValidObjectId(req.params.id)) {
      throw new ValidationError('Invalid custom program ID', 'id');
    }

    // All fields are optional for update, but validate if provided
    if (req.body.name !== undefined) {
      if (!validators.isNonEmptyString(req.body.name)) {
        throw new ValidationError('Name must be a non-empty string', 'name');
      }
    }

    if (req.body.description !== undefined && req.body.description !== null) {
      if (typeof req.body.description !== 'string') {
        throw new ValidationError('Description must be a string', 'description');
      }
    }

    if (req.body.trackIds !== undefined) {
      if (!validators.isValidArray(req.body.trackIds)) {
        throw new ValidationError('Track IDs must be an array', 'trackIds');
      }

      const trackIds = req.body.trackIds as unknown[];

      if (trackIds.length === 0) {
        throw new ValidationError('At least one track is required', 'trackIds');
      }

      for (let i = 0; i < trackIds.length; i++) {
        if (!validators.isValidObjectId(trackIds[i])) {
          throw new ValidationError(
            `Invalid track ID at index ${i}`,
            `trackIds[${i}]`
          );
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
