import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Append-only change history for the calendar - one row per action on an
 * event (created/edited/deleted/rsvp/attendance/prep/reply/social/photos/
 * quick). Kept separate from the shared workflow TimelineEvent model since
 * the shape here (free-text `detail` lines, no from/toStatus) doesn't fit it.
 */
const calendarEventLogSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'CalendarEvent', required: true, index: true },
    title: { type: String, required: true }, // snapshot of the event title at the time, survives the event being deleted
    action: {
      type: String,
      required: true,
      enum: ['created', 'edited', 'deleted', 'rsvp', 'attendance', 'prep', 'reply', 'social', 'photos', 'quick', 'moved'],
    },
    detail: { type: [String], default: [] }, // human-readable change lines, e.g. "Status: Going -> Not going (MLA South)"
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, required: true },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

calendarEventLogSchema.index({ at: -1 });

export type CalendarEventLogDoc = InferSchemaType<typeof calendarEventLogSchema>;
export const CalendarEventLog = model('CalendarEventLog', calendarEventLogSchema);
