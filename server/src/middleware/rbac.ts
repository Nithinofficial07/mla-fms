import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '@mla/shared';
import { ROLES } from '@mla/shared';
import { AppError } from '../utils/AppError.js';

/** Requires the caller to hold ALL listed permissions (SUPER_ADMIN bypasses). */
export function requirePermission(...needed: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(AppError.unauthorized());
    if (req.auth.roleCode === ROLES.SUPER_ADMIN) return next();
    const has = new Set(req.auth.permissions);
    const missing = needed.filter((p) => !has.has(p));
    if (missing.length) return next(AppError.forbidden(`Missing permission: ${missing.join(', ')}`));
    next();
  };
}

/** Requires the caller's role code to be one of the listed. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.roleCode)) return next(AppError.forbidden());
    next();
  };
}
