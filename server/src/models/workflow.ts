import { Schema, model, type InferSchemaType } from 'mongoose';
import { applyCommonPlugins } from './plugins.js';

/** Record of a request being assigned/forwarded to a department + officer. */
const assignmentSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    kind: { type: String, enum: ['ASSIGN', 'FORWARD'], required: true },
    fromDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    toDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    toOfficerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    priorityId: { type: Schema.Types.ObjectId, ref: 'Priority', default: null },
    dueDate: { type: Date, default: null },
    remark: { type: String, default: '' },
    attachments: { type: [Schema.Types.ObjectId], ref: 'Document', default: [] },
    actedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
applyCommonPlugins(assignmentSchema);
export type Assignment = InferSchemaType<typeof assignmentSchema>;
export const Assignment = model('RequestAssignment', assignmentSchema);

/** Internal remark / department response thread entry. */
const remarkSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    body: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['INTERNAL', 'DEPARTMENT_RESPONSE'], default: 'INTERNAL' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    attachments: { type: [Schema.Types.ObjectId], ref: 'Document', default: [] },
  },
  { timestamps: true },
);
applyCommonPlugins(remarkSchema);
export type Remark = InferSchemaType<typeof remarkSchema>;
export const Remark = model('RequestRemark', remarkSchema);

/** Append-only timeline entry powering the request history view. */
const timelineSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    action: { type: String, required: true }, // e.g. 'FILE_CREATED', 'STATUS_CHANGE'
    label: { type: String, required: true }, // human sentence
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'system' },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    remark: { type: String, default: null },
    attachments: { type: [Schema.Types.ObjectId], ref: 'Document', default: [] },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
timelineSchema.set('toJSON', { virtuals: true, versionKey: false });
export type TimelineEvent = InferSchemaType<typeof timelineSchema>;
export const TimelineEvent = model('TimelineEvent', timelineSchema);

/** Per-user in-app notification. */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    requestId: { type: Schema.Types.ObjectId, ref: 'Request', default: null },
    link: { type: String, default: null },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);
notificationSchema.set('toJSON', { virtuals: true, versionKey: false });
export type Notification = InferSchemaType<typeof notificationSchema>;
export const Notification = model('Notification', notificationSchema);
