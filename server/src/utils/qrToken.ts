import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * QR tokens carry ONLY an opaque signed reference to a request id - never
 * applicant data. Scanning opens a public, unauthenticated tracking page
 * (GET /api/public/qr/:token) that resolves the token fresh on every scan.
 */
export function makeQrToken(requestId: string): string {
  return jwt.sign({ rid: requestId, purpose: 'file-qr' }, env.JWT_SECRET, { expiresIn: '365d' });
}

export function readQrToken(token: string): string {
  const decoded = jwt.verify(token, env.JWT_SECRET) as { rid: string; purpose: string };
  if (decoded.purpose !== 'file-qr' || !decoded.rid) throw new Error('bad token');
  return decoded.rid;
}

/**
 * Builds the URL embedded in the QR image. Prefers the origin the cover
 * sheet was actually generated from (the real host the staff member is
 * using - dev, prod, a LAN IP, whatever) over the FRONTEND_URL env var, so a
 * missing/stale env var can't bake a dead "localhost" link into a printed
 * cover sheet's QR code.
 */
export function qrTargetUrl(token: string, origin?: string): string {
  return new URL(`/f/${token}`, origin || env.FRONTEND_URL).toString();
}
