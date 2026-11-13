import { Router } from 'express';
import { z } from 'zod';
import {
  AUTOMATION_ACTION_CODES, AUTOMATION_TRIGGER_CODES, PERMISSIONS, TASK_CATEGORIES, TASK_FOR_CODES, TASK_PRIORITY_CODES,
  TASK_REPEAT_CODES, TASK_STATUS_CODES, TASK_TEAM_CODES,
} from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { withId } from '../../utils/queryFeatures.js';
import { Task, TaskAutomation, TaskWorkflow, TeamMember } from '../../models/Task.js';
import { User } from '../../models/User.js';
import { myCalendarCodes } from '../calendar/calendar.service.js';
import {
  applyWorkflow, commit, guardDone, loadEnv, newId, toPlain, type Actor, type Env, type PlainTask,
} from './tasks.engine.js';

const router = Router();
router.use(authenticate);

/* ---------------------------------- schemas ---------------------------------- */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD');
const forWhom = z.enum(['', ...TASK_FOR_CODES] as [string, ...string[]]);
const priority = z.enum(['', ...TASK_PRIORITY_CODES] as [string, ...string[]]);

const stepInput = z.object({
  id: z.string().optional(),
  text: z.string().trim().max(300),
  role: z.string().max(60).optional(),
  assignee: objectId.nullable().optional(),
  done: z.boolean().optional(),
  due: day.optional(),
});

const taskFields = z.object({
  title: z.string().trim().min(1, 'Add a title').max(300),
  notes: z.string().max(10_000),
  forWhom,
  category: z.enum(TASK_CATEGORIES),
  priority,
  status: z.enum(TASK_STATUS_CODES),
  start: day,
  due: day,
  assignees: z.array(objectId).max(30),
  steps: z.array(stepInput).max(60),
  labels: z.array(z.string().trim().min(1).max(40)).max(20),
  dependsOn: z.array(objectId).max(20),
  repeat: z.enum(TASK_REPEAT_CODES),
  approval: z.object({ required: z.boolean().optional(), approver: objectId.nullable().optional(), state: z.enum(['', 'APPROVED', 'CHANGES']).optional() }),
  /** Apply a workflow (built-in "b:..." or a custom one's id) - adds its steps, roles, due date and approver. */
  workflowId: z.string().max(40),
}).partial();
const createSchema = taskFields.extend({ title: z.string().trim().min(1, 'Add a title').max(300) });
const commentSchema = z.object({ text: z.string().trim().min(1).max(4000) });
const bulkSchema = z.object({
  ids: z.array(objectId).min(1).max(200),
  status: z.enum(TASK_STATUS_CODES).optional(),
  priority: priority.optional(),
  addAssignee: objectId.optional(),
  due: day.optional(),
});
const idsSchema = z.object({ ids: z.array(objectId).min(1).max(200) });
const idParam = z.object({ id: objectId });

const memberSchema = z.object({
  name: z.string().trim().min(1, 'Add a name').max(120),
  team: z.enum(TASK_TEAM_CODES),
  role: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(20).optional(),
  userId: objectId.nullable().optional(),
  active: z.boolean().optional(),
}); // role is free text - the standard roles are only suggestions

const workflowSchema = z.object({
  name: z.string().trim().min(1, 'Add a name').max(120),
  category: z.enum(TASK_CATEGORIES),
  priority: z.enum(TASK_PRIORITY_CODES),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
  approval: z.object({ required: z.boolean(), approverRole: z.string().max(60) }),
  steps: z.array(z.object({ text: z.string().trim().min(1).max(300), role: z.string().max(60) })).min(1).max(40),
});

const automationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  on: z.boolean().optional(),
  trigger: z.object({ type: z.enum(AUTOMATION_TRIGGER_CODES), value: z.string().max(60).optional() }),
  cond: z.object({ forWhom: z.string().max(10).optional(), category: z.string().max(60).optional(), priority: z.string().max(20).optional() }).optional(),
  actions: z.array(z.object({ type: z.enum(AUTOMATION_ACTION_CODES), value: z.string().max(500).optional() })).min(1).max(10),
});

