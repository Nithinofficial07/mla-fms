/**
 * Calendar - the MLA/MP office's shared schedule.
 * Shared by server (validation, recurrence expansion) and client (colours, labels).
 */

/**
 * The 4 "calendars" people invite to an event. MLA_S/MLA_N/MP are the same
 * codes as the Principal collection (one real office each); SS_FAMILY is a
 * pure UI convenience meaning "everyone" - it expands to the other 3 at save
 * time and is never stored on an event itself.
 */
export const CALENDAR_CODES = [
  { code: 'MLA_S', label: 'MLA - Davanagere South', title: 'MLA South', short: 'South', badge: 'S', color: '#1E88E5' },
  { code: 'MLA_N', label: 'MLA - Davanagere North', title: 'MLA North', short: 'North', badge: 'N', color: '#00897B' },
  { code: 'MP', label: 'MP - Davanagere', title: 'MP', short: 'MP', badge: 'MP', color: '#8E24AA' },
] as const;
export type CalendarCode = (typeof CALENDAR_CODES)[number]['code'];
export const CALENDAR_REAL_CODES = CALENDAR_CODES.map((c) => c.code) as [CalendarCode, ...CalendarCode[]];

export const CALENDAR_SS_FAMILY = {
  code: 'SS_FAMILY', label: 'SS Family (everyone)', title: 'SS Family', short: 'SS Family', badge: 'SS', color: '#D81B60',
} as const;

/** Expands SS_FAMILY to the 3 real codes; any real code passes through unchanged. De-duplicated. */
export function expandMembers(codes: string[]): CalendarCode[] {
  const out = new Set<CalendarCode>();
  for (const c of codes) {
    if (c === CALENDAR_SS_FAMILY.code) CALENDAR_REAL_CODES.forEach((r) => out.add(r));
    else if ((CALENDAR_REAL_CODES as string[]).includes(c)) out.add(c as CalendarCode);
  }
  return [...out];
}

/** True when `members` is exactly the 3 real codes - i.e. the UI should show it collapsed back to "SS Family". */
export function isWholeFamily(members: string[]): boolean {
  return CALENDAR_REAL_CODES.every((c) => members.includes(c)) && members.length >= CALENDAR_REAL_CODES.length;
}

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
  { code: 'AWAY', label: 'Away' },
] as const;

export const CALENDAR_EVENT_TYPES = [
  { code: 'MEETING_OFFICIAL', group: 'MEETING', label: 'Official Meeting', colorName: 'Blueberry', color: '#3F51B5', hint: 'Official meetings' },
  { code: 'MEETING_GOVERNANCE', group: 'MEETING', label: 'Governance Meeting', colorName: 'Lavender', color: '#7986CB', hint: 'Governance / review meetings' },
  { code: 'EVENT_T1', group: 'EVENT', label: 'Event T1 - Chief Guest', colorName: 'Flamingo', color: '#E67C73', hint: 'Chief guest, felicitation, etc.' },
  { code: 'EVENT_T2', group: 'EVENT', label: 'Event T2 - Family Function', colorName: 'Mango', color: '#F09300', hint: 'Wedding, Namakarana, Shreemathi Karya, Gruhapravesha, Birthday, etc.' },
  { code: 'EVENT_T2B', group: 'EVENT', label: 'Event T2B - Store Opening', colorName: 'Banana', color: '#F6BF26', hint: 'Store / shop openings' },
  { code: 'EVENT_T3', group: 'EVENT', label: 'Event T3 - Devasthana / Matha', colorName: 'Tangerine', color: '#F4511E', hint: 'Temple (Devasthana) and Matha events' },
  { code: 'EVENT_FUNERAL', group: 'EVENT', label: 'Funeral', colorName: 'Graphite', color: '#616161', hint: 'Funerals and condolence visits' },
  { code: 'SITE_VISIT', group: 'FIELD', label: 'Site Visit', colorName: 'Basil', color: '#0B8043', hint: 'Work sites, inspections' },
  { code: 'JANA_SAMPARKA', group: 'FIELD', label: 'Jana Samparka', colorName: 'Sage', color: '#33B679', hint: 'Meeting the public' },
  { code: 'BOOTH_NADIGE', group: 'FIELD', label: 'Booth / Gramina Nadige', colorName: 'Pistachio', color: '#7CB342', hint: 'Booth-level and village visits' },
  { code: 'PERSONAL', group: 'PERSONAL', label: 'Personal', colorName: 'Tomato', color: '#D50000', hint: 'Personal / family time' },
  { code: 'PARTY', group: 'PARTY', label: 'Party Event', colorName: 'Citron', color: '#E4C441', hint: 'Party programmes and meetings' },
  { code: 'PARTY_PROTEST', group: 'PARTY', label: 'Protest', colorName: 'Cocoa', color: '#795548', hint: 'Protests and dharnas' },
  { code: 'UNAVAILABLE', group: 'AWAY', label: 'Out of station / Unavailable', colorName: 'Grey', color: '#90A4AE', hint: 'Parliament or Assembly session, travel, leave - blocks the day' },
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number]['code'];
export const CALENDAR_EVENT_TYPE_CODES = CALENDAR_EVENT_TYPES.map((t) => t.code) as [CalendarEventType, ...CalendarEventType[]];

