import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One profile photo per calendar (MLA_S / MLA_N / MP / SS_FAMILY), stored
 * through the app's normal file storage (S3/local via storage/index.ts) and
 * served through the signed /raw proxy - not as an inline data: URI in
 * Mongo, unlike the original standalone artifact (which had no file storage
 * of its own). `_id` is the calendar code itself, so there's at most one row
 * per calendar and "upsert by code" is a plain findByIdAndUpdate.
 */
const calendarPhotoSchema = new Schema(
  {
    _id: { type: String }, // calendar code: MLA_S | MLA_N | MP | SS_FAMILY
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, _id: false },
);

export type CalendarPhotoDoc = InferSchemaType<typeof calendarPhotoSchema>;
export const CalendarPhoto = model('CalendarPhoto', calendarPhotoSchema);
