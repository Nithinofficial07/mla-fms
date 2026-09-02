import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

const userSchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, trim: true },
    designation: { type: String, trim: true },

    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0, select: false }, // bump to revoke refresh tokens

    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    roleCode: { type: String, required: true }, // denormalised for fast guards

    // Department officers must be linked to a department.
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },

    lastLoginAt: { type: Date, default: null },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ roleCode: 1, departmentId: 1 });

applyCommonPlugins(userSchema, { softDelete: true });

export type User = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
