import dayjs from 'dayjs';
import {
  CALENDAR_PRIVATE_BY_DEFAULT, CALENDAR_REAL_CODES, expandMembers, expandOccurrences,
  type CalendarEventType,
} from '@mla/shared';
import { CalendarEvent } from '../../models/CalendarEvent.js';
import { CalendarEventLog } from '../../models/CalendarEventLog.js';
import { Principal } from '../../models/Principal.js';
import { AppError } from '../../utils/AppError.js';
import { withId } from '../../utils/queryFeatures.js';

/**
 * A user's own calendar access, as codes (never includes SS_FAMILY itself).
 * Calendar access rides on the same principalIds every other module uses - a
 * user who can see MLA-South's requests can see MLA-South's calendar. There
 * is no separate "calendar access" grant; CALENDAR_VIEW/MANAGE gate the
 * feature as a whole, these codes gate *which* calendars within it.
 */
export async function myCalendarCodes(auth: Express.AuthContext): Promise<string[]> {
  if (!auth.principalIds.length) return [];
  const principals = await Principal.find({ _id: { $in: auth.principalIds } }).select('code').lean();
  return principals.map((p) => p.code).filter((c) => (CALENDAR_REAL_CODES as readonly string[]).includes(c));
}

export function scopeFilter(codes: string[], viewAll: boolean): Record<string, unknown> {
  return viewAll ? {} : { members: { $in: codes } };
}

export async function loadScoped(id: string, codes: string[], viewAll: boolean) {
  const doc = await CalendarEvent.findOne({ _id: id, ...scopeFilter(codes, viewAll) });
  if (!doc) throw AppError.notFound('Event not found');
  return doc;
}

/** Resolves the `members` array to store: expands SS_FAMILY, de-dupes, validates against the real codes. */
export function resolveMembers(input: string[] | undefined): string[] {
  const expanded = expandMembers(input ?? []);
  return expanded;
}

export function defaultPublicSchedule(type: string): boolean {
  return !CALENDAR_PRIVATE_BY_DEFAULT.includes(type as CalendarEventType);
}

/** Appends one line to the event's change log. Never throws - a log failure shouldn't fail the write it's recording. */
export async function logChange(eventId: string, title: string, action: string, detail: string[], userId: string, userName: string) {
  try {
    await CalendarEventLog.create({ eventId, title, action, detail, by: userId, byName: userName });
  } catch {
    /* best-effort */
  }
}

export interface ClashResult {
  memberCode: string;
  reason: 'GOING' | 'AWAY';
  event: { id: string; title: string; start: Date; end: Date };
}

/**
 * Checks whether any of `members` is already committed elsewhere at this
 * time: either RSVP'd Going to an overlapping event, or marked Away
 * (UNAVAILABLE type) that day. Non-blocking by design - callers show this as
 * a warning, never a hard stop.
 */
export async function findClashes(
  members: string[],
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<ClashResult[]> {
  if (!members.length) return [];
  const filter: Record<string, unknown> = {
    members: { $in: members },
    start: { $lt: end },
    end: { $gt: start },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const candidates = await CalendarEvent.find(filter).select('title start end type members rsvp').lean({ flattenMaps: true });
  const out: ClashResult[] = [];
  for (const ev of candidates) {
    for (const code of members) {
      if (!(ev.members as string[]).includes(code)) continue;
      const isAway = ev.type === 'UNAVAILABLE';
      const going = (ev.rsvp as Record<string, string> | undefined)?.[code] === 'GOING';
      if (isAway || going) {
        out.push({
          memberCode: code,
          reason: isAway ? 'AWAY' : 'GOING',
          event: { id: String(ev._id), title: ev.title, start: ev.start, end: ev.end },
        });
      }
    }
  }
  return out;
}

/**
 * Shapes one CalendarEvent doc for the API: `id` instead of `_id`, and the
 * rsvp/attendance/social Maps as plain objects. Queries that feed this should
 * already use `.lean({ flattenMaps: true })`; the Map check here is a no-op
 * safety net for anything that doesn't (e.g. a live Mongoose document, whose
 * own toJSON() flattens Maps anyway, but may reach here via toObject()).
 * "SS Family" badge collapsing is a display concern - the client derives it
 * from `members` with `isWholeFamily()` rather than carrying a redundant flag.
 */
export function toApiShape(doc: Record<string, any>) {
  const plain = withId(doc) as Record<string, any>;
  for (const key of ['rsvp', 'attendance', 'social'] as const) {
    if (plain[key] instanceof Map) plain[key] = Object.fromEntries(plain[key]);
  }
  return plain;
}

export interface ExpandedItem extends Record<string, unknown> {
  kind: 'event' | 'deadline';
}

/** Every occurrence of every scoped event overlapping [from, to), recurring events expanded. */
export async function expandEventsInRange(filter: Record<string, unknown>, from: Date, to: Date): Promise<ExpandedItem[]> {
  const events = await CalendarEvent.find({
    ...filter,
    start: { $lt: to },
    $or: [
      { recurrence: { $in: [null, 'NONE'] }, end: { $gte: from } },
      { recurrence: { $nin: [null, 'NONE'] }, $or: [{ recurrenceUntil: null }, { recurrenceUntil: { $gte: dayjs(from).subtract(1, 'day').toDate() } }] },
    ],
  }).sort('start').lean({ flattenMaps: true });

  const items: ExpandedItem[] = [];
  for (const ev of events) {
    const base = toApiShape(ev);
    const duration = new Date(ev.end).getTime() - new Date(ev.start).getTime();
    const recurring = !!ev.recurrence && ev.recurrence !== 'NONE';
    for (const occStart of expandOccurrences(ev, from, to)) {
      items.push({
        ...base,
        kind: 'event',
        eventId: base.id,
        id: recurring ? `${base.id}:${occStart.toISOString()}` : base.id,
        isRecurring: recurring,
        seriesStart: ev.start,
        seriesEnd: ev.end,
        start: occStart,
        end: new Date(occStart.getTime() + duration),
      });
    }
  }
  return items;
}

export { CALENDAR_REAL_CODES };
