import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/**
 * Constituency hierarchy, all editable from Admin:
 *   Constituency -> AreaType -> (Ward | GramPanchayat) -> Village -> SubVillage
 * Ward is the urban branch, GramPanchayat the rural branch. Villages hang off a
 * GramPanchayat (rural) OR directly off a Ward (urban locality) via parentType.
 */

const constituencySchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    isPrimary: { type: Boolean, default: true }, // the office's own constituency
  },
  { timestamps: true },
);
applyCommonPlugins(constituencySchema, { softDelete: true });
export type Constituency = InferSchemaType<typeof constituencySchema>;
export const Constituency = model('Constituency', constituencySchema);

const areaTypeSchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    childLabel: { type: String, default: 'Area' }, // e.g. "Ward" / "Gram Panchayat"
  },
  { timestamps: true },
);
applyCommonPlugins(areaTypeSchema, { softDelete: true });
export type AreaType = InferSchemaType<typeof areaTypeSchema>;
export const AreaType = model('AreaType', areaTypeSchema);

const wardSchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    number: { type: String, trim: true },
    code: { type: String, trim: true, index: true },
    description: { type: String, default: '' },
    constituencyId: { type: Schema.Types.ObjectId, ref: 'Constituency', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
wardSchema.index({ constituencyId: 1, name: 1 });
applyCommonPlugins(wardSchema, { softDelete: true });
export type Ward = InferSchemaType<typeof wardSchema>;
export const Ward = model('Ward', wardSchema);

const gramPanchayatSchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true },
    description: { type: String, default: '' },
    constituencyId: { type: Schema.Types.ObjectId, ref: 'Constituency', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
gramPanchayatSchema.index({ constituencyId: 1, name: 1 });
applyCommonPlugins(gramPanchayatSchema, { softDelete: true });
export type GramPanchayat = InferSchemaType<typeof gramPanchayatSchema>;
export const GramPanchayat = model('GramPanchayat', gramPanchayatSchema);

const villageSchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true },
    // Exactly one parent is set. parentType tells you which.
    parentType: { type: String, enum: ['GRAM_PANCHAYAT', 'WARD'], required: true },
    gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null, index: true },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
applyCommonPlugins(villageSchema, { softDelete: true });
export type Village = InferSchemaType<typeof villageSchema>;
export const Village = model('Village', villageSchema);

const subVillageSchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true },
    villageId: { type: Schema.Types.ObjectId, ref: 'Village', required: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
applyCommonPlugins(subVillageSchema, { softDelete: true });
export type SubVillage = InferSchemaType<typeof subVillageSchema>;
export const SubVillage = model('SubVillage', subVillageSchema);