/* ---------------------------------- helpers ---------------------------------- */
interface Who { actor: Actor; myMemberIds: string[]; social: boolean }

async function whoAmI(auth: Express.AuthContext): Promise<Who> {
  const mine = await TeamMember.find({ userId: auth.userId, active: true }).select('_id team').lean();
  return {
    actor: { userId: auth.userId, name: auth.name, memberId: mine[0] ? String(mine[0]._id) : null },
    myMemberIds: mine.map((m) => String(m._id)),
    social: mine.some((m) => m.team === 'SOCIAL'),
  };
}

/**
 * Which tasks someone sees: everything when viewing all offices; otherwise
 * their offices' tasks (the "Viewing as" principal), general office tasks,
 * any task they are on, and - for the social media team - social media work.
 */
async function visibleFilter(auth: Express.AuthContext, who: Who): Promise<Record<string, unknown>> {
  if (auth.viewAllPrincipals) return {};
  const codes = await myCalendarCodes(auth);
  const or: Record<string, unknown>[] = [{ forWhom: { $in: codes } }, { forWhom: '' }];
  if (who.myMemberIds.length) {
    or.push({ assignees: { $in: who.myMemberIds } }, { 'steps.assignee': { $in: who.myMemberIds } }, { 'approval.approver': { $in: who.myMemberIds } }, { createdWho: { $in: who.myMemberIds } });
  }
  if (who.social) or.push({ category: 'Social media' });
  return { $or: or };
}

async function assertVisible(auth: Express.AuthContext, who: Who, ids: string[]) {
  const n = await Task.countDocuments({ _id: { $in: ids }, ...(await visibleFilter(auth, who)) });
  if (n !== ids.length) throw AppError.notFound('Task not found');
}

type Patch = z.infer<typeof taskFields>;

/** Applies a validated patch to a task (inside commit). Steps keep their ids; new ones get one. */
function applyPatch(env: Env, t: PlainTask, p: Patch) {
  const simple = ['title', 'notes', 'forWhom', 'category', 'priority', 'status', 'start', 'due', 'labels', 'repeat'] as const;
  for (const k of simple) if (p[k] !== undefined) (t as any)[k] = p[k];
  if (p.assignees) t.assignees = [...new Set(p.assignees)];
  if (p.dependsOn) t.dependsOn = [...new Set(p.dependsOn.filter((d) => d !== t.id))];
  if (p.steps) {
    const before = new Map(t.steps.map((s) => [s.id, s]));
    t.steps = p.steps.map((s) => {
      const old = s.id ? before.get(s.id) : undefined;
      const done = s.done ?? old?.done ?? false;
      return {
        id: old ? old.id : newId(), text: s.text, role: s.role ?? old?.role ?? '', assignee: s.assignee === undefined ? (old?.assignee ?? null) : s.assignee,
        done, doneAt: done ? (old?.done ? old.doneAt : new Date()) : null, due: s.due ?? old?.due ?? '',
      };
    });
  }
  if (p.approval) {
    t.approval = { ...t.approval, ...p.approval, approver: p.approval.approver === undefined ? t.approval.approver : p.approval.approver };
    if (p.approval.required === false) t.approval.state = '';
    if (p.approval.required && !t.approval.approver) {
      t.approval.approver = env.members.find((m) => m.active && m.role === 'PA-T1' && (!t.forWhom || m.team === t.forWhom))?.id ?? null;
    }
  }
  if (p.workflowId) {
    const wf = env.workflows.find((w) => w.id === p.workflowId);
    if (!wf) throw AppError.badRequest('Unknown workflow');
    const keep = [...t.assignees];
    const keepPriority = t.priority;
    const keepDue = t.due;
    applyWorkflow(env, t, wf);
    t.assignees = [...new Set([...keep, ...t.assignees])];
    if (keepPriority) t.priority = keepPriority;
    if (keepDue) t.due = keepDue;
  }
  if (p.status === 'DONE') guardDone(t);
}

const memberOut = (m: any) => ({ ...withId(m), userId: m.userId ? String(m.userId) : null });

