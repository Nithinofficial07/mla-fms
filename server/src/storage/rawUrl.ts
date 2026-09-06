import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Same-origin, expiring, tokenised document URL - used by BOTH storage
 * providers so the browser always loads `/api/documents/raw?...` from the app
 * itself (no cross-origin S3 URL, so a tight CSP `default-src 'self'` still
 * allows previews/downloads). The `/raw` route verifies the token then streams
 * the object from whichever provider is configured.
 *
 * Relative on purpose: it resolves against the page origin, so it works
 * regardless of how BACKEND_URL is set.
 */
export function signRawUrl(
  key: string,
  opts: { download?: boolean; filename?: string } = {},
): string {
  const exp = Date.now() + env.S3_SIGNED_URL_TTL * 1000;
  const sig = sign(key, exp);
  const p = new URLSearchParams({ key, exp: String(exp), sig });
  if (opts.download) p.set('download', '1');
  if (opts.filename) p.set('filename', opts.filename);
  return `/api/documents/raw?${p.toString()}`;
}

export function verifyRawToken(key: string, exp: number, sig: string): boolean {
  if (!key || !sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(key, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(key: string, exp: number): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${key}:${exp}`).digest('hex');
}
