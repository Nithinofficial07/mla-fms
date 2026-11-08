import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { expandOccurrences } from '@cal/shared';
import { layoutDay, viewRange, type CalendarItem } from './calendarUtils';

// 10:00 IST = 04:30Z
const at = (iso: string) => new Date(iso);

describe('expandOccurrences', () => {
  it('returns a one-off event only when it overlaps the window', () => {
    const ev = { start: at('2026-11-10T04:30:00Z'), end: at('2026-11-10T05:30:00Z') };
    expect(expandOccurrences(ev, at('2026-11-01T00:00:00Z'), at('2026-12-01T00:00:00Z'))).toHaveLength(1);
    expect(expandOccurrences(ev, at('2026-11-11T00:00:00Z'), at('2026-12-01T00:00:00Z'))).toHaveLength(0);
  });

  it('expands weekly events inside the window only', () => {
    const ev = { start: at('2026-01-05T04:30:00Z'), end: at('2026-01-05T05:30:00Z'), recurrence: 'WEEKLY' };
    const out = expandOccurrences(ev, at('2026-11-01T00:00:00Z'), at('2026-11-29T00:00:00Z'));
    expect(out.map((d) => d.toISOString())).toEqual([
      '2026-11-02T04:30:00.000Z', '2026-11-09T04:30:00.000Z', '2026-11-16T04:30:00.000Z', '2026-11-23T04:30:00.000Z',
    ]);
  });

  it('stops at the repeat-until day (inclusive)', () => {
    const ev = { start: at('2026-11-02T04:30:00Z'), end: at('2026-11-02T05:30:00Z'), recurrence: 'DAILY', recurrenceUntil: at('2026-11-04T18:30:00Z') };
    const out = expandOccurrences(ev, at('2026-11-01T00:00:00Z'), at('2026-11-30T00:00:00Z'));
    expect(out).toHaveLength(4); // 2, 3, 4, 5 Nov IST: until is 5 Nov 00:00 IST
  });

  it('keeps the same local day-of-month for monthly events and clamps short months', () => {
    // 31 Jan 10:00 IST
    const ev = { start: at('2026-01-31T04:30:00Z'), end: at('2026-01-31T05:30:00Z'), recurrence: 'MONTHLY' };
    const out = expandOccurrences(ev, at('2026-02-01T00:00:00Z'), at('2026-05-01T00:00:00Z'));
    expect(out.map((d) => d.toISOString())).toEqual([
      '2026-02-28T04:30:00.000Z', '2026-03-31T04:30:00.000Z', '2026-04-30T04:30:00.000Z',
    ]);
  });

  it('skips Sundays for weekday events', () => {
    // Fri 6 Nov 2026
    const ev = { start: at('2026-11-06T04:30:00Z'), end: at('2026-11-06T05:30:00Z'), recurrence: 'WEEKDAYS' };
    const out = expandOccurrences(ev, at('2026-11-06T00:00:00Z'), at('2026-11-10T00:00:00Z'));
    // Fri, Sat, Mon (Sun 8th skipped), Tue 10th is past the window end at 05:30 IST
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-11-06', '2026-11-07', '2026-11-09']);
  });
});

describe('layoutDay', () => {
  const mk = (id: string, s: string, e: string): CalendarItem => ({ id, kind: 'event', title: id, type: 'MEETING_OFFICIAL', start: s, end: e });

  it('puts overlapping events side by side and lone events full width', () => {
    const day = dayjs('2026-11-06');
    const out = layoutDay([
      mk('a', '2026-11-06T09:00', '2026-11-06T10:00'),
      mk('b', '2026-11-06T09:30', '2026-11-06T11:00'),
      mk('c', '2026-11-06T14:00', '2026-11-06T15:00'),
    ], day);
    const byId = Object.fromEntries(out.map((p) => [p.item.id, p]));
    expect(byId.a.cols).toBe(2);
    expect(byId.b.cols).toBe(2);
    expect(byId.a.col).not.toBe(byId.b.col);
    expect(byId.c.cols).toBe(1);
    expect(byId.a.top).toBe(9 * 60);
  });
});

describe('viewRange', () => {
  it('month view covers 6 full weeks starting on a Sunday', () => {
    const { from, to } = viewRange('month', dayjs('2026-11-15'));
    expect(from.day()).toBe(0);
    expect(to.diff(from, 'day')).toBe(42);
    expect(from.isBefore(dayjs('2026-11-01').add(1, 'minute'))).toBe(true);
  });
});
