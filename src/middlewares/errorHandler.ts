import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message: string }>;
}

const handleCastErrorDB = (_err: MongoError): AppError => {
  const message = `Invalid value. Please use a valid ID.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: MongoError): AppError => {
  const value = err.keyValue ? Object.values(err.keyValue)[0] : 'unknown';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err: MongoError): AppError => {
  const errors = err.errors
    ? Object.values(err.errors).map((e) => e.message)
    : [];
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      statusCode: err.statusCode,
      status: err.status,
      stack: err.stack,
    },
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
  } else {
    console.error('ERROR:', err);
    res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong',
        statusCode: 500,
      },
    });
  }
};

export const errorHandler = (
  err: Error | AppError | MongoError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  let error = { ...err, message: err.message } as AppError;
  error.statusCode = (error as AppError).statusCode || 500;
  error.status = (error as AppError).status || 'error';

  // MongoDB errors
  if (err.name === 'CastError') error = handleCastErrorDB(err as MongoError);
  if ((err as MongoError).code === 11000)
    error = handleDuplicateFieldsDB(err as MongoError);
  if (err.name === 'ValidationError')
    error = handleValidationErrorDB(err as MongoError);

  if (env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};
