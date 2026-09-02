import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** A single stored file version. Documents keep their history in `versions`. */
const versionSchema = new Schema(
  {
    version: { type: Number, required: true },
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    checksum: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: () => new Date() },
    source: { type: String, enum: ['upload', 'scan'], default: 'upload' },
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    ...softDeleteFields,
    documentId: { type: String, required: true, unique: true },
    // Exactly one owner is set (validated below).
    requestId: { type: Schema.Types.ObjectId, ref: 'Request', default: null, index: true },
    letterId: { type: Schema.Types.ObjectId, ref: 'Letter', default: null, index: true },

    documentType: { type: String, required: true }, // from Lookup group DOCUMENT_TYPE
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'superseded', 'removed'], default: 'active' },

    currentVersion: { type: Number, default: 1 },
    versions: { type: [versionSchema], default: [] },

    ocrText: { type: String, default: '', select: false },
    ocrStatus: { type: String, enum: ['none', 'pending', 'done', 'failed'], default: 'none' },

    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pageCount: { type: Number, default: 1 },
  },
  { timestamps: true },
);

documentSchema.pre('validate', function (next) {
  if (!this.requestId === !this.letterId) {
    next(new Error('A document must belong to exactly one of a request or a letter'));
  } else {
    next();
  }
});

documentSchema.virtual('current').get(function () {
  const vs = this.versions ?? [];
  return vs.find((v) => v.version === this.currentVersion) ?? vs[vs.length - 1] ?? null;
});

applyCommonPlugins(documentSchema, { softDelete: true });

export type DocumentDoc = InferSchemaType<typeof documentSchema>;
export const DocumentModel = model('Document', documentSchema);
