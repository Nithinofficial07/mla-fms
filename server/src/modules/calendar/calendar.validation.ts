import { z } from 'zod';
import { CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPE_CODES, CALENDAR_RECURRENCE_CODES } from '@mla/shared';

const objectId = z.string().length(24, 'Invalid id');

const base = z.object({
  principalId: objectId,
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(4000).optional(),
  type: z.enum(CALENDAR_EVENT_TYPE_CODES).optional(),
  status: z.enum(CALENDAR_EVENT_STATUSES).optional(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  allDay: z.boolean().optional(),
  recurrence: z.enum(CALENDAR_RECURRENCE_CODES).optional(),
  recurrenceUntil: z.coerce.date().nullable().optional(),
  venue: z.string().trim().max(300).optional(),
  wardId: objectId.nullable().optional(),
  gramPanchayatId: objectId.nullable().optional(),
  organizer: z.string().trim().max(200).optional(),
  contactName: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  attendees: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
});

const endAfterStart = (e: { start?: Date; end?: Date }) => !e.start || !e.end || e.end.getTime() >= e.start.getTime();
const endMsg = { message: 'End must be after start', path: ['end'] };

export const createEventSchema = base.refine(endAfterStart, endMsg);
export const updateEventSchema = base.partial().omit({ principalId: true }).refine(endAfterStart, endMsg);

export const rangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  types: z.string().optional(), // comma-separated type codes
  includeDeadlines: z.enum(['true', 'false']).optional(),
});
