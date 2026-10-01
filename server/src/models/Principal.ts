import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/**
 * One of the office's principals - the person casework is being done on
 * behalf of (MLA South, MLA North, or the local MP). Every Request/Letter/
 * FundingRequest belongs to exactly one; every User is scoped to the ones
 * they're allowed to act on. See requestsService.buildListFilter for the
 * access check this backs.
 */
const principalSchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, enum: ['MLA_S', 'MLA_N', 'MP'] },
    label: { type: String, required: true, trim: true },
    /** Prefix used in generated file/letter/funding IDs, e.g. "MLA-S". */
    idPrefix: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

applyCommonPlugins(principalSchema, { softDelete: true });

export type Principal = InferSchemaType<typeof principalSchema>;
export const Principal = model('Principal', principalSchema);
