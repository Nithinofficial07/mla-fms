import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '@mla/shared';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';

/**
 * Verifies the Bearer access token and loads a compact auth context
 * (role + resolved permissions + department) onto req.auth.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();
    const payload = verifyAccessToken(header.slice(7));

    const user = await User.findById(payload.sub).lean();
    if (!user || user.deletedAt || !user.isActive) throw AppError.unauthorized('Account is inactive');

    const role = await Role.findById(user.roleId).lean();
    if (!role) throw AppError.unauthorized('Role missing');

    req.auth = {
      userId: String(user._id),
      name: user.name,
      roleCode: role.code,
      permissions: (role.permissions ?? []) as Permission[],
      departmentId: user.departmentId ? String(user.departmentId) : null,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized('Invalid or expired session'));
  }
}

/** Optional auth: attaches req.auth when a valid token is present, else continues. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.get('authorization')) return next();
  return authenticate(req, res, () => next());
}
