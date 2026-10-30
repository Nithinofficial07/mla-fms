import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** A sanctioned development work (CC road, drain, etc.) tracked end-to-end. */
const workSchema = new Schema(
  {
    ...softDeleteFields,
    // Set silently from the active principal - not a field on the New Work
    // form (same fail-closed scoping every other module uses).
    principalId: { type: Schema.Types.ObjectId, ref: 'Principal', required: true, index: true },
    workId: { type: String, required: true, unique: true },

    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    implementingAgency: { type: String, required: true, trim: true },
    // Only populated when implementingAgency === 'Other'.
    implementingAgencyOther: { type: String, trim: true },
    // The agency's own inspector for this work (distinct from the engineer below).
    agencyInspectorName: { type: String, trim: true },
    agencyInspectorContact: { type: String, trim: true },
    fundingSource: { type: String, required: true, trim: true },
    // "YYYY-YY", e.g. "2025-26".
    fundingYear: { type: String, required: true, index: true },
    nameOfWork: { type: String, required: true, trim: true },
    engineerName: { type: String, trim: true },
    engineerContact: { type: String, trim: true },

    location: {
      locationType: { type: String, enum: ['CITY', 'GP', 'SH_MDR'], required: true },
      wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null, index: true },
      gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null, index: true },
      villageId: { type: Schema.Types.ObjectId, ref: 'Village', default: null, index: true },
      subVillageId: { type: Schema.Types.ObjectId, ref: 'SubVillage', default: null },
      // SH/MDR branch only - a road isn't part of the Ward/GP hierarchy.
      roadCategory: { type: String, enum: ['SH', 'MDR', null], default: null },
      roadName: { type: String, trim: true },
    },

    // Free-text site address / landmark, on top of the structured location.
    address: { type: String, trim: true },
    // Free-text remarks / open queries about the work.
    remarks: { type: String, trim: true },

    amountLakhs: { type: Number, required: true, min: 0.01 },
    thirdPartyInspection: { type: String, enum: ['Completed', 'Not Completed'], default: 'Not Completed' },
    tpiOfficerName: { type: String, trim: true },
    tpiOfficerContact: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

applyCommonPlugins(workSchema, { softDelete: true });

export type WorkDoc = InferSchemaType<typeof workSchema>;
export const Work = model('Work', workSchema);