/** Types that default to NOT shown on the public schedule / social posts (everything else defaults to true). */
export const CALENDAR_PRIVATE_BY_DEFAULT: CalendarEventType[] = ['MEETING_OFFICIAL', 'MEETING_GOVERNANCE', 'PERSONAL', 'UNAVAILABLE'];

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

export const CALENDAR_RSVP_STATUSES = ['GOING', 'UNDECIDED', 'NOT_GOING'] as const;
export type CalendarRsvpStatus = (typeof CALENDAR_RSVP_STATUSES)[number];

export const CALENDAR_ATTENDANCE_STATUSES = ['ATTENDED', 'REPRESENTATIVE', 'NOT_ATTENDED'] as const;
export type CalendarAttendanceStatus = (typeof CALENDAR_ATTENDANCE_STATUSES)[number];

export const CALENDAR_ORGANISER_KINDS = ['IND', 'SANGA'] as const;
export type CalendarOrganiserKind = (typeof CALENDAR_ORGANISER_KINDS)[number];

export const CALENDAR_ORGANISER_REPLY_STATUSES = ['PENDING', 'CONFIRMED', 'REGRET'] as const;
export type CalendarOrganiserReply = (typeof CALENDAR_ORGANISER_REPLY_STATUSES)[number];

export const CALENDAR_ROLE_AT_EVENT = ['CHIEF_GUEST', 'INAUGURATOR', 'GUEST_OF_HONOUR', 'PRESIDING', 'SPEAKER', 'GUEST'] as const;
export type CalendarRoleAtEvent = (typeof CALENDAR_ROLE_AT_EVENT)[number];

export const CALENDAR_PREP_ITEMS = ['SHAWL', 'MEMENTO', 'DONATION', 'SPEECH', 'PRESS', 'PHOTO', 'POLICE', 'VEHICLE'] as const;
export type CalendarPrepItem = (typeof CALENDAR_PREP_ITEMS)[number];

export const CALENDAR_SOCIAL_STATUSES = ['POSTED', 'SKIPPED'] as const;
export type CalendarSocialStatus = (typeof CALENDAR_SOCIAL_STATUSES)[number];

export const CALENDAR_SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'X (Twitter)', 'WhatsApp Channel', 'YouTube'] as const;

export const CALENDAR_ATTACHMENT_LABELS = ['Invitation', 'Agenda', 'Notes', 'Letter', 'Photo', 'Event photo', 'Other'] as const;
export type CalendarAttachmentLabel = (typeof CALENDAR_ATTACHMENT_LABELS)[number];

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
  // 2nd-generation codes (pre multi-member rebuild), kept for the startup remap.
  BOOTH_NADIGE_OLD: 'BOOTH_NADIGE',
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
