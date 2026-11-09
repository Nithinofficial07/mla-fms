import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  CALENDAR_ATTENDANCE_STATUSES, CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPE_CODES,
  CALENDAR_ORGANISER_KINDS, CALENDAR_ORGANISER_REPLY_STATUSES, CALENDAR_PREP_ITEMS, CALENDAR_REAL_CODES,
  CALENDAR_RECURRENCE_CODES, CALENDAR_ROLE_AT_EVENT, CALENDAR_RSVP_STATUSES, CALENDAR_SOCIAL_STATUSES,
} from '@mla/shared';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** One calendar's decision + (if attended) who went + a note. Keyed by member code (MLA_S/MLA_N/MP) on the parent Map. */
const attendanceEntrySchema = new Schema(
  {
    status: { type: String, enum: CALENDAR_ATTENDANCE_STATUSES, required: true },
    members: { type: [String], default: [] }, // who went, free text names - "who went on our behalf?"
    note: { type: String, trim: true, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
);

/** One calendar's social-media posting decision for this event. Keyed by member code on the parent Map. */
const socialEntrySchema = new Schema(
  {
    status: { type: String, enum: CALENDAR_SOCIAL_STATUSES, required: true },
    platforms: { type: [String], default: [] },
    caption: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
);

/** One day of a multi-day event, each with its own time window and arrival. */
const sessionSchema = new Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    arrival: { type: String, default: '' }, // "HH:MM", optional
  },
  { _id: false },
);

/** An entry on the office calendar (meeting, site visit, public event...). */
const calendarEventSchema = new Schema(
  {
    ...softDeleteFields,

    // The id this event had in the old standalone calendar artifact, if it was
    // brought in via Admin > Import calendar backup. That artifact used its
    // own (non-ObjectId) ids, so they can't become this document's real _id -
    // this is what "preserve original ids, safe to import twice" keys off.
    legacyId: { type: String, default: null, index: true, sparse: true, unique: true },

    // Which calendar(s) this event is on. Always the real codes (MLA_S/MLA_N/MP) -
    // "SS Family" is a UI convenience that expands to all 3 before saving, never
    // stored itself. Scoping uses this instead of a single principalId, since one
    // event can belong to more than one office at once.
    members: { type: [String], enum: CALENDAR_REAL_CODES, default: [], index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' }, // rich text (HTML), sanitised on render, not on write
    type: { type: String, enum: CALENDAR_EVENT_TYPE_CODES, default: CALENDAR_DEFAULT_TYPE, index: true },
    status: { type: String, enum: CALENDAR_EVENT_STATUSES, default: 'SCHEDULED' },

    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },

    recurrence: { type: String, enum: CALENDAR_RECURRENCE_CODES, default: 'NONE' },
    recurrenceUntil: { type: Date, default: null },

    venue: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' }, // free-text Ward / Village - no master-data link

    organizer: { type: String, trim: true, default: '' },
    organizerKind: { type: String, enum: CALENDAR_ORGANISER_KINDS, default: 'IND' },
    contactName: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    contact2Name: { type: String, trim: true, default: '' },
    contact2Phone: { type: String, trim: true, default: '' },
    attendees: { type: [String], default: [] },

    // Per-member decision/attendance/social - Maps keyed by member code, so
    // each invited office tracks its own answer independently.
    rsvp: { type: Map, of: { type: String, enum: CALENDAR_RSVP_STATUSES }, default: {} },
    attendance: { type: Map, of: attendanceEntrySchema, default: {} },
    social: { type: Map, of: socialEntrySchema, default: {} },

    role: { type: String, enum: [...CALENDAR_ROLE_AT_EVENT, null], default: null },
    prep: { type: [String], enum: CALENDAR_PREP_ITEMS, default: [] }, // needed
    prepDone: { type: [String], enum: CALENDAR_PREP_ITEMS, default: [] }, // which of `prep` are ticked off
    prepNote: { type: String, trim: true, default: '' },

    arrival: { type: String, default: '' }, // "HH:MM", single-day events only
    sessions: { type: [sessionSchema], default: [] }, // multi-day events: one entry per day, overrides start/end for display

    speech: {
      needed: { type: Boolean, default: false },
      kn: { type: String, default: '' }, // rich text
      en: { type: String, default: '' }, // rich text
    },

    reply: { type: String, enum: CALENDAR_ORGANISER_REPLY_STATUSES, default: 'PENDING' },
    publicSchedule: { type: Boolean, default: true },
    writeup: { type: String, default: '' },

    draft: { type: Boolean, default: false }, // Quick Event, details still to be filled in
    dateUnknown: { type: Boolean, default: false }, // Quick Event saved with no date yet

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

calendarEventSchema.index({ members: 1, start: 1 });

applyCommonPlugins(calendarEventSchema, { softDelete: true });

export type CalendarEventDoc = InferSchemaType<typeof calendarEventSchema>;
export const CalendarEvent = model('CalendarEvent', calendarEventSchema);
