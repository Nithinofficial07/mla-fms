import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** The core file/request record. References masters by ObjectId only. */
const requestSchema = new Schema(
  {
    ...softDeleteFields,
    principalId: { type: Schema.Types.ObjectId, ref: 'Principal', required: true, index: true },
    fileId: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },

    date: { type: Date, default: () => new Date() },
    requestType: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'RequestCategory' },
    // No longer collected at intake - staff may still set it later via the
    // Workflow Actions tab, so it stays a real field, just not required.
    priorityId: { type: Schema.Types.ObjectId, ref: 'Priority', default: null },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    applicant: {
      // Pre-split-name records only have `name`. New records set
      // firstName/lastName and a pre-save hook derives `name` from them, so
      // every existing consumer of applicant.name keeps working untouched.
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      name: { type: String, required: true, trim: true },
      mobile: { type: String, required: true, trim: true, index: true },
      altMobile: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      address: { type: String, trim: true },
      idType: { type: String, trim: true },
      idNumber: { type: String, trim: true, select: false }, // sensitive
      accompanyingCount: { type: Number, default: 0, min: 0 },
      referencePersonName: { type: String, trim: true },
      referencePersonMobile: { type: String, trim: true },
    },

    location: {
      locationType: { type: String, enum: ['RURAL', 'URBAN', 'OTHER'], default: null },
      constituencyId: { type: Schema.Types.ObjectId, ref: 'Constituency' },
      areaTypeId: { type: Schema.Types.ObjectId, ref: 'AreaType' },
      wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null, index: true },
      gramPanchayatId: { type: Schema.Types.ObjectId, ref: 'GramPanchayat', default: null, index: true },
      villageId: { type: Schema.Types.ObjectId, ref: 'Village', default: null, index: true },
      subVillageId: { type: Schema.Types.ObjectId, ref: 'SubVillage', default: null },
      // Free-text street / landmark address, used for urban (ward) requests
      // instead of the village / sub-village hierarchy.
      addressText: { type: String, trim: true },
      // Free-text ward / Gram Panchayat name when it isn't in the master list.
      otherPlaceName: { type: String, trim: true },
      // Shared Rural/Urban detail breakup.
      houseNumber: { type: String, trim: true },
      roadName: { type: String, trim: true },
      roadType: { type: String, enum: ['MAIN', 'CROSS', 'LOCALITY', null], default: null },
      pincode: { type: String, trim: true },
      additionalLocationDetails: { type: String, trim: true },
      // "Other" branch - a place outside the constituency's ward/GP structure.
      otherLocationPlace: { type: String, trim: true },
      otherLocationCity: { type: String, trim: true },
      otherLocationDistrict: { type: String, trim: true },
      otherLocationState: { type: String, trim: true },
      otherLocationReason: { type: String, trim: true },
    },

    primaryDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    secondaryDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    interventionInstructions: { type: String, trim: true, default: '' },

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

requestSchema.pre('validate', function (next) {
  const first = this.applicant?.firstName?.trim();
  const last = this.applicant?.lastName?.trim();
  if ((first || last) && this.applicant) {
    this.applicant.name = [first, last].filter(Boolean).join(' ');
  }
  next();
});

/** Days until (negative = overdue by) the due date. Null when no due date. */
requestSchema.virtual('daysRemaining').get(function () {
  if (!this.dueDate) return null;
  return Math.ceil((this.dueDate.getTime() - Date.now()) / 86_400_000);
});

applyCommonPlugins(requestSchema, { softDelete: true });

export type RequestDoc = InferSchemaType<typeof requestSchema>;
export const RequestModel = model('Request', requestSchema);
