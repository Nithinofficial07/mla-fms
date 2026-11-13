import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api, errorMessage } from '@/api/client';
import { taskForMeta, taskPriorityMeta, taskStatusMeta } from '@mla/shared';

/* ----------------------------------- types ---------------------------------- */
export interface Step { id: string; text: string; role: string; assignee: string | null; done: boolean; doneAt: string | null; due: string }
export interface Update { id: string; at: string; by: string | null; byName: string; who: string | null; text: string; kind: 'comment' | 'sys' | 'auto'; notify: string[] }
export interface Task {
  id: string; title: string; notes: string; forWhom: string; category: string; priority: string; status: string;
  start: string; due: string; assignees: string[]; steps: Step[]; labels: string[]; dependsOn: string[]; repeat: string;
  approval: { required: boolean; approver: string | null; state: string }; template: string; updates: Update[];
  doneAt: string | null; createdBy: string | null; createdWho: string | null; createdAt: string; updatedAt: string;
}
export interface Member { id: string; name: string; team: string; role: string; phone: string; userId: string | null; active: boolean }
export interface Workflow {
  id: string; name: string; category: string; priority: string; dueInDays: number | null;
  approval: { required: boolean; approverRole: string }; steps: { text: string; role: string }[];
}
export interface Automation {
  id: string; name: string; on: boolean; trigger: { type: string; value: string };
  cond: { forWhom: string; category: string; priority: string }; actions: { type: string; value: string }[];
}
export interface Workspace { tasks: Task[]; members: Member[]; workflows: Workflow[]; automations: Automation[]; myMemberIds: string[]; today: string }

export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'forWhom' | 'category' | 'priority' | 'status' | 'start' | 'due' | 'assignees' | 'labels' | 'dependsOn' | 'repeat'>> & {
  steps?: Partial<Step>[]; approval?: Partial<Task['approval']>; workflowId?: string;
};

/* ---------------------------------- queries --------------------------------- */
export const WS_KEY = ['tasks', 'workspace'];

export function useWorkspace(all = false) {
  return useQuery({
    queryKey: [...WS_KEY, all],
    queryFn: () => api.get('/tasks/workspace', { params: all ? { all: '1' } : undefined }).then((r) => r.data as Workspace),
    refetchInterval: 60_000,
  });
}

/** Every write goes through here: on success the workspace reloads (the server may have changed more than one task). */
export function useTaskMutation<V>(fn: (v: V) => Promise<unknown>, okMsg?: string | ((v: V) => string)) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      const m = typeof okMsg === 'function' ? okMsg(v) : okMsg;
      if (m) enqueueSnackbar(m, { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
}

export const tasksApi = {
  create: (body: TaskPatch & { title: string }) => api.post('/tasks', body).then((r) => r.data as Task),
  patch: (id: string, body: TaskPatch) => api.patch(`/tasks/${id}`, body).then((r) => r.data as Task),
  comment: (id: string, text: string) => api.post(`/tasks/${id}/comment`, { text }).then((r) => r.data as Task),
  bulk: (body: { ids: string[]; status?: string; priority?: string; addAssignee?: string; due?: string }) => api.post('/tasks/bulk', body),
  remove: (id: string) => api.delete(`/tasks/${id}`),
  bulkDelete: (ids: string[]) => api.post('/tasks/bulk-delete', { ids }),
  saveMember: (m: Partial<Member>) => (m.id ? api.patch(`/tasks/team/${m.id}`, strip(m)) : api.post('/tasks/team', strip(m))),
  deleteMember: (id: string) => api.delete(`/tasks/team/${id}`),
  saveWorkflow: (w: Partial<Workflow>) => (w.id ? api.patch(`/tasks/workflows/${w.id}`, strip(w)) : api.post('/tasks/workflows', strip(w))),
  deleteWorkflow: (id: string) => api.delete(`/tasks/workflows/${id}`),
  saveAutomation: (a: Partial<Automation>) => (a.id ? api.patch(`/tasks/automations/${a.id}`, strip(a)) : api.post('/tasks/automations', strip(a))),
  deleteAutomation: (id: string) => api.delete(`/tasks/automations/${id}`),
  linkableUsers: (q: string) => api.get('/tasks/linkable-users', { params: { q } }).then((r) => r.data as { id: string; name: string; email: string }[]),
};
function strip<T extends { id?: string }>(o: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = o as T & { createdAt?: unknown; updatedAt?: unknown; createdBy?: unknown };
  delete (rest as Record<string, unknown>).createdAt;
  delete (rest as Record<string, unknown>).updatedAt;
  delete (rest as Record<string, unknown>).createdBy;
  return rest;
}

/* ---------------------------------- helpers --------------------------------- */
export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const fmtDay = (s: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};
export const initials = (n: string) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const nextStep = (t: Task) => t.steps.find((s) => !s.done);
export const taskPeople = (t: Task) => {
  const s = new Set(t.assignees);
  t.steps.forEach((z) => z.assignee && s.add(z.assignee));
  if (t.approval.required && t.approval.approver) s.add(t.approval.approver);
  return [...s];
};
export const PRIO_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, '': 4 };
export const sortTasks = (list: Task[]) => [...list].sort((x, y) =>
  (PRIO_RANK[x.priority || ''] - PRIO_RANK[y.priority || '']) || (x.due || '9999').localeCompare(y.due || '9999') || y.updatedAt.localeCompare(x.updatedAt));
