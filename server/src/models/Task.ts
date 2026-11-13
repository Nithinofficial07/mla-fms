import { Schema, model } from 'mongoose';
import {
  AUTOMATION_ACTION_CODES, AUTOMATION_TRIGGER_CODES, TASK_STATUS_CODES, TASK_TEAM_CODES,
} from '@mla/shared';

/**
 * Office Teams: who does the office's work. One row per person, in one team
 * (an office - MLA_S / MLA_N / MP - or the shared SOCIAL media team), with a
 * role (PA-T1, Typist, Driver, Graphic Designer ...). Optionally linked to an
 * app login (userId) - then they get bell notifications and "My work"; staff
 * without a login are reached on WhatsApp via their phone.
 */
const teamMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    team: { type: String, enum: TASK_TEAM_CODES, required: true, index: true },
    role: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const TeamMember = model('TeamMember', teamMemberSchema);

const stepSchema = new Schema(
  {
    text: { type: String, default: '', trim: true },
    role: { type: String, default: '' },
    assignee: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    due: { type: String, default: '' }, // YYYY-MM-DD
  },
  { _id: true },
);

const updateSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // login that made it (null = automation / system)
    byName: { type: String, default: '' },
    who: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null }, // their team-member row, if any
    text: { type: String, required: true },
    kind: { type: String, enum: ['comment', 'sys', 'auto'], default: 'sys' },
    notify: [{ type: Schema.Types.ObjectId, ref: 'TeamMember' }],
  },
  { _id: true },
);

/**
 * A piece of office work. Dates are plain YYYY-MM-DD strings (a due *day*, no
 * time zone to get wrong). Status / approval / step progress move together
 * through the workflow engine (modules/tasks/tasks.engine.ts) - write tasks
 * through it, not directly, so automations and notifications fire.
 */
const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    forWhom: { type: String, default: '', index: true }, // MLA_S | MLA_N | MP | '' (office, general)
    category: { type: String, default: 'Other' },
    priority: { type: String, default: '' },
    status: { type: String, enum: TASK_STATUS_CODES, default: 'NOT_STARTED', index: true },
    start: { type: String, default: '' },
    due: { type: String, default: '', index: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'TeamMember' }],
    steps: { type: [stepSchema], default: [] },
    labels: { type: [String], default: [] },
    dependsOn: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    repeat: { type: String, default: '' },
    approval: {
      required: { type: Boolean, default: false },
      approver: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null },
      state: { type: String, default: '' }, // '' | APPROVED | CHANGES
    },
    template: { type: String, default: '' },
    updates: { type: [updateSchema], default: [] },
    /** ruleId -> key, so time-based automations fire once per due date. */
    fired: { type: Schema.Types.Mixed, default: {} },
    doneAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdWho: { type: Schema.Types.ObjectId, ref: 'TeamMember', default: null },
  },
  { timestamps: true, minimize: false },
);
taskSchema.index({ status: 1, due: 1 });
taskSchema.index({ 'steps.assignee': 1 });
taskSchema.index({ assignees: 1 });
export const Task = model('Task', taskSchema);

/** The office's own step-by-step workflows (the built-in ones live in @mla/shared). */
const taskWorkflowSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'Other' },
    priority: { type: String, default: 'MEDIUM' },
    dueInDays: { type: Number, default: null },
    approval: {
      required: { type: Boolean, default: false },
      approverRole: { type: String, default: 'PA-T1' },
    },
    steps: [{ _id: false, text: { type: String, required: true }, role: { type: String, default: '' } }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const TaskWorkflow = model('TaskWorkflow', taskWorkflowSchema);

/** "When this happens, if this, then do that" - evaluated server-side on every task change. */
const taskAutomationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    on: { type: Boolean, default: true },
    trigger: {
      type: { type: String, enum: AUTOMATION_TRIGGER_CODES, required: true },
      value: { type: String, default: '' },
    },
    cond: {
      forWhom: { type: String, default: '' },
      category: { type: String, default: '' },
      priority: { type: String, default: '' },
    },
    actions: [{ _id: false, type: { type: String, enum: AUTOMATION_ACTION_CODES, required: true }, value: { type: String, default: '' } }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const TaskAutomation = model('TaskAutomation', taskAutomationSchema);
