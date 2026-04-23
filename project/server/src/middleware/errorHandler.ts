import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Default error
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Duplicate key error
  if (err.name === 'DuplicateKeyError' || (err as any).code === '23505') {
    statusCode = 409;
    message = 'Duplicate entry';
  }

  // Foreign key constraint error
  if ((err as any).code === '23503') {
    statusCode = 400;
    message = 'Invalid reference';
  }

  // Custom status code if provided
  if (err.statusCode) {
    statusCode = err.statusCode;
  }

  // Custom message if provided and it's operational
  if (err.isOperational && err.message) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const createError = (message: string, statusCode: number = 500): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
