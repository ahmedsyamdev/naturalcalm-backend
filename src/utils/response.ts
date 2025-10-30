import { Response } from 'express';

interface SuccessResponseData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const successResponse = (
  res: Response,
  data: SuccessResponseData,
  message = 'Success',
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message = 'Error occurred',
  statusCode = 500
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
    },
  });
};

export const paginatedResponse = (
  res: Response,
  data: SuccessResponseData[],
  pagination: PaginationData,
  message = 'Success',
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.page < pagination.totalPages,
      hasPrevPage: pagination.page > 1,
    },
  });
};
