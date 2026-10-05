import { describe, it, expect } from 'vitest';
import { toAlpha, toRoman } from './locationPayload';

describe('toAlpha (Gram Panchayat display order)', () => {
  it('renders 1-8 as A-H', () => {
    expect(toAlpha(1)).toBe('A');
    expect(toAlpha(8)).toBe('H');
  });
  it('returns empty for 0/unset, falls back to the number past Z', () => {
    expect(toAlpha(0)).toBe('');
    expect(toAlpha(27)).toBe('27');
  });
});

describe('toRoman (Village display order)', () => {
  it('renders 1-8 as Roman numerals', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(8)).toBe('VIII');
  });
  it('returns empty for 0/unset, falls back to the number past X', () => {
    expect(toRoman(0)).toBe('');
    expect(toRoman(11)).toBe('11');
  });
});