/* ---------------------------------- reading ---------------------------------- */
/** Everything the Tasks page needs in one go. Done tasks older than 60 days only with ?all=1. */
router.get(
  '/workspace',
  requirePermission(PERMISSIONS.TASK_VIEW),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const who = await whoAmI(auth);
    const since = new Date(Date.now() - 60 * 86_400_000);
    const recent = req.query.all === '1' ? {} : { $or: [{ status: { $ne: 'DONE' } }, { doneAt: { $gte: since } }, { updatedAt: { $gte: since } }] };
    const [tasks, members, workflows, automations] = await Promise.all([
      Task.find({ $and: [await visibleFilter(auth, who), recent] }).sort({ updatedAt: -1 }).limit(3000).lean(),
      TeamMember.find({}).sort({ team: 1, name: 1 }).lean(),
      TaskWorkflow.find({}).sort({ createdAt: 1 }).lean(),
      TaskAutomation.find({}).sort({ createdAt: 1 }).lean(),
    ]);
    ok(res, {
      tasks: tasks.map(toPlain),
      members: members.map(memberOut),
      workflows: withId(workflows),
      automations: withId(automations),
      myMemberIds: who.myMemberIds,
      today: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10),
    });
  }),
);

/** App logins that can be linked to a team member (for notifications and "My work"). */
router.get(
  '/linkable-users',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = q ? { $or: [{ name: { $regex: esc, $options: 'i' } }, { email: { $regex: esc, $options: 'i' } }, { username: { $regex: esc, $options: 'i' } }] } : {};
    const users = await User.find({ ...filter, isActive: { $ne: false } }).select('name email username').limit(20).lean();
    ok(res, users.map((u: any) => ({ id: String(u._id), name: u.name, email: u.email ?? '', username: u.username ?? '' })));
  }),
);

/* ---------------------------------- writing ---------------------------------- */
router.post(
  '/',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const who = await whoAmI(req.auth!);
    const env = await loadEnv();
    const t = await commit(env, who.actor, null, (z) => applyPatch(env, z, req.body));
    recordAudit(req, { action: 'CREATE', entity: 'Task', entityId: t.id, after: { title: t.title } });
    created(res, t);
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ params: idParam, body: taskFields }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const who = await whoAmI(auth);
    await assertVisible(auth, who, [req.params.id]);
    const env = await loadEnv();
    const log = req.body.workflowId ? `Workflow added: ${env.workflows.find((w) => w.id === req.body.workflowId)?.name ?? ''}` : undefined;
    const t = await commit(env, who.actor, req.params.id, (z) => applyPatch(env, z, req.body), { log });
    ok(res, t);
  }),
);

/** Post an update; "@Name" notifies that person. */
router.post(
  '/:id/comment',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ params: idParam, body: commentSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const who = await whoAmI(auth);
    await assertVisible(auth, who, [req.params.id]);
    const env = await loadEnv();
    const low = req.body.text.toLowerCase();
    const mentions = env.members.filter((m) => m.active && (low.includes(`@${m.name.toLowerCase()}`) || new RegExp(`@${m.name.split(' ')[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`).test(low))).map((m) => m.id);
    const t = await commit(env, who.actor, req.params.id, () => {}, { log: req.body.text, kind: 'comment', notify: mentions, events: [{ type: 'comment' }] });
    ok(res, t);
  }),
);

router.post(
  '/bulk',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ body: bulkSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const who = await whoAmI(auth);
    await assertVisible(auth, who, req.body.ids);
    const env = await loadEnv();
    const { status, priority: pr, addAssignee, due } = req.body;
    for (const id of req.body.ids) {
      await commit(env, who.actor, id, (z) => {
        if (status) { z.status = status; guardDone(z); }
        if (pr !== undefined) z.priority = pr;
        if (addAssignee && !z.assignees.includes(addAssignee)) z.assignees.push(addAssignee);
        if (due !== undefined) z.due = due;
      });
    }
    ok(res, { updated: req.body.ids.length });
  }),
);

