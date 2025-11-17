import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './tracks.validator';

// Validate search query
export const validateSearch = (req: Request, res: Response, next: NextFunction) => {
  const { q, type, minDuration, maxDuration, minSessions, maxSessions, page, limit } = req.query;

  // Validate type
  if (type && !['all', 'track', 'program'].includes(type as string)) {
    throw new ValidationError('Type must be one of: all, track, program');
  }

  // Validate duration range
  if (minDuration !== undefined && maxDuration !== undefined) {
    const min = Number(minDuration);
    const max = Number(maxDuration);

    if (isNaN(min) || isNaN(max)) {
      throw new ValidationError('minDuration and maxDuration must be valid numbers');
    }

    if (min < 0 || max < 0) {
      throw new ValidationError('Duration values must be positive');
    }

    if (min > max) {
      throw new ValidationError('minDuration cannot be greater than maxDuration');
    }
  }

  // Validate sessions range
  if (minSessions !== undefined && maxSessions !== undefined) {
    const min = Number(minSessions);
    const max = Number(maxSessions);

    if (isNaN(min) || isNaN(max)) {
      throw new ValidationError('minSessions and maxSessions must be valid numbers');
    }

    if (min < 0 || max < 0) {
      throw new ValidationError('Sessions values must be positive');
    }

    if (min > max) {
      throw new ValidationError('minSessions cannot be greater than maxSessions');
    }
  }

  // Validate pagination
  if (page !== undefined) {
    const pageNum = Number(page);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationError('Page must be a positive number');
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (isNaN(limitNum) || limitNum < 1) {
      throw new ValidationError('Limit must be a positive number');
    }
    if (limitNum > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }
  }

  // Validate isPremium
  if (req.query.isPremium !== undefined) {
    const isPremium = req.query.isPremium;
    if (isPremium !== 'true' && isPremium !== 'false') {
      throw new ValidationError('isPremium must be true or false');
    }
  }

  // Sanitize query string to prevent injection
  if (q) {
    const query = String(q).trim();

    // Check for MongoDB operators or suspicious patterns
    const suspiciousPatterns = /[${}()\\]/;
    if (suspiciousPatterns.test(query)) {
      throw new ValidationError('Query contains invalid characters');
    }

    // Store sanitized query back
    req.query.q = query;
  }

  next();
};

// Validate search suggestions
export const validateSearchSuggestions = (req: Request, res: Response, next: NextFunction) => {
  const { q } = req.query;

  if (!q || String(q).trim().length === 0) {
    throw new ValidationError('Query parameter "q" is required');
  }

  const query = String(q).trim();

  // Sanitize query
  const suspiciousPatterns = /[${}()\\]/;
  if (suspiciousPatterns.test(query)) {
    throw new ValidationError('Query contains invalid characters');
  }

  if (query.length < 2) {
    throw new ValidationError('Query must be at least 2 characters');
  }

  if (query.length > 100) {
    throw new ValidationError('Query cannot exceed 100 characters');
  }

  req.query.q = query;
  next();
};
