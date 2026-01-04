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
  isValidPhone(phone: unknown): boolean {
    if (typeof phone !== 'string') return false;
    // Accepts international format with + or numbers with optional spaces, dashes, parentheses
    const phoneRegex = /^[+]?[\d\s()-]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  isValidEmail(email: unknown): boolean {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidPassword(password: unknown): boolean {
    if (typeof password !== 'string') return false;
    return password.length >= 6;
  },

  isValidName(name: unknown): boolean {
    if (typeof name !== 'string') return false;
    return name.trim().length >= 2 && name.trim().length <= 100;
  },

  isValidOTP(otp: unknown): boolean {
    if (typeof otp !== 'string') return false;
    return /^\d{6}$/.test(otp);
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
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      throw new ValidationError(rule.message, rule.field);
    }

    // Run custom validator if value exists
    if (value && rule.validator && !rule.validator(value)) {
      throw new ValidationError(rule.message, rule.field);
    }
  }
};

/**
 * Register validation middleware
 */
export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'name',
        required: true,
        validator: validators.isValidName,
        message: 'Name must be between 2 and 100 characters',
      },
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
      },
      {
        field: 'password',
        required: true,
        validator: validators.isValidPassword,
        message: 'Password must be at least 6 characters long',
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
 * Login validation middleware
 */
export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
      },
      {
        field: 'password',
        required: true,
        message: 'Password is required',
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
 * OTP send validation middleware
 */
export const validateOTPSend = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
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
 * OTP verify validation middleware
 */
export const validateOTPVerify = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
      },
      {
        field: 'otp',
        required: true,
        validator: validators.isValidOTP,
        message: 'OTP must be a 6-digit number',
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
 * Forgot password validation middleware
 */
export const validateForgotPassword = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
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
 * Reset password validation middleware
 */
export const validateResetPassword = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'email',
        required: true,
        validator: validators.isValidEmail,
        message: 'Please provide a valid email address',
      },
      {
        field: 'otp',
        required: true,
        validator: validators.isValidOTP,
        message: 'OTP must be a 6-digit number',
      },
      {
        field: 'newPassword',
        required: true,
        validator: validators.isValidPassword,
        message: 'Password must be at least 6 characters long',
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
 * Refresh token validation middleware
 */
export const validateRefreshToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'refreshToken',
        required: true,
        message: 'Refresh token is required',
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
 * Social auth validation middleware
 */
export const validateSocialAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    validateFields(req.body, [
      {
        field: 'token',
        required: true,
        message: 'Authentication token is required',
      },
    ]);

    // For Apple, user object is optional but phone might be provided
    // No additional validation needed here as it's optional

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
