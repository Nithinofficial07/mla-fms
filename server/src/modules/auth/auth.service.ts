import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser, LoginResponse } from '@mla/shared';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { logger } from '../../config/logger.js';

function toAuthUser(user: any, role: any): AuthUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    username: user.username,
    roleCode: role.code,
    permissions: role.permissions ?? [],
    departmentId: user.departmentId ? String(user.departmentId) : null,
    mustChangePassword: !!user.mustChangePassword,
  };
}

export const authService = {
  async login(usernameOrEmail: string, password: string): Promise<LoginResponse & { refreshToken: string }> {
    const id = usernameOrEmail.toLowerCase().trim();
    const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select('+passwordHash +tokenVersion');
    if (!user || !user.isActive || user.deletedAt) throw AppError.unauthorized('Invalid credentials');

    const okPw = await verifyPassword(password, user.passwordHash);
    if (!okPw) throw AppError.unauthorized('Invalid credentials');

    const role = await Role.findById(user.roleId).lean();
    if (!role) throw AppError.unauthorized('Role missing');

    user.lastLoginAt = new Date();
    await user.save();

    return {
      accessToken: signAccessToken({
        sub: String(user._id),
        roleCode: role.code,
        departmentId: user.departmentId ? String(user.departmentId) : null,
      }),
      refreshToken: signRefreshToken({ sub: String(user._id), tokenVersion: user.tokenVersion ?? 0 }),
      user: toAuthUser(user, role),
    };
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Session expired. Please login again.');
    }
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user || !user.isActive || user.deletedAt) throw AppError.unauthorized();
    if ((user.tokenVersion ?? 0) !== payload.tokenVersion) throw AppError.unauthorized('Session revoked');

    const role = await Role.findById(user.roleId).lean();
    if (!role) throw AppError.unauthorized();

    return {
      accessToken: signAccessToken({
        sub: String(user._id),
        roleCode: role.code,
        departmentId: user.departmentId ? String(user.departmentId) : null,
      }),
      user: toAuthUser(user, role),
    };
  },

  /** Invalidate all refresh tokens for a user (logout-all / password change). */
  async bumpTokenVersion(userId: string): Promise<void> {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await User.findById(userId);
    if (!user) throw AppError.unauthorized();
    const role = await Role.findById(user.roleId).lean();
    return toAuthUser(user, role);
  },

  /** Returns the raw reset token (caller emails it); only its hash is stored. */
  async createPasswordReset(email: string): Promise<string | null> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return null; // do not leak which emails exist
    const raw = randomBytes(32).toString('hex');
    user.set('passwordResetToken', createHash('sha256').update(raw).digest('hex'));
    user.set('passwordResetExpires', new Date(Date.now() + 60 * 60 * 1000));
    await user.save();
    logger.info({ userId: String(user._id) }, 'password reset requested');
    return raw;
  },

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +tokenVersion');
    if (!user) throw AppError.badRequest('Reset link is invalid or has expired');
    user.passwordHash = await hashPassword(newPassword);
    user.set('passwordResetToken', undefined);
    user.set('passwordResetExpires', undefined);
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
  },

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash +tokenVersion');
    if (!user) throw AppError.unauthorized();
    if (!(await verifyPassword(current, user.passwordHash))) {
      throw AppError.badRequest('Current password is incorrect');
    }
    user.passwordHash = await hashPassword(next);
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
  },
};
