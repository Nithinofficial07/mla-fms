import { Schema, model, type InferSchemaType } from 'mongoose';
import { LETTER_STATUSES } from '@mla/shared';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/**
 * An "MLA Letter" - a letter the office issues/tracks. Lighter than a Request:
 * no workflow engine, just a small fixed status. Documents (scanned copy /
 * attachments) hang off it via the shared Document model (letterId).
 */
const letterSchema = new Schema(
  {
    ...softDeleteFields,
    letterNo: { type: String, required: true, unique: true },
    date: { type: Date, default: () => new Date() },

    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    applicant: {
      name: { type: String, required: true, trim: true },
      mobile: { type: String, required: true, trim: true, index: true },
      altMobile: { type: String, trim: true },
      address: { type: String, trim: true },
    },

    // Ward (urban) OR Gram Panchayat (rural) branch, same masters as requests.
    location: {
      wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null, index: true },
      gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null, index: true },
      villageId: { type: Schema.Types.ObjectId, ref: 'Village', default: null },
      subVillageId: { type: Schema.Types.ObjectId, ref: 'SubVillage', default: null },
      // Free-text address for urban (ward) entries in place of village / sub-village.
      addressText: { type: String, trim: true },
    },

    referredBy: { type: String, trim: true },

    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    /** The department's own reference number on the letter. */
    departmentLetterNo: { type: String, trim: true },

    status: { type: String, enum: [...LETTER_STATUSES], default: 'DRAFT', index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

letterSchema.index({ subject: 'text', 'applicant.name': 'text', referredBy: 'text' });

applyCommonPlugins(letterSchema, { softDelete: true });

export type LetterDoc = InferSchemaType<typeof letterSchema>;
export const Letter = model('Letter', letterSchema);
