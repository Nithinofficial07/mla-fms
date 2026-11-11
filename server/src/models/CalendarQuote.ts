import { Schema, model, type InferSchemaType } from 'mongoose';
import { QUOTE_KIND_CODES } from '@mla/shared';

/**
 * The office's list of ದಿನದ ಚಿಂತನೆ lines for the daily poster. Picked per
 * date in a fixed rotation (by `seq`), or on a given MM-DD every year.
 */
const calendarQuoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: String, default: '', trim: true },
    kind: { type: String, enum: QUOTE_KIND_CODES, default: 'CHINTANE' },
    monthDay: { type: String, default: null }, // "MM-DD"
    active: { type: Boolean, default: true },
    seq: { type: Number, required: true, index: true }, // rotation order - new lines go to the end
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export type CalendarQuoteDoc = InferSchemaType<typeof calendarQuoteSchema>;
export const CalendarQuote = model('CalendarQuote', calendarQuoteSchema);
