/**
 * The Office Teams workflow engine. Every task change goes through commit():
 * it applies the change, moves status from steps / approval, runs the
 * office's automations, writes the activity feed, handles "done" (repeat,
 * unblocking), saves, and notifies the people concerned.
 */
import { Types } from 'mongoose';
import {
  BUILTIN_WORKFLOWS, TASK_STATUS_CODES, isSocialRole, taskPriorityMeta, taskStatusMeta, type WorkflowDef,
} from '@mla/shared';
import { Task, TaskAutomation, TaskWorkflow, TeamMember } from '../../models/Task.js';
import { notifyUsers } from '../notifications/notify.js';
import { AppError } from '../../utils/AppError.js';

/* ----------------------------------- types ---------------------------------- */
export interface Step { id: string; text: string; role: string; assignee: string | null; done: boolean; doneAt: Date | null; due: string }
export interface Update { id?: string; at: Date; by: string | null; byName: string; who: string | null; text: string; kind: 'comment' | 'sys' | 'auto'; notify: string[] }
export interface PlainTask {
  id: string;
  title: string; notes: string; forWhom: string; category: string; priority: string; status: string;
  start: string; due: string; assignees: string[]; steps: Step[]; labels: string[]; dependsOn: string[];
  repeat: string; approval: { required: boolean; approver: string | null; state: string }; template: string;
  updates: Update[]; fired: Record<string, string>; doneAt: Date | null;
  createdBy: string | null; createdWho: string | null; createdAt?: Date; updatedAt?: Date;
}
export interface Member { id: string; name: string; team: string; role: string; phone: string; userId: string | null; active: boolean }
interface Rule { id: string; name: string; on: boolean; trigger: { type: string; value: string }; cond: { forWhom: string; category: string; priority: string }; actions: { type: string; value: string }[] }
export interface Env { members: Member[]; rules: Rule[]; workflows: WorkflowDef[] }
export interface Actor { userId: string | null; name: string; memberId: string | null }
interface Log { text: string; kind: 'comment' | 'sys' | 'auto'; notify: string[] }
interface Ctx { logs: Log[]; creates: ({ repeatOf: PlainTask } | { workflow: WorkflowDef; from: PlainTask })[] }
export interface CommitOpts { log?: string; kind?: Log['kind']; notify?: string[]; events?: { type: string; value?: string }[]; createdLog?: string; createNotify?: string[]; depth?: number }

