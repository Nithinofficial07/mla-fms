import { Schema, model, type InferSchemaType } from 'mongoose';

/** Tracks a bulk location/department Excel import and its validation report. */
const rowErrorSchema = new Schema(
  { row: Number, field: String, message: String },
  { _id: false },
);

const locationImportJobSchema = new Schema(
  {
    kind: { type: String, enum: ['LOCATION', 'DEPARTMENT'], required: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ['validated', 'imported', 'failed'], default: 'validated' },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    errors: { type: [rowErrorSchema], default: [] },
    dryRun: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
locationImportJobSchema.set('toJSON', { virtuals: true, versionKey: false });

export type LocationImportJob = InferSchemaType<typeof locationImportJobSchema>;
export const LocationImportJob = model('LocationImportJob', locationImportJobSchema);
