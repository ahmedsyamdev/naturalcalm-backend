import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

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
    return mongoose.Types.ObjectId.isValid(id);
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

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      throw new ValidationError(rule.message, rule.field);
    }

    if (value && rule.validator && !rule.validator(value)) {
      throw new ValidationError(rule.message, rule.field);
    }
  }
};

/**
 * Validate subscribe request
 */
export const validateSubscribe = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'packageId',
        required: true,
        validator: validators.isValidObjectId,
        message: 'Valid package ID is required',
      },
      {
        field: 'paymentMethodId',
        required: true,
        message: 'Payment method ID is required',
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

/**
 * Validate renew subscription request
 */
export const validateRenew = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.body.packageId) {
      validateFields(req.body, [
        {
          field: 'packageId',
          required: false,
          validator: validators.isValidObjectId,
          message: 'Valid package ID is required',
        },
      ]);
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
 * Validate upgrade subscription request
 */
export const validateUpgrade = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'newPackageId',
        required: true,
        validator: validators.isValidObjectId,
        message: 'Valid new package ID is required',
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
