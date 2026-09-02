import { Schema } from 'mongoose';

/**
 * Fields spread into every schema that supports deactivation / soft-delete.
 * Kept as a literal (not added by a plugin) so `InferSchemaType` sees them
 * and `doc.isActive` / `doc.deletedAt` are typed everywhere.
 *
 *  - `isActive: false`         -> deactivated, still visible with ?includeInactive=true
 *  - `deletedAt: <Date>`       -> truly soft-deleted, hidden from all normal queries
 */
export const softDeleteFields = {
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, default: null },
};

/**
 * Adds the query filter + helper methods for soft-delete. Assumes the schema
 * already contains `softDeleteFields` (spread into its definition).
 */
export function softDeletePlugin(schema: Schema): void {
  const hideDeleted = function (this: any) {
    if (!this.getOptions().withDeleted) this.where({ deletedAt: null });
  };
  schema.pre('find', hideDeleted);
  schema.pre('findOne', hideDeleted);
  schema.pre('countDocuments', hideDeleted);
  schema.pre('findOneAndUpdate', hideDeleted);

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
  };
  schema.methods.restore = function () {
    this.deletedAt = null;
    this.isActive = true;
    return this.save();
  };
}

/** Normalises JSON: `id` instead of `_id`, drop `__v` and internal fields. */
export function jsonPlugin(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.passwordHash;
      delete ret.tokenVersion;
      return ret;
    },
  });
}

export function applyCommonPlugins(schema: Schema, opts: { softDelete?: boolean } = {}): void {
  jsonPlugin(schema);
  if (opts.softDelete) softDeletePlugin(schema);
}
