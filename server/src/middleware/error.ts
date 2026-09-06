import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound('Route not found'));
}

/**
 * Mongo duplicate-key (E11000). Detected structurally instead of importing the
 * `mongodb` package directly (it is only a transitive dep of mongoose).
 */
function isDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'MongoServerError' &&
    (err as { code?: number }).code === 11000
  );
}

/** Central error handler: maps known error shapes, hides internals in prod. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Something went wrong';
  let details: Record<string, string[]> | undefined;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Validation failed';
  } else if (err instanceof MongooseError.ValidationError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]]));
  } else if (err instanceof MongooseError.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid value for ${err.path}`;
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    message = `A record with this ${field} already exists`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the allowed size limit' : err.message;
  }

  if (status >= 500) {
    logger.error({ err, reqId: req.id, path: req.path }, 'Unhandled error');
  } else {
    logger.warn({ code, path: req.path, reqId: req.id }, message);
  }

  // Opt-in: when EXPOSE_ERRORS=true, include the underlying error name/message
  // on 5xx responses. For debugging a live deploy; turn it off afterwards.
  const debug =
    status >= 500 && process.env.EXPOSE_ERRORS === 'true' && err instanceof Error
      ? { debug: `${err.name}: ${err.message}` }
      : {};

  res.status(status).json({
    message,
    code,
    details,
    ...debug,
    ...(isProd || !(err instanceof Error) ? {} : { stack: undefined }),
    requestId: req.id,
  });
}