export const BUCKETS = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No date', 'Done'] as const;
export function bucket(t: Task, today: string) {
  if (t.status === 'DONE') return 'Done';
  if (!t.due) return 'No date';
  if (t.due < today) return 'Overdue';
  if (t.due === today) return 'Today';
  if (t.due <= addDays(today, 7)) return 'Next 7 days';
  return 'Later';
}
export const dueTone = (t: Task, today: string): 'error' | 'warning' | undefined =>
  !t.due || t.status === 'DONE' ? undefined : t.due < today ? 'error' : t.due === today ? 'warning' : undefined;

/** Lookups over one workspace snapshot. */
export function useWs(all = false) {
  const q = useWorkspace(all);
  const data = q.data;
  const helpers = useMemo(() => {
    const members = data?.members ?? [];
    const byId = new Map(members.map((m) => [m.id, m]));
    const taskById = new Map((data?.tasks ?? []).map((t) => [t.id, t]));
    const me = members.find((m) => data?.myMemberIds.includes(m.id));
    return {
      members,
      active: members.filter((m) => m.active),
      member: (id: string | null | undefined) => (id ? byId.get(id) : undefined),
      task: (id: string) => taskById.get(id),
      me,
      today: data?.today ?? new Date().toISOString().slice(0, 10),
      isBlocked: (t: Task) => t.dependsOn.some((id) => { const b = taskById.get(id); return !!b && b.status !== 'DONE'; }),
    };
  }, [data]);
  return { ...q, ...helpers };
}

/* ------------------------------ WhatsApp text ------------------------------- */
export function taskText(t: Task, member: (id: string | null) => Member | undefined, full: boolean) {
  const f = taskForMeta(t.forWhom);
  const ppl = t.assignees.map((i) => member(i)?.name).filter(Boolean).join(', ');
  const bits: string[] = [];
  if (f) bits.push(f.short);
  if (t.due) bits.push(`Due ${fmtDay(t.due)}`);
  if (t.priority === 'CRITICAL' || t.priority === 'HIGH') bits.push(taskPriorityMeta(t.priority)!.label.toUpperCase());
  bits.push(taskStatusMeta(t.status).label);
  let s = `*${t.title}* (${bits.join(' · ')})`;
  if (ppl) s += `\n👤 ${ppl}`;
  if (full) t.steps.forEach((z) => { const w = member(z.assignee); s += `\n${z.done ? '✅' : '⬜'} ${z.text}${w ? ` – ${w.name}` : ''}`; });
  else { const n = nextStep(t); if (n) { const w = member(n.assignee); s += `\n➡️ ${n.text}${w ? ` – ${w.name}` : ''}`; } }
  if (full && t.notes) s += `\n📝 ${t.notes}`;
  return s;
}
export function personText(m: Member, tasks: Task[], member: (id: string | null) => Member | undefined, today: string) {
  const it = sortTasks(tasks.filter((x) => x.status !== 'DONE' && taskPeople(x).includes(m.id)));
  let s = `📋 *Pending work – ${m.name} (${m.role})*\n${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  if (!it.length) return `${s}\nNothing pending 👍`;
  const g: Record<string, Task[]> = {};
  it.forEach((x) => { (g[bucket(x, today)] ??= []).push(x); });
  BUCKETS.forEach((b) => {
    if (!g[b]) return;
    s += `\n\n*${b.toUpperCase()}*`;
    g[b].forEach((x, i) => { s += `\n${i + 1}. ${taskText(x, member, false).replace(/\n/g, '\n   ')}`; });
  });
  return s;
}
export const waLink = (phone: string, text?: string) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 ? `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '';
};
