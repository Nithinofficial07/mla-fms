import { Schema, model, type InferSchemaType } from 'mongoose';

/** Append-only audit trail. Never soft-deleted, never edited. */
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: 'system' },
    actorRole: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    message: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.set('toJSON', { virtuals: true, versionKey: false });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model('AuditLog', auditLogSchema);
