/**
 * Calendar - the MLA's schedule and office events.
 * Shared by server (validation, recurrence expansion) and client (colours, labels).
 */

/**
 * Event types, colour-coded with Google Calendar's named colours (as the
 * office already uses them), grouped for the filter list and the picker.
 */
export const CALENDAR_EVENT_GROUPS = [
  { code: 'MEETING', label: 'Meetings' },
  { code: 'EVENT', label: 'Events' },
  { code: 'FIELD', label: 'Field work' },
  { code: 'PERSONAL', label: 'Personal' },
  { code: 'PARTY', label: 'Party' },
] as const;

export const CALENDAR_EVENT_TYPES = [
  { code: 'MEETING_OFFICIAL', group: 'MEETING', label: 'Official MLA Meeting', colorName: 'Blueberry', color: '#3F51B5', hint: 'Official MLA meetings' },
  { code: 'MEETING_GOVERNANCE', group: 'MEETING', label: 'Governance Meeting', colorName: 'Lavender', color: '#7986CB', hint: 'Governance / review meetings' },
  { code: 'EVENT_T1', group: 'EVENT', label: 'Event T1 - Chief Guest', colorName: 'Flamingo', color: '#E67C73', hint: 'Chief guest, felicitation, etc.' },
  { code: 'EVENT_T2', group: 'EVENT', label: 'Event T2 - Family Function', colorName: 'Mango', color: '#F09300', hint: 'Wedding, Namakarana, Shreemathi Karya, Gruhapravesha, Birthday, etc.' },
  { code: 'EVENT_T2B', group: 'EVENT', label: 'Event T2B - Store Opening', colorName: 'Banana', color: '#F6BF26', hint: 'Store / shop openings' },
  { code: 'EVENT_T3', group: 'EVENT', label: 'Event T3 - Devasthana / Matha', colorName: 'Tangerine', color: '#F4511E', hint: 'Temple (Devasthana) and Matha events' },
  { code: 'SITE_VISIT', group: 'FIELD', label: 'Site Visit', colorName: 'Basil', color: '#0B8043', hint: 'Work sites, inspections' },
  { code: 'JANA_SAMPARKA', group: 'FIELD', label: 'Jana Samparka', colorName: 'Sage', color: '#33B679', hint: 'Meeting the public' },
  { code: 'BOOTH_NADIGE', group: 'FIELD', label: 'Boothina Nadige', colorName: 'Pistachio', color: '#7CB342', hint: 'Booth-level visits' },
  { code: 'PERSONAL', group: 'PERSONAL', label: 'Personal', colorName: 'Tomato', color: '#D50000', hint: 'Personal / family time' },
  { code: 'PARTY', group: 'PARTY', label: 'Congress Party Event', colorName: 'Citron', color: '#E4C441', hint: 'INC party programmes and meetings' },
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

/** Colour for the read-only "request deadline" layer (Graphite - kept apart from Tomato / Personal). */
export const CALENDAR_DEADLINE_COLOR = '#616161';

export const CALENDAR_DEFAULT_TYPE: CalendarEventType = 'MEETING_OFFICIAL';

/**
 * Old type codes from the first version of the calendar, and what they now
 * map to. Used by the startup migration so existing events keep a valid type.
 */
export const CALENDAR_LEGACY_TYPE_MAP: Record<string, CalendarEventType> = {
  MEETING: 'MEETING_OFFICIAL',
  REVIEW: 'MEETING_GOVERNANCE',
  ASSEMBLY: 'MEETING_OFFICIAL',
  DEADLINE: 'MEETING_OFFICIAL',
  OTHER: 'MEETING_GOVERNANCE',
  PUBLIC_EVENT: 'EVENT_T1',
  INAUGURATION: 'EVENT_T1',
  JANATA_DARSHAN: 'JANA_SAMPARKA',
};

type TypeMeta = { code: string; group: string; label: string; colorName: string; color: string; hint: string };
const UNKNOWN_TYPE: TypeMeta = { code: 'UNKNOWN', group: 'MEETING', label: 'Event', colorName: 'Graphite', color: '#616161', hint: '' };

export function calendarTypeMeta(code: string): TypeMeta {
  const mapped = CALENDAR_LEGACY_TYPE_MAP[code] ?? code;
  return CALENDAR_EVENT_TYPES.find((t) => t.code === mapped) ?? UNKNOWN_TYPE;
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
