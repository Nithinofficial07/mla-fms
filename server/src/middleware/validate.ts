import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

type Schemas = { body?: z.ZodTypeAny; query?: z.ZodTypeAny; params?: z.ZodTypeAny };

/**
 * Validates request parts against zod schemas and replaces them with the
 * parsed (typed, coerced) values. Field errors are returned as
 * { details: { field: [messages] } } with HTTP 400.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsed, configurable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.') || '_';
          (details[key] ??= []).push(issue.message);
        }
        return next(AppError.badRequest('Validation failed', details));
      }
      next(err);
    }
  };
}

export type Infer<T extends z.ZodTypeAny> = z.infer<T>;
