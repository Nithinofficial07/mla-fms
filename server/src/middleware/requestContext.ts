import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** Assigns a correlation id to every request and echoes it in the response. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.id = req.get('x-request-id') || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
