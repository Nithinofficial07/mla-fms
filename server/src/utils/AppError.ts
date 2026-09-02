/** Operational error with an HTTP status. Thrown anywhere, handled centrally. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly isOperational = true;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: Record<string, string[]>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(msg: string, details?: Record<string, string[]>) {
    return new AppError(400, msg, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new AppError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new AppError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Resource not found') {
    return new AppError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg: string) {
    return new AppError(409, msg, 'CONFLICT');
  }
  static tooMany(msg = 'Too many requests') {
    return new AppError(429, msg, 'RATE_LIMITED');
  }
}
