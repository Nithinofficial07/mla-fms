import { Schema, model, type InferSchemaType } from 'mongoose';
import { FUNDING_STATUSES } from '@mla/shared';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/**
 * An MLA-authored funding request addressed to a line department's
 * ministry - subject + site address, with supporting photos/scans attached
 * separately via the Document module (owner kind 'funding'). Deliberately
 * lean: no applicant/citizen data, no ward/GP picker. Once the letter is
 * physically handed to the minister, `status` tracks it through to a
 * funding decision - see FUNDING_STATUSES.
 */
const fundingRequestSchema = new Schema(
  {
    ...softDeleteFields,
    fundingRequestId: { type: String, required: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    // The office's own outgoing correspondence number for the physical letter, and who to
    // follow up with at the minister's office - both often only known once it's dispatched.
    letterNo: { type: String, trim: true, default: '' },
    pointPersonName: { type: String, trim: true, default: '' },
    pointPersonNumber: { type: String, trim: true, default: '' },
    status: { type: String, enum: FUNDING_STATUSES, default: 'SUBMITTED' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

applyCommonPlugins(fundingRequestSchema, { softDelete: true });

export type FundingRequest = InferSchemaType<typeof fundingRequestSchema>;
export const FundingRequest = model('FundingRequest', fundingRequestSchema);
