/**
 * Calendar - the MLA's schedule and office events.
 * Shared by server (validation, recurrence expansion) and client (colours, labels).
 */

export const CALENDAR_EVENT_TYPES = [
  { code: 'MEETING', label: 'Meeting', color: '#3B82F6' },
  { code: 'PUBLIC_EVENT', label: 'Public Event', color: '#C99700' },
  { code: 'SITE_VISIT', label: 'Site Visit', color: '#10B981' },
  { code: 'JANATA_DARSHAN', label: 'Janata Darshan', color: '#8B5CF6' },
  { code: 'REVIEW', label: 'Review Meeting', color: '#0EA5E9' },
  { code: 'ASSEMBLY', label: 'Assembly / Session', color: '#EF4444' },
  { code: 'INAUGURATION', label: 'Inauguration / Foundation', color: '#F97316' },
  { code: 'DEADLINE', label: 'Deadline', color: '#E11D48' },
  { code: 'PERSONAL', label: 'Personal', color: '#64748B' },
  { code: 'OTHER', label: 'Other', color: '#14B8A6' },
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number]['code'];
export const CALENDAR_EVENT_TYPE_CODES = CALENDAR_EVENT_TYPES.map((t) => t.code) as [CalendarEventType, ...CalendarEventType[]];

export const CALENDAR_EVENT_STATUSES = ['SCHEDULED', 'TENTATIVE', 'COMPLETED', 'CANCELLED'] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_RECURRENCE = [
  { code: 'NONE', label: 'Does not repeat' },
  { code: 'DAILY', label: 'Every day' },
  { code: 'WEEKDAYS', label: 'Every weekday (Mon–Sat)' },
  { code: 'WEEKLY', label: 'Every week' },
  { code: 'MONTHLY', label: 'Every month' },
  { code: 'YEARLY', label: 'Every year' },
] as const;
export type CalendarRecurrence = (typeof CALENDAR_RECURRENCE)[number]['code'];
export const CALENDAR_RECURRENCE_CODES = CALENDAR_RECURRENCE.map((r) => r.code) as [CalendarRecurrence, ...CalendarRecurrence[]];

/** Colour for the read-only "request deadline" layer. */
export const CALENDAR_DEADLINE_COLOR = '#DC2626';

export function calendarTypeMeta(code: string) {
  return CALENDAR_EVENT_TYPES.find((t) => t.code === code) ?? CALENDAR_EVENT_TYPES[CALENDAR_EVENT_TYPES.length - 1];
}

const DAY = 86_400_000;
/** India has no DST, so wall-clock maths in a fixed +05:30 offset is exact. */
const DEFAULT_TZ_OFFSET_MIN = 330;

/** Shifts an instant by whole calendar months, in the office's local wall-clock time (clamps 31st -> 30th etc). */
function addMonthsLocal(d: Date, months: number, tzOffsetMin: number): Date {
  const shifted = new Date(d.getTime() + tzOffsetMin * 60_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + months;
  const day = shifted.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(y, m, Math.min(day, lastDay), shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds()));
  return new Date(out.getTime() - tzOffsetMin * 60_000);
}

function localWeekday(d: Date, tzOffsetMin: number): number {
  return new Date(d.getTime() + tzOffsetMin * 60_000).getUTCDay();
}

export interface RecurringLike {
  start: Date | string;
  end: Date | string;
  recurrence?: string | null;
  recurrenceUntil?: Date | string | null;
}

/**
 * Start instants of every occurrence of `ev` that overlaps [from, to).
 * Non-repeating events return their own start when they overlap.
 * Capped at 1000 steps per event so a bad rule can't hang a request.
 */
export function expandOccurrences(
  ev: RecurringLike,
  from: Date,
  to: Date,
  tzOffsetMin = DEFAULT_TZ_OFFSET_MIN,
): Date[] {
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  const duration = Math.max(0, end.getTime() - start.getTime());
  const rule = (ev.recurrence ?? 'NONE') as CalendarRecurrence;
  const until = ev.recurrenceUntil ? new Date(ev.recurrenceUntil) : null;
  // An "until" date includes that whole day.
  const untilEnd = until ? new Date(until.getTime() + DAY - 1) : null;

  const overlaps = (s: Date) => s.getTime() < to.getTime() && s.getTime() + Math.max(duration, 1) > from.getTime();

  if (rule === 'NONE') return overlaps(start) ? [start] : [];

  const out: Date[] = [];
  const next = (d: Date, i: number): Date => {
    switch (rule) {
      case 'DAILY': return new Date(start.getTime() + i * DAY);
      case 'WEEKLY': return new Date(start.getTime() + i * 7 * DAY);
      case 'MONTHLY': return addMonthsLocal(start, i, tzOffsetMin);
      case 'YEARLY': return addMonthsLocal(start, i * 12, tzOffsetMin);
      case 'WEEKDAYS': {
        let n = new Date(d.getTime() + DAY);
        while (localWeekday(n, tzOffsetMin) === 0) n = new Date(n.getTime() + DAY); // skip Sundays
        return n;
      }
      default: return new Date(Number.POSITIVE_INFINITY);
    }
  };

  // Jump close to the window for the fixed-step rules, so far-past series stay cheap.
  let i = 0;
  let cur = start;
  if ((rule === 'DAILY' || rule === 'WEEKLY') && from.getTime() - duration > start.getTime()) {
    const step = rule === 'DAILY' ? DAY : 7 * DAY;
    i = Math.max(0, Math.floor((from.getTime() - duration - start.getTime()) / step));
    cur = next(start, i);
  }
  if (rule === 'WEEKDAYS' && localWeekday(cur, tzOffsetMin) === 0) cur = next(cur, 0);

  for (let guard = 0; guard < 1000; guard++) {
    if (cur.getTime() >= to.getTime()) break;
    if (untilEnd && cur.getTime() > untilEnd.getTime()) break;
    if (overlaps(cur)) out.push(cur);
    i += 1;
    cur = next(cur, i);
  }
  return out;
}
