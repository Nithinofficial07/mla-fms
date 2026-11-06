import { Schema, model, type InferSchemaType } from 'mongoose';
import { CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPE_CODES, CALENDAR_RECURRENCE_CODES } from '@mla/shared';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** An entry on the MLA office calendar (meeting, site visit, public event...). */
const calendarEventSchema = new Schema(
  {
    ...softDeleteFields,
    // Set from the active principal, same fail-closed scoping as every module.
    principalId: { type: Schema.Types.ObjectId, ref: 'Principal', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    type: { type: String, enum: CALENDAR_EVENT_TYPE_CODES, default: CALENDAR_DEFAULT_TYPE, index: true },
    status: { type: String, enum: CALENDAR_EVENT_STATUSES, default: 'SCHEDULED' },

    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },

    recurrence: { type: String, enum: CALENDAR_RECURRENCE_CODES, default: 'NONE' },
    recurrenceUntil: { type: Date, default: null },

    venue: { type: String, trim: true, default: '' },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null },
    gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null },

    organizer: { type: String, trim: true, default: '' },
    contactName: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    attendees: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

calendarEventSchema.index({ principalId: 1, start: 1 });

applyCommonPlugins(calendarEventSchema, { softDelete: true });

export type CalendarEventDoc = InferSchemaType<typeof calendarEventSchema>;
export const CalendarEvent = model('CalendarEvent', calendarEventSchema);
