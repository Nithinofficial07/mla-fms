import type { NextFunction, Request, Response } from 'express';
import { PERMISSIONS, type Permission } from '@mla/shared';
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

    const permissions = (role.permissions ?? []) as Permission[];
    const allPrincipalIds = (user.principalIds ?? []).map((id) => String(id));
    const requestedPrincipal = req.get('x-principal-id');
    const hasAllView = permissions.includes(PERMISSIONS.PRINCIPAL_ALL_VIEW);

    // A PRINCIPAL_ALL_VIEW user (e.g. Super Admin) isn't limited to their own
    // principalIds - they may narrow to ANY single principal via the header
    // to actually filter their view, or send none to see everything.
    // Everyone else can only ever narrow within their own real principals
    // (never widen past them), same as before.
    let principalIds: string[];
    let viewAllPrincipals: boolean;
    if (hasAllView) {
      principalIds = requestedPrincipal ? [requestedPrincipal] : [];
      viewAllPrincipals = !requestedPrincipal;
    } else {
      principalIds = requestedPrincipal && allPrincipalIds.includes(requestedPrincipal)
        ? [requestedPrincipal]
        : allPrincipalIds;
      viewAllPrincipals = false;
    }

    req.auth = {
      userId: String(user._id),
      name: user.name,
      roleCode: role.code,
      permissions,
      departmentId: user.departmentId ? String(user.departmentId) : null,
      principalIds,
      viewAllPrincipals,
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
