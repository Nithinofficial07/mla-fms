import { z } from 'zod';
import {
  CALENDAR_ATTENDANCE_STATUSES, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPE_CODES, CALENDAR_ORGANISER_KINDS,
  CALENDAR_ORGANISER_REPLY_STATUSES, CALENDAR_PREP_ITEMS, CALENDAR_REAL_CODES, CALENDAR_RECURRENCE_CODES,
  CALENDAR_ROLE_AT_EVENT, CALENDAR_RSVP_STATUSES, CALENDAR_SOCIAL_PLATFORMS, CALENDAR_SOCIAL_STATUSES,
  CALENDAR_SS_FAMILY,
} from '@mla/shared';

const objectId = z.string().length(24, 'Invalid id');

/** Members as accepted from the client: the 3 real codes, or the SS Family shortcut that expands to all 3. */
const memberCode = z.enum([...CALENDAR_REAL_CODES, CALENDAR_SS_FAMILY.code]);

const sessionSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  arrival: z.string().trim().max(10).optional(),
});

const speechSchema = z.object({
  needed: z.boolean().optional(),
  kn: z.string().max(20_000).optional(),
  en: z.string().max(20_000).optional(),
});

const base = z.object({
  members: z.array(memberCode).min(1, 'Pick at least one calendar'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(20_000).optional(),
  type: z.enum(CALENDAR_EVENT_TYPE_CODES).optional(),
  status: z.enum(CALENDAR_EVENT_STATUSES).optional(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  allDay: z.boolean().optional(),
  recurrence: z.enum(CALENDAR_RECURRENCE_CODES).optional(),
  recurrenceUntil: z.coerce.date().nullable().optional(),
  venue: z.string().trim().max(300).optional(),
  area: z.string().trim().max(300).optional(),
  organizer: z.string().trim().max(200).optional(),
  organizerKind: z.enum(CALENDAR_ORGANISER_KINDS).optional(),
  contactName: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  contact2Name: z.string().trim().max(200).optional(),
  contact2Phone: z.string().trim().max(20).optional(),
  attendees: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  role: z.enum(CALENDAR_ROLE_AT_EVENT).nullable().optional(),
  prep: z.array(z.enum(CALENDAR_PREP_ITEMS)).optional(),
  prepDone: z.array(z.enum(CALENDAR_PREP_ITEMS)).optional(),
  prepNote: z.string().max(4000).optional(),
  arrival: z.string().trim().max(10).optional(),
  sessions: z.array(sessionSchema).max(60).optional(),
  speech: speechSchema.optional(),
  reply: z.enum(CALENDAR_ORGANISER_REPLY_STATUSES).optional(),
  publicSchedule: z.boolean().optional(),
  writeup: z.string().max(10_000).optional(),
  draft: z.boolean().optional(),
  dateUnknown: z.boolean().optional(),
});

const endAfterStart = (e: { start?: Date; end?: Date; dateUnknown?: boolean }) =>
  !!e.dateUnknown || !e.start || !e.end || e.end.getTime() >= e.start.getTime();
const endMsg = { message: 'End must be after start', path: ['end'] };

export const createEventSchema = base.refine(endAfterStart, endMsg);
export const updateEventSchema = base.partial().refine(endAfterStart, endMsg);

/** Quick Event: just enough to hold a slot - title, calendar(s), and a date if known. Saved as draft:true. */
export const quickEventSchema = z.object({
  members: z.array(memberCode).min(1, 'Pick at least one calendar'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.enum(CALENDAR_EVENT_TYPE_CODES).optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  dateUnknown: z.boolean().optional(),
  venue: z.string().trim().max(300).optional(),
  organizer: z.string().trim().max(200).optional(),
  contactName: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(20).optional(),
});

export const rangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  types: z.string().optional(), // comma-separated type codes
  members: z.string().optional(), // comma-separated calendar codes, narrows the viewer's own scope
  includeDeadlines: z.enum(['true', 'false']).optional(),
});

export const rsvpSchema = z.object({
  code: z.enum(CALENDAR_REAL_CODES),
  status: z.enum(CALENDAR_RSVP_STATUSES),
});

export const attendanceSchema = z.object({
  code: z.enum(CALENDAR_REAL_CODES),
  status: z.enum(CALENDAR_ATTENDANCE_STATUSES),
  members: z.array(z.string().trim().max(200)).max(50).optional(),
  note: z.string().max(2000).optional(),
});

export const prepUpdateSchema = z.object({
  prep: z.array(z.enum(CALENDAR_PREP_ITEMS)).optional(),
  prepDone: z.array(z.enum(CALENDAR_PREP_ITEMS)).optional(),
  prepNote: z.string().max(4000).optional(),
});

export const replyUpdateSchema = z.object({
  reply: z.enum(CALENDAR_ORGANISER_REPLY_STATUSES),
});

export const socialUpdateSchema = z.object({
  code: z.enum(CALENDAR_REAL_CODES),
  status: z.enum(CALENDAR_SOCIAL_STATUSES),
  platforms: z.array(z.enum(CALENDAR_SOCIAL_PLATFORMS)).optional(),
  caption: z.string().max(4000).optional(),
});

export const moveEventSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
}).refine((e) => e.end.getTime() >= e.start.getTime(), endMsg);

export const awayRangeSchema = z.object({
  members: z.array(z.enum(CALENDAR_REAL_CODES)).min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  reason: z.string().trim().max(200).optional(),
}).refine((e) => e.end.getTime() >= e.start.getTime(), endMsg);

export const exportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  types: z.string().optional(),
  members: z.string().optional(),
  excludeNotGoing: z.enum(['true', 'false']).optional(),
});

export const idParam = z.object({ id: objectId });
