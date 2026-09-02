import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins, softDeleteFields } from './plugins.js';

/** Request category (Road, Water, ...). Admin-managed. */
const requestCategorySchema = new Schema(
  {
    ...softDeleteFields,
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, uppercase: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
applyCommonPlugins(requestCategorySchema, { softDelete: true });
export type RequestCategory = InferSchemaType<typeof requestCategorySchema>;
export const RequestCategory = model('RequestCategory', requestCategorySchema);

/** Configurable workflow state + allowed transitions (by status code). */
const requestStatusSchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    color: { type: String, default: '#607d8b' },
    isInitial: { type: Boolean, default: false },
    isTerminal: { type: Boolean, default: false },
    transitionsTo: { type: [String], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
applyCommonPlugins(requestStatusSchema, { softDelete: true });
export type RequestStatus = InferSchemaType<typeof requestStatusSchema>;
export const RequestStatus = model('RequestStatus', requestStatusSchema);

/** Priority level with its own default SLA in days. */
const prioritySchema = new Schema(
  {
    ...softDeleteFields,
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    slaDays: { type: Number, default: 15 },
    color: { type: String, default: '#607d8b' },
    order: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
applyCommonPlugins(prioritySchema, { softDelete: true });
export type Priority = InferSchemaType<typeof prioritySchema>;
export const Priority = model('Priority', prioritySchema);

/** Generic named list used for Request Types, Document Types, ID Types. */
const lookupSchema = new Schema(
  {
    ...softDeleteFields,
    group: { type: String, required: true, index: true }, // 'REQUEST_TYPE' | 'DOCUMENT_TYPE' | 'ID_TYPE'
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
lookupSchema.index({ group: 1, name: 1 }, { unique: true });
applyCommonPlugins(lookupSchema, { softDelete: true });
export type Lookup = InferSchemaType<typeof lookupSchema>;
export const Lookup = model('Lookup', lookupSchema);

/** Single-document application settings (id: 'app'). */
const systemSettingsSchema = new Schema(
  {
    _id: { type: String, default: 'app' },
    appName: { type: String, default: 'MLA File Management System' },
    constituencyName: { type: String, default: '' },
    logoKey: { type: String, default: null },
    fileIdFormat: { type: String, default: 'MLA/{YYYY}/{SEQ:6}' },
    requestIdFormat: { type: String, default: 'REQ/{YYYY}/{SEQ:6}' },
    documentIdFormat: { type: String, default: 'DOC-{YYYY}-{SEQ:6}' },
    letterNoFormat: { type: String, default: 'MLA-LTR/{YYYY}/{SEQ:4}' },
    dateFormat: { type: String, default: 'DD MMM YYYY' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    maxUploadBytes: { type: Number, default: 10 * 1024 * 1024 },
    allowedFileTypes: { type: [String], default: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'] },
    defaultSlaDays: { type: Number, default: 15 },
    notifications: {
      dueSoonDays: { type: Number, default: 2 },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
    ocrEnabled: { type: Boolean, default: false },
    setupCompleted: { type: Boolean, default: false },
    lastBackupAt: { type: Date, default: null },
    lastBackupStatus: { type: String, default: 'never' }, // never | ok | failed
  },
  { timestamps: true },
);
systemSettingsSchema.set('toJSON', { virtuals: true, versionKey: false });
export type SystemSettings = InferSchemaType<typeof systemSettingsSchema>;
export const SystemSettings = model('SystemSettings', systemSettingsSchema);
