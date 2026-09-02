import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * QR tokens carry ONLY an opaque signed reference to a request id - never
 * applicant data. Scanning resolves the token server-side after the viewer
 * authenticates, then redirects to the file page.
 */
export function makeQrToken(requestId: string): string {
  return jwt.sign({ rid: requestId, purpose: 'file-qr' }, env.JWT_SECRET, { expiresIn: '365d' });
}

export function readQrToken(token: string): string {
  const decoded = jwt.verify(token, env.JWT_SECRET) as { rid: string; purpose: string };
  if (decoded.purpose !== 'file-qr' || !decoded.rid) throw new Error('bad token');
  return decoded.rid;
}

export function qrTargetUrl(token: string): string {
  return new URL(`/f/${token}`, env.FRONTEND_URL).toString();
}
