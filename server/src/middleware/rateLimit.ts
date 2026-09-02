import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/** Broad limiter mounted on /api. */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.', code: 'RATE_LIMITED' },
});

/** Tight limiter for auth endpoints (login / forgot / reset). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
});
