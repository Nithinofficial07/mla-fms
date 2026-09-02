import { describe, it, expect } from 'vitest';
import { formatId } from '@mla/shared';

describe('formatId', () => {
  it('pads the sequence and substitutes the year', () => {
    expect(formatId({ format: 'MLA/{YYYY}/{SEQ:6}', seq: 123, date: new Date('2026-09-01') })).toBe('MLA/2026/000123');
  });
  it('supports 2-digit year and month', () => {
    expect(formatId({ format: '{YY}{MM}-{SEQ:3}', seq: 7, date: new Date('2026-03-01') })).toBe('2603-007');
  });
  it('leaves unknown tokens intact', () => {
    expect(formatId({ format: '{FOO}-{SEQ:2}', seq: 4 })).toBe('{FOO}-04');
  });
});
