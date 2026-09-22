import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/**
 * An MLA-authored funding request addressed to a line department's
 * ministry - subject + site address, with supporting photos/scans attached
 * separately via the Document module (owner kind 'funding'). Deliberately
 * lean: no applicant/citizen data, no ward/GP picker, no workflow beyond a
 * single status - this isn't a citizen request, it's outbound correspondence
 * from the MLA's office to the state government.
 */
const fundingRequestSchema = new Schema(
  {
    ...softDeleteFields,
    fundingRequestId: { type: String, required: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED'], default: 'SUBMITTED' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

applyCommonPlugins(fundingRequestSchema, { softDelete: true });

export type FundingRequest = InferSchemaType<typeof fundingRequestSchema>;
export const FundingRequest = model('FundingRequest', fundingRequestSchema);
