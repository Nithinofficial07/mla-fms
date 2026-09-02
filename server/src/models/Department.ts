import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** One of the (initially 22) Line Departments. Fully admin-managed. */
const departmentSchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    headName: { type: String, trim: true },
    officerName: { type: String, trim: true },
    officerDesignation: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    officeAddress: { type: String, trim: true },
    logoKey: { type: String, default: null }, // storage key, optional

    isDemo: { type: Boolean, default: false }, // seed rows flagged as DEMO
  },
  { timestamps: true },
);

applyCommonPlugins(departmentSchema, { softDelete: true });

export type Department = InferSchemaType<typeof departmentSchema>;
export const Department = model('Department', departmentSchema);
