import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

const roleSchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false }, // system roles cannot be deleted
  },
  { timestamps: true },
);

applyCommonPlugins(roleSchema, { softDelete: true });

export type Role = InferSchemaType<typeof roleSchema>;
export const Role = model('Role', roleSchema);