/* ----------------------------------- dates ---------------------------------- */
/** Today in India (the office's day), as YYYY-MM-DD - the server itself may run in UTC. */
export const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const addMonths = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const fmtD = (s: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

/* --------------------------------- plumbing --------------------------------- */
const str = (v: unknown): string | null => (v == null ? null : String(v));

/** Lean Mongo doc -> plain task with string ids. */
export function toPlain(d: any): PlainTask {
  return {
    id: String(d._id),
    title: d.title ?? '', notes: d.notes ?? '', forWhom: d.forWhom ?? '', category: d.category ?? 'Other',
    priority: d.priority ?? '', status: d.status ?? 'NOT_STARTED', start: d.start ?? '', due: d.due ?? '',
    assignees: (d.assignees ?? []).map(String),
    steps: (d.steps ?? []).map((s: any) => ({
      id: String(s._id ?? s.id), text: s.text ?? '', role: s.role ?? '', assignee: str(s.assignee), done: !!s.done, doneAt: s.doneAt ?? null, due: s.due ?? '',
    })),
    labels: d.labels ?? [], dependsOn: (d.dependsOn ?? []).map(String), repeat: d.repeat ?? '',
    approval: { required: !!d.approval?.required, approver: str(d.approval?.approver), state: d.approval?.state ?? '' },
    template: d.template ?? '',
    updates: (d.updates ?? []).map((u: any) => ({
      id: String(u._id ?? u.id ?? ''), at: u.at, by: str(u.by), byName: u.byName ?? '', who: str(u.who), text: u.text, kind: u.kind ?? 'sys', notify: (u.notify ?? []).map(String),
    })),
    fired: d.fired ?? {}, doneAt: d.doneAt ?? null, createdBy: str(d.createdBy), createdWho: str(d.createdWho),
    createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
}

/** Plain task -> what is stored. */
function toDb(t: PlainTask) {
  return {
    title: t.title, notes: t.notes, forWhom: t.forWhom, category: t.category, priority: t.priority, status: t.status,
    start: t.start, due: t.due, assignees: t.assignees, labels: t.labels, dependsOn: t.dependsOn, repeat: t.repeat,
    steps: t.steps.map((s) => ({ _id: s.id, text: s.text, role: s.role, assignee: s.assignee, done: s.done, doneAt: s.doneAt, due: s.due })),
    approval: t.approval, template: t.template,
    updates: t.updates.map(({ id, ...u }) => (id ? { _id: id, ...u } : u)),
    fired: t.fired, doneAt: t.doneAt, createdBy: t.createdBy, createdWho: t.createdWho,
  };
}

export const newId = () => new Types.ObjectId().toString();

export async function loadEnv(): Promise<Env> {
  const [members, rules, custom] = await Promise.all([
    TeamMember.find({}).lean(),
    TaskAutomation.find({ on: true }).sort({ createdAt: 1 }).lean(),
    TaskWorkflow.find({}).lean(),
  ]);
  return {
    members: members.map((m: any) => ({ id: String(m._id), name: m.name, team: m.team, role: m.role, phone: m.phone ?? '', userId: str(m.userId), active: m.active !== false })),
    rules: rules.map((r: any) => ({
      id: String(r._id), name: r.name, on: r.on !== false,
      trigger: { type: r.trigger?.type, value: r.trigger?.value ?? '' },
      cond: { forWhom: r.cond?.forWhom ?? '', category: r.cond?.category ?? '', priority: r.cond?.priority ?? '' },
      actions: (r.actions ?? []).map((a: any) => ({ type: a.type, value: a.value ?? '' })),
    })),
    workflows: [...BUILTIN_WORKFLOWS, ...custom.map((w: any) => ({
      id: String(w._id), name: w.name, category: w.category, priority: w.priority, dueInDays: w.dueInDays ?? null,
      approval: { required: !!w.approval?.required, approverRole: w.approval?.approverRole || 'PA-T1' },
      steps: (w.steps ?? []).map((s: any) => ({ text: s.text, role: s.role ?? '' })),
    }))],
  };
}

const memberById = (env: Env, id: string | null | undefined) => (id ? env.members.find((m) => m.id === id) : undefined);
const nameOf = (env: Env, id: string | null | undefined) => memberById(env, id)?.name ?? '?';
export const nextStep = (t: PlainTask) => t.steps.find((s) => !s.done);
export const taskPeople = (t: PlainTask) => {
  const s = new Set(t.assignees);
  t.steps.forEach((z) => z.assignee && s.add(z.assignee));
  if (t.approval.required && t.approval.approver) s.add(t.approval.approver);
  return [...s];
};

/** Active people with a role, for this task: social roles come from the social media team, others from the task's own office. */
export function membersWithRole(env: Env, role: string, t: Pick<PlainTask, 'forWhom'>): Member[] {
  return env.members.filter((m) => m.active && m.role === role && (isSocialRole(role) ? m.team === 'SOCIAL' : (!t.forWhom || m.team === t.forWhom)));
}

export function newBase(actor: Actor): PlainTask {
  return {
    id: '', title: '', notes: '', forWhom: 'MLA_S', category: 'Other', priority: '', status: 'NOT_STARTED', start: '', due: '',
    assignees: [], steps: [], labels: [], dependsOn: [], repeat: '', approval: { required: false, approver: null, state: '' },
    template: '', updates: [], fired: {}, doneAt: null, createdBy: actor.userId, createdWho: actor.memberId,
  };
}

/** Steps (each to the right person by role), due date, priority and approver from a workflow. */
export function applyWorkflow(env: Env, t: PlainTask, wf: WorkflowDef | undefined) {
  if (!wf) return;
  t.template = wf.id;
  t.category = wf.category || t.category;
  if (!t.priority) t.priority = wf.priority || '';
  if (!t.due && wf.dueInDays != null && wf.dueInDays !== ('' as unknown)) t.due = addDays(today(), Number(wf.dueInDays));
  t.steps = wf.steps.map((s) => ({ id: newId(), text: s.text, role: s.role || '', assignee: (s.role && membersWithRole(env, s.role, t)[0]?.id) || null, done: false, doneAt: null, due: '' }));
  if (wf.approval?.required) {
    t.approval = { required: true, approver: membersWithRole(env, wf.approval.approverRole || 'PA-T1', t)[0]?.id ?? null, state: '' };
  }
  if (!t.assignees.length) {
    const first = t.steps.find((s) => s.assignee);
    if (first?.assignee) t.assignees = [first.assignee];
  }
}

/* ------------------------------- automations -------------------------------- */
function resolveTargets(env: Env, v: string, t: PlainTask): string[] {
  if (!v) return [];
  if (v === 'assignees') {
    const n = nextStep(t);
    return [...new Set([...t.assignees, ...(n?.assignee ? [n.assignee] : [])])];
  }
  if (v === 'approver') return t.approval.approver ? [t.approval.approver] : [];
  if (v === 'creator') return t.createdWho ? [t.createdWho] : (env.members.find((m) => m.userId && m.userId === t.createdBy)?.id ? [env.members.find((m) => m.userId === t.createdBy)!.id] : []);
  if (v.startsWith('role:')) return membersWithRole(env, v.slice(5), t).map((m) => m.id);
  return memberById(env, v) ? [v] : [];
}
function targetName(env: Env, v: string): string {
  if (v === 'assignees') return 'the people on the task';
  if (v === 'approver') return 'the approver';
  if (v === 'creator') return 'whoever created it';
  if (v.startsWith('role:')) return `${v.slice(5)} (same team)`;
  return memberById(env, v)?.name ?? '—';
}

function eventsOf(b: PlainTask | null, a: PlainTask, extra?: CommitOpts['events']) {
  const ev = [...(extra ?? [])];
  if (!b) { ev.push({ type: 'created' }); return ev; }
  if (b.status !== a.status) ev.push({ type: 'status_to', value: a.status });
  if ((b.priority || '') !== (a.priority || '') && a.priority) ev.push({ type: 'priority_to', value: a.priority });
  const nb = new Set(b.assignees);
  if (a.assignees.some((m) => !nb.has(m))) ev.push({ type: 'assigned' });
  const bs = new Map(b.steps.map((s) => [s.id, s]));
  if (a.steps.some((s) => s.done && !bs.get(s.id)?.done)) ev.push({ type: 'step_done' });
  const all = (z: PlainTask) => z.steps.length > 0 && z.steps.every((s) => s.done);
  if (all(a) && !all(b)) ev.push({ type: 'all_steps_done' });
  if ((b.approval.state || '') !== (a.approval.state || '') && a.approval.state) ev.push({ type: 'approval_to', value: a.approval.state });
  return ev;
}
const condOk = (r: Rule, t: PlainTask) =>
  (!r.cond.forWhom || r.cond.forWhom === t.forWhom) && (!r.cond.category || r.cond.category === t.category) && (!r.cond.priority || r.cond.priority === t.priority);

function runRules(env: Env, b: PlainTask | null, a: PlainTask, ctx: Ctx, extra: CommitOpts['events'], depth: number, fired: Set<string>) {
  const evs = eventsOf(b, a, extra);
  if (!evs.length) return;
  for (const r of env.rules) {
    if (!r.on || fired.has(r.id)) continue;
    const hit = evs.some((e) => e.type === r.trigger.type && (!r.trigger.value || r.trigger.value === e.value));
    if (!hit || !condOk(r, a)) continue;
    fired.add(r.id);
    const snap = structuredClone(a);
    const did: string[] = [];
    const notify = new Set<string>();
    for (const ac of r.actions) {
      const v = ac.value;
      if (ac.type === 'notify') { resolveTargets(env, v, a).forEach((m) => notify.add(m)); did.push(`notified ${targetName(env, v)}`); }
      else if (ac.type === 'set_status' && (TASK_STATUS_CODES as readonly string[]).includes(v)) { a.status = v; did.push(`status → ${taskStatusMeta(v).label}`); }
      else if (ac.type === 'set_priority' && v) { a.priority = v; did.push(`priority → ${taskPriorityMeta(v)?.label ?? v}`); }
      else if (ac.type === 'assign') {
        const ids = resolveTargets(env, v, a).slice(0, v.startsWith('role:') ? 1 : 9);
        ids.forEach((m) => { if (!a.assignees.includes(m)) a.assignees.push(m); });
        if (ids.length) did.push(`assigned ${ids.map((i) => nameOf(env, i)).join(', ')}`);
      } else if (ac.type === 'set_due' && v !== '') { a.due = addDays(today(), Number(v)); did.push(`due → ${fmtD(a.due)}`); }
      else if (ac.type === 'comment' && v) ctx.logs.push({ text: v, kind: 'auto', notify: [] });
      else if (ac.type === 'create_task' && v && depth < 2) {
        const wf = env.workflows.find((w) => w.id === v);
        if (wf) { ctx.creates.push({ workflow: wf, from: a }); did.push(`created “${wf.name}”`); }
      }
    }
    ctx.logs.push({ text: `⚡ ${r.name || 'Automation'}${did.length ? `: ${did.join(', ')}` : ''}`, kind: 'auto', notify: [...notify] });
    if (depth < 3) runRules(env, snap, a, ctx, undefined, depth + 1, fired);
  }
}

/* --------------------------------- built-ins -------------------------------- */
/** Ticking steps moves the status: some done -> Working, all done -> Done (or Waiting for approval). */
function stepProgress(b: PlainTask | null, a: PlainTask) {
  if (!a.steps.length) return;
  if (JSON.stringify((b?.steps ?? []).map((z) => z.done)) === JSON.stringify(a.steps.map((z) => z.done))) return;
  const dn = a.steps.filter((z) => z.done).length;
  if (dn === a.steps.length) a.status = a.approval.required && a.approval.state !== 'APPROVED' ? 'APPROVAL' : 'DONE';
  else if (dn > 0 && ['NOT_STARTED', 'DONE', 'APPROVAL'].includes(a.status)) a.status = 'WORKING';
  else if (dn === 0 && a.status === 'DONE') a.status = 'NOT_STARTED';
}
function approvalFlow(b: PlainTask | null, a: PlainTask) {
  if ((b?.approval.state || '') === (a.approval.state || '')) return;
  if (a.approval.state === 'APPROVED' && (!a.steps.length || a.steps.every((z) => z.done))) a.status = 'DONE';
  if (a.approval.state === 'CHANGES' && a.status === 'APPROVAL') a.status = 'WORKING';
}
/** Marking done while an approval is still pending waits for it instead. */
export function guardDone(t: PlainTask) {
  if (t.status === 'DONE' && t.approval.required && t.approval.state !== 'APPROVED') t.status = 'APPROVAL';
}

function postLogs(env: Env, actor: Actor, b: PlainTask | null, a: PlainTask, ctx: Ctx) {
  if (!b) return;
  if (b.status !== a.status) {
    ctx.logs.push({ text: `Status: ${taskStatusMeta(b.status).label} → ${taskStatusMeta(a.status).label}`, kind: 'sys', notify: [] });
    if (a.status === 'APPROVAL' && a.approval.approver) ctx.logs.push({ text: 'Approval needed', kind: 'sys', notify: [a.approval.approver] });
  }
  const nb = new Set(b.assignees);
  const added = a.assignees.filter((m) => !nb.has(m));
  if (added.length) ctx.logs.push({ text: `Assigned to ${added.map((i) => nameOf(env, i)).join(', ')}`, kind: 'sys', notify: added });
  const removed = b.assignees.filter((m) => !a.assignees.includes(m));
  if (removed.length) ctx.logs.push({ text: `Removed ${removed.map((i) => nameOf(env, i)).join(', ')}`, kind: 'sys', notify: [] });
  const bs = new Map(b.steps.map((s) => [s.id, s]));
  a.steps.forEach((s) => { const o = bs.get(s.id); if (s.done && o && !o.done) ctx.logs.push({ text: `✓ Step done: ${s.text}`, kind: 'sys', notify: [] }); });
  const n0 = nextStep(b);
  const n1 = nextStep(a);
  if (n1?.assignee && a.status !== 'DONE' && (!n0 || n0.id !== n1.id || n0.assignee !== n1.assignee)) {
    ctx.logs.push({ text: `Your turn: ${n1.text}`, kind: 'sys', notify: [n1.assignee] });
  }
  if ((b.due || '') !== (a.due || '')) ctx.logs.push({ text: a.due ? `Due date → ${fmtD(a.due)}` : 'Due date removed', kind: 'sys', notify: [] });
  if ((b.priority || '') !== (a.priority || '') && a.priority) ctx.logs.push({ text: `Priority → ${taskPriorityMeta(a.priority)?.label ?? ''}`, kind: 'sys', notify: [] });
  if ((b.approval.state || '') !== (a.approval.state || '') && a.approval.state) {
    ctx.logs.push({ text: `${a.approval.state === 'APPROVED' ? '✅ Approved by ' : '↩️ Changes requested by '}${actor.name || 'someone'}`, kind: 'sys', notify: a.assignees });
  }
}

async function doneFlow(b: PlainTask | null, a: PlainTask, ctx: Ctx) {
  if (a.status === 'DONE' && b?.status !== 'DONE') {
    a.doneAt = new Date();
    if (a.repeat) ctx.creates.push({ repeatOf: a });
    if (b) {
      const waiting = await Task.find({ dependsOn: a.id, status: { $ne: 'DONE' } }).select('title assignees').lean();
      waiting.forEach((y: any) => ctx.logs.push({ text: `Unblocked: “${y.title}” can start now`, kind: 'sys', notify: (y.assignees ?? []).map(String) }));
    }
  }
  if (a.status !== 'DONE') a.doneAt = null;
}

function nextOccurrence(x: PlainTask): PlainTask {
  const base = x.due || today();
  const due = x.repeat === 'daily' ? addDays(base, 1) : x.repeat === 'weekly' ? addDays(base, 7) : addMonths(base, 1);
  const lead = x.start ? Math.round((Date.parse(`${base}T00:00:00Z`) - Date.parse(`${x.start}T00:00:00Z`)) / 864e5) : null;
  return {
    ...structuredClone(x), id: '', status: 'NOT_STARTED', due, start: lead != null ? addDays(due, -lead) : '', doneAt: null, updates: [], fired: {},
    steps: x.steps.map((s) => ({ ...s, id: newId(), done: false, doneAt: null })), approval: { ...x.approval, state: '' },
  };
}

/* ---------------------------------- commit ---------------------------------- */
/**
 * Applies `mutate` to a task (or a new one when id is null) and runs the
 * whole workflow: built-in status moves, automations, activity feed, done
 * handling, save, notifications, follow-up tasks. Returns the saved task.
 */
export async function commit(env: Env, actor: Actor, id: string | null, mutate: (t: PlainTask) => void, opts: CommitOpts = {}): Promise<PlainTask> {
  const raw = id ? await Task.findById(id).lean() : null;
  if (id && !raw) throw AppError.notFound('Task not found');
  const before = raw ? toPlain(raw) : null;
  const a: PlainTask = before ? structuredClone(before) : newBase(actor);
  if (!a.id) a.id = newId();
  mutate(a);
  if (!(TASK_STATUS_CODES as readonly string[]).includes(a.status)) a.status = 'NOT_STARTED';

  const ctx: Ctx = { logs: [], creates: [] };
  if (opts.log) ctx.logs.push({ text: opts.log, kind: opts.kind ?? 'sys', notify: opts.notify ?? [] });
  stepProgress(before, a);
  approvalFlow(before, a);
  runRules(env, before, a, ctx, opts.events, opts.depth ?? 0, new Set());
  approvalFlow(before, a);
  postLogs(env, actor, before, a, ctx);
  await doneFlow(before, a, ctx);
  if (!before) {
    const notify = [...new Set([...a.assignees, ...(opts.createNotify ?? [])])].filter((m) => m !== actor.memberId);
    ctx.logs.unshift({ text: opts.createdLog ?? 'Task created', kind: 'sys', notify });
  }

  const now = new Date();
  a.updates = [...a.updates, ...ctx.logs.map((l) => ({ at: now, by: actor.userId, byName: actor.name, who: actor.memberId, ...l }))].slice(-150);

  if (before) await Task.updateOne({ _id: a.id }, { $set: toDb(a) });
  else await Task.create({ _id: a.id, ...toDb(a) });

  // Bell notifications for the people each log names (only those linked to a login, never the person who did it).
  for (const l of ctx.logs) {
    const userIds = l.notify.map((m) => memberById(env, m)?.userId).filter((u): u is string => !!u && u !== actor.userId);
    if (userIds.length) {
      await notifyUsers(userIds, { type: l.kind === 'comment' ? 'TASK_COMMENT' : 'TASK_UPDATE', title: a.title, body: l.text, link: `/tasks?open=${a.id}` });
    }
  }

  const depth = (opts.depth ?? 0) + 1;
  for (const c of ctx.creates) {
    if ('repeatOf' in c) {
      const n = nextOccurrence(c.repeatOf);
      await commit(env, actor, null, (z) => Object.assign(z, { ...n, id: z.id, createdBy: actor.userId, createdWho: actor.memberId }), { createdLog: `Repeats ${c.repeatOf.repeat} – next one created`, depth });
    } else {
      await commit(env, actor, null, (z) => {
        z.forWhom = c.from.forWhom;
        z.title = `${c.workflow.name} – ${c.from.title}`;
        applyWorkflow(env, z, c.workflow);
      }, { createdLog: `Created by automation from “${c.from.title}”`, depth });
    }
  }
  const saved = await Task.findById(a.id).lean();
  return toPlain(saved);
}

/* -------------------------------- time rules -------------------------------- */
/** Hourly: fire "due date arrives" / "becomes overdue" automations once per task per due date. */
export async function runTimeTriggers(): Promise<{ fired: number }> {
  const env = await loadEnv();
  const timeRules = env.rules.filter((r) => r.trigger.type === 'due_today' || r.trigger.type === 'overdue');
  if (!timeRules.length) return { fired: 0 };
  const td = today();
  const tasks = await Task.find({ status: { $ne: 'DONE' }, due: { $ne: '', $lte: td } }).select('due fired').lean();
  const actor: Actor = { userId: null, name: 'Automation', memberId: null };
  let fired = 0;
  for (const x of tasks as any[]) {
    const mark: Record<string, string> = {};
    const evs: { type: string }[] = [];
    for (const r of timeRules) {
      const key = `${r.trigger.type === 'due_today' ? 'd' : 'o'}:${x.due}`;
      if ((x.fired ?? {})[r.id] === key) continue;
      if (r.trigger.type === 'due_today' && x.due === td) { evs.push({ type: 'due_today' }); mark[r.id] = key; }
      if (r.trigger.type === 'overdue' && x.due < td) { evs.push({ type: 'overdue' }); mark[r.id] = key; }
    }
    if (!evs.length) continue;
    const uniq = [...new Map(evs.map((e) => [e.type, e])).values()];
    await commit(env, actor, String(x._id), (z) => { z.fired = { ...z.fired, ...mark }; }, { events: uniq });
    fired++;
  }
  return { fired };
}