/** Delete: whoever created it, or a task admin. */
async function deleteTasks(req: Express.Request & { auth?: Express.AuthContext }, ids: string[]) {
  const auth = req.auth!;
  const who = await whoAmI(auth);
  await assertVisible(auth, who, ids);
  const isAdmin = auth.permissions.includes(PERMISSIONS.TASK_ADMIN);
  if (!isAdmin) {
    const notMine = await Task.countDocuments({ _id: { $in: ids }, createdBy: { $ne: auth.userId } });
    if (notMine) throw AppError.forbidden('Only whoever created a task, or a task admin, can delete it');
  }
  await Task.deleteMany({ _id: { $in: ids } });
  await Task.updateMany({ dependsOn: { $in: ids } }, { $pull: { dependsOn: { $in: ids } } });
}
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await deleteTasks(req as any, [req.params.id]);
    recordAudit(req, { action: 'DELETE', entity: 'Task', entityId: req.params.id });
    ok(res, { id: req.params.id });
  }),
);
router.post(
  '/bulk-delete',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate({ body: idsSchema }),
  asyncHandler(async (req, res) => {
    await deleteTasks(req as any, req.body.ids);
    recordAudit(req, { action: 'DELETE', entity: 'Task', message: `${req.body.ids.length} tasks` });
    ok(res, { deleted: req.body.ids.length });
  }),
);

/* ------------------------------------ team ----------------------------------- */
router.post(
  '/team',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ body: memberSchema }),
  asyncHandler(async (req, res) => {
    const m = await TeamMember.create(req.body);
    created(res, memberOut(m.toObject()));
  }),
);
router.patch(
  '/team/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam, body: memberSchema }),
  asyncHandler(async (req, res) => {
    const m = await TeamMember.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!m) throw AppError.notFound('Person not found');
    ok(res, memberOut(m));
  }),
);
router.delete(
  '/team/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const m = await TeamMember.findByIdAndDelete(id).lean();
    if (!m) throw AppError.notFound('Person not found');
    // Take them off open tasks; their history in the activity feeds stays as it was.
    await Task.updateMany({ assignees: id }, { $pull: { assignees: id } });
    await Task.updateMany({ 'steps.assignee': id }, { $set: { 'steps.$[s].assignee': null } }, { arrayFilters: [{ 's.assignee': id }] });
    await Task.updateMany({ 'approval.approver': id }, { $set: { 'approval.approver': null } });
    ok(res, { id });
  }),
);

/* --------------------------------- workflows --------------------------------- */
router.post(
  '/workflows',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ body: workflowSchema }),
  asyncHandler(async (req, res) => {
    const w = await TaskWorkflow.create({ ...req.body, createdBy: req.auth!.userId });
    created(res, withId(w.toObject()));
  }),
);
router.patch(
  '/workflows/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam, body: workflowSchema }),
  asyncHandler(async (req, res) => {
    const w = await TaskWorkflow.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!w) throw AppError.notFound('Workflow not found');
    ok(res, withId(w));
  }),
);
router.delete(
  '/workflows/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const w = await TaskWorkflow.findByIdAndDelete(req.params.id).lean();
    if (!w) throw AppError.notFound('Workflow not found');
    ok(res, { id: req.params.id });
  }),
);

/* -------------------------------- automations -------------------------------- */
router.post(
  '/automations',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ body: automationSchema }),
  asyncHandler(async (req, res) => {
    const a = await TaskAutomation.create({ ...req.body, createdBy: req.auth!.userId });
    created(res, withId(a.toObject()));
  }),
);
router.patch(
  '/automations/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam, body: automationSchema.partial() }),
  asyncHandler(async (req, res) => {
    const a = await TaskAutomation.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!a) throw AppError.notFound('Automation not found');
    ok(res, withId(a));
  }),
);
router.delete(
  '/automations/:id',
  requirePermission(PERMISSIONS.TASK_ADMIN),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const a = await TaskAutomation.findByIdAndDelete(req.params.id).lean();
    if (!a) throw AppError.notFound('Automation not found');
    ok(res, { id: req.params.id });
  }),
);

export default router;
