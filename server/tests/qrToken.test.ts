import { describe, it, expect } from 'vitest';
import { makeQrToken, readQrToken, qrTargetUrl } from '../src/utils/qrToken.js';

describe('qrToken', () => {
  it('round-trips a request id through sign + verify', () => {
    const token = makeQrToken('6aa3b0310873oaf43159a2a8');
    expect(readQrToken(token)).toBe('6aa3b0310873oaf43159a2a8');
  });

  it('rejects a garbage token', () => {
    expect(() => readQrToken('not-a-real-token')).toThrow();
  });

  it('builds the QR link from the caller-supplied origin, not FRONTEND_URL - so a cover sheet always points at the host it was actually generated from', () => {
    const url = qrTargetUrl('tok123', 'https://mla-fms-dev.onrender.com');
    expect(url).toBe('https://mla-fms-dev.onrender.com/f/tok123');
    expect(url).not.toContain('localhost');
  });

  it('falls back to FRONTEND_URL only when no origin is supplied (e.g. test env, which defaults to localhost)', () => {
    const url = qrTargetUrl('tok123');
    expect(url).toBe('http://localhost:5173/f/tok123');
  });
});
