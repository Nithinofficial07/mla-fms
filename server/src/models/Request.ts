import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** The core file/request record. References masters by ObjectId only. */
const requestSchema = new Schema(
  {
    ...softDeleteFields,
    fileId: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },

    date: { type: Date, default: () => new Date() },
    requestType: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'RequestCategory' },
    priorityId: { type: Schema.Types.ObjectId, ref: 'Priority', required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    applicant: {
      name: { type: String, required: true, trim: true },
      mobile: { type: String, required: true, trim: true, index: true },
      altMobile: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      address: { type: String, trim: true },
      idType: { type: String, trim: true },
      idNumber: { type: String, trim: true, select: false }, // sensitive
    },

    location: {
      constituencyId: { type: Schema.Types.ObjectId, ref: 'Constituency' },
      areaTypeId: { type: Schema.Types.ObjectId, ref: 'AreaType' },
      wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null, index: true },
      gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null, index: true },
      villageId: { type: Schema.Types.ObjectId, ref: 'Village', default: null, index: true },
      subVillageId: { type: Schema.Types.ObjectId, ref: 'SubVillage', default: null },
    },

    primaryDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    secondaryDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    statusId: { type: Schema.Types.ObjectId, ref: 'RequestStatus', required: true, index: true },
    statusCode: { type: String, required: true, index: true }, // denormalised

    slaDays: { type: Number, default: 15 },
    dueDate: { type: Date, default: null, index: true },
    submittedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    ocrText: { type: String, default: '', select: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

requestSchema.index({ subject: 'text', 'applicant.name': 'text', description: 'text' });
requestSchema.index({ statusCode: 1, priorityId: 1, createdAt: -1 });

/** Days until (negative = overdue by) the due date. Null when no due date. */
requestSchema.virtual('daysRemaining').get(function () {
  if (!this.dueDate) return null;
  return Math.ceil((this.dueDate.getTime() - Date.now()) / 86_400_000);
});

applyCommonPlugins(requestSchema, { softDelete: true });

export type RequestDoc = InferSchemaType<typeof requestSchema>;
export const RequestModel = model('Request', requestSchema);
