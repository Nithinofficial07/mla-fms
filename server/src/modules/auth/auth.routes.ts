import { Router } from 'express';
import { env } from '../../config/env.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { REFRESH_COOKIE } from '../../utils/jwt.js';
import { authService } from './auth.service.js';
import {
  changePasswordSchema, forgotSchema, loginSchema, resetSchema,
} from './auth.validation.js';

const router = Router();

// Browsers reject a cookie's Domain attribute when it's a bare IP address
// (RFC 6265) - and an empty COOKIE_DOMAIN means "host-only cookie" (LAN
// access by IP, or before a real domain is assigned). Omit the attribute in
// both cases instead of sending a Domain the browser will silently drop.
const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const cookieDomain = env.COOKIE_DOMAIN && !IP_RE.test(env.COOKIE_DOMAIN) ? env.COOKIE_DOMAIN : undefined;

const cookieOpts = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = req.body;
    try {
      const { refreshToken, ...payload } = await authService.login(usernameOrEmail, password);
      res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
      recordAudit(req, { action: 'LOGIN', entity: 'User', entityId: payload.user.id });
      ok(res, payload);
    } catch (err) {
      recordAudit(req, { action: 'LOGIN_FAILED', entity: 'User', message: usernameOrEmail });
      throw err;
    }
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ message: 'No session', code: 'UNAUTHORIZED' });
    const payload = await authService.refresh(token);
    ok(res, payload);
  }),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.bumpTokenVersion(req.auth!.userId);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    recordAudit(req, { action: 'LOGOUT', entity: 'User', entityId: req.auth!.userId });
    ok(res, { ok: true });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => ok(res, await authService.me(req.auth!.userId))),
);

router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotSchema }),
  asyncHandler(async (req, res) => {
    const raw = await authService.createPasswordReset(req.body.email);
    // In production this token is emailed. Dev returns it for convenience.
    const devToken = env.NODE_ENV !== 'production' ? raw : undefined;
    ok(res, { message: 'If the email exists, a reset link has been sent.', devToken });
  }),
);

router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    recordAudit(req, { action: 'PASSWORD_RESET', entity: 'User' });
    ok(res, { message: 'Password updated. Please login.' });
  }),
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword);
    recordAudit(req, { action: 'PASSWORD_RESET', entity: 'User', entityId: req.auth!.userId, message: 'self change' });
    ok(res, { message: 'Password changed. Please login again.' });
  }),
);

export default router;
