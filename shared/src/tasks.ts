/**
 * Office Teams - the office's own work: tasks for MLA South / MLA North / MP
 * (and general office work), done by each office's team (PAs, typist, driver,
 * attender) and the shared social media team. Shared by server (validation,
 * workflow engine) and client (labels, colours).
 */

/** Who a task is for. '' = office (general). Same codes as the principals. */
export const TASK_FOR = [
  { code: 'MLA_S', name: 'MLA – Davanagere South', short: 'MLA South', color: '#1E88E5' },
  { code: 'MLA_N', name: 'MLA – Davanagere North', short: 'MLA North', color: '#00897B' },
  { code: 'MP', name: 'MP – Davanagere', short: 'MP', color: '#8E24AA' },
] as const;
export const TASK_FOR_CODES = TASK_FOR.map((f) => f.code) as [string, ...string[]];
export const TASK_OFFICE_COLOR = '#64748B';

/** Teams people belong to: one per office, plus the shared social media team. */
export const TASK_TEAMS = [
  ...TASK_FOR,
  { code: 'SOCIAL', name: 'Social Media Team', short: 'Social media', color: '#F4511E' },
] as const;
export type TaskTeam = (typeof TASK_TEAMS)[number]['code'];
export const TASK_TEAM_CODES = TASK_TEAMS.map((t) => t.code) as [TaskTeam, ...TaskTeam[]];

export const OFFICE_ROLES = ['PA-T1', 'PA-T2', 'Typist', 'Driver', 'Attender', 'Other'] as const;
export const SOCIAL_ROLES = ['Graphic Designer', 'Social Media Creator', 'Other'] as const;
export const ALL_TEAM_ROLES = ['PA-T1', 'PA-T2', 'Typist', 'Driver', 'Attender', 'Graphic Designer', 'Social Media Creator', 'Other'] as const;
export const rolesForTeam = (team: string): readonly string[] => (team === 'SOCIAL' ? SOCIAL_ROLES : OFFICE_ROLES);
/** Roles that live in the social media team (a step for them goes to that team, whichever office the task is for). */
export const isSocialRole = (role: string) => role === 'Graphic Designer' || role === 'Social Media Creator';

export const TASK_STATUSES = [
  { code: 'NOT_STARTED', label: 'Not started', color: '#94A3B8' },
  { code: 'WORKING', label: 'Working on it', color: '#F59E0B' },
  { code: 'STUCK', label: 'Stuck', color: '#E2445C' },
  { code: 'APPROVAL', label: 'Waiting for approval', color: '#A25DDC' },
  { code: 'DONE', label: 'Done', color: '#00A86B' },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]['code'];
export const TASK_STATUS_CODES = TASK_STATUSES.map((s) => s.code) as [TaskStatus, ...TaskStatus[]];

export const TASK_PRIORITIES = [
  { code: 'CRITICAL', label: 'Critical', color: '#1F2937' },
  { code: 'HIGH', label: 'High', color: '#5B21B6' },
  { code: 'MEDIUM', label: 'Medium', color: '#4F46E5' },
  { code: 'LOW', label: 'Low', color: '#60A5FA' },
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]['code'];
export const TASK_PRIORITY_CODES = TASK_PRIORITIES.map((p) => p.code) as [TaskPriority, ...TaskPriority[]];

export const TASK_CATEGORIES = [
  'Letter / Typing', 'Grievance follow-up', 'Event / Visit prep', 'Travel / Vehicle', 'Social media',
  'Office work', 'Meeting follow-up', 'Personal', 'Other',
] as const;

export const TASK_REPEATS = [
  { code: '', label: 'Does not repeat' },
  { code: 'daily', label: 'Every day' },
  { code: 'weekly', label: 'Every week' },
  { code: 'monthly', label: 'Every month' },
] as const;
export const TASK_REPEAT_CODES = ['', 'daily', 'weekly', 'monthly'] as const;

export const TASK_APPROVAL_STATES = ['', 'APPROVED', 'CHANGES'] as const;

export const taskStatusMeta = (code: string) => TASK_STATUSES.find((s) => s.code === code) ?? TASK_STATUSES[0];
export const taskPriorityMeta = (code: string | null | undefined) => TASK_PRIORITIES.find((p) => p.code === code);
export const taskForMeta = (code: string | null | undefined) => TASK_FOR.find((f) => f.code === code);
export const taskTeamMeta = (code: string | null | undefined) => TASK_TEAMS.find((t) => t.code === code);
export const taskForColor = (code: string | null | undefined) => taskTeamMeta(code)?.color ?? TASK_OFFICE_COLOR;

/* --------------------------------- workflows -------------------------------- */
export interface WorkflowStepDef { text: string; role: string }
export interface WorkflowDef {
  id: string;
  name: string;
  category: string;
  priority: string;
  dueInDays: number | null;
  approval: { required: boolean; approverRole: string };
  steps: WorkflowStepDef[];
}

/** Ready-made step-by-step processes. Each step goes to a role, so the right person is picked per office. */
export const BUILTIN_WORKFLOWS: WorkflowDef[] = [
  {
    id: 'b:social', name: 'Social media post', category: 'Social media', priority: 'MEDIUM', dueInDays: 1,
    approval: { required: true, approverRole: 'PA-T1' },
    steps: [
      { text: 'Brief: event details, photos, message', role: 'PA-T1' },
      { text: 'Design the creative / poster', role: 'Graphic Designer' },
      { text: 'Write caption, reel / video edit', role: 'Social Media Creator' },
      { text: 'Post on all handles + WhatsApp groups', role: 'Social Media Creator' },
    ],
  },
  {
    id: 'b:letter', name: 'Letter / Representation', category: 'Letter / Typing', priority: 'MEDIUM', dueInDays: 2,
    approval: { required: true, approverRole: 'PA-T1' },
    steps: [
      { text: 'Draft the letter', role: 'PA-T2' },
      { text: 'Type and print', role: 'Typist' },
      { text: 'Check and get signature', role: 'PA-T1' },
      { text: 'Dispatch / deliver', role: 'Attender' },
    ],
  },
  {
    id: 'b:grievance', name: 'Public grievance follow-up', category: 'Grievance follow-up', priority: 'HIGH', dueInDays: 7,
    approval: { required: false, approverRole: 'PA-T1' },
    steps: [
      { text: 'Record the complaint and documents', role: 'PA-T2' },
      { text: 'Forward to the department / officer', role: 'PA-T2' },
      { text: 'Follow up with the officer', role: 'PA-T1' },
      { text: 'Inform the citizen of the result', role: 'PA-T2' },
    ],
  },
  {
    id: 'b:event', name: 'Event / visit preparation', category: 'Event / Visit prep', priority: 'HIGH', dueInDays: 1,
    approval: { required: false, approverRole: 'PA-T1' },
    steps: [
      { text: 'Confirm time, venue and contact person', role: 'PA-T1' },
      { text: 'Vehicle, fuel and route', role: 'Driver' },
      { text: 'Shawl, bouquet, memento, material', role: 'Attender' },
      { text: 'Photo / video coverage', role: 'Social Media Creator' },
    ],
  },
  {
    id: 'b:feedback', name: 'Citizen feedback call', category: 'Grievance follow-up', priority: 'MEDIUM', dueInDays: 3,
    approval: { required: false, approverRole: 'PA-T1' },
    steps: [
      { text: 'Call the citizen and confirm the issue is solved', role: 'PA-T2' },
      { text: 'Note their feedback in the task', role: 'PA-T2' },
    ],
  },
];

/* -------------------------------- automations ------------------------------- */
export const AUTOMATION_TRIGGERS = [
  { code: 'created', label: 'A task is created' },
  { code: 'status_to', label: 'Status changes to', value: 'status' },
  { code: 'priority_to', label: 'Priority changes to', value: 'priority' },
  { code: 'assigned', label: 'Someone is assigned' },
  { code: 'step_done', label: 'A step is completed' },
  { code: 'all_steps_done', label: 'All steps are completed' },
  { code: 'approval_to', label: 'Approval is', value: 'approval' },
  { code: 'comment', label: 'Someone posts an update' },
  { code: 'due_today', label: 'The due date arrives' },
  { code: 'overdue', label: 'A task becomes overdue' },
] as const;
export const AUTOMATION_TRIGGER_CODES = AUTOMATION_TRIGGERS.map((t) => t.code) as [string, ...string[]];

export const AUTOMATION_ACTIONS = [
  { code: 'notify', label: 'Notify', value: 'target' },
  { code: 'set_status', label: 'Set status to', value: 'status' },
  { code: 'set_priority', label: 'Set priority to', value: 'priority' },
  { code: 'assign', label: 'Assign to', value: 'person' },
  { code: 'set_due', label: 'Set due date to', value: 'days' },
  { code: 'comment', label: 'Post an update', value: 'text' },
  { code: 'create_task', label: 'Create a follow-up task from', value: 'workflow' },
] as const;
export const AUTOMATION_ACTION_CODES = AUTOMATION_ACTIONS.map((a) => a.code) as [string, ...string[]];

export interface AutomationDef {
  name: string;
  trigger: { type: string; value?: string };
  cond: { forWhom?: string; category?: string; priority?: string };
  actions: { type: string; value?: string }[];
}

/** Gallery of ready-made automations ("Use this"). */
export const AUTOMATION_RECIPES: AutomationDef[] = [
  { name: 'Stuck → alert the PA', trigger: { type: 'status_to', value: 'STUCK' }, cond: {}, actions: [{ type: 'notify', value: 'role:PA-T1' }, { type: 'set_priority', value: 'HIGH' }] },
  { name: 'Approval needed → notify approver', trigger: { type: 'status_to', value: 'APPROVAL' }, cond: {}, actions: [{ type: 'notify', value: 'approver' }] },
  { name: 'Overdue → raise priority', trigger: { type: 'overdue' }, cond: {}, actions: [{ type: 'set_priority', value: 'HIGH' }, { type: 'notify', value: 'assignees' }] },
  { name: 'Due today → remind', trigger: { type: 'due_today' }, cond: {}, actions: [{ type: 'notify', value: 'assignees' }] },
  { name: 'Done → tell whoever created it', trigger: { type: 'status_to', value: 'DONE' }, cond: {}, actions: [{ type: 'notify', value: 'creator' }] },
  { name: 'Critical → alert PA-T1', trigger: { type: 'priority_to', value: 'CRITICAL' }, cond: {}, actions: [{ type: 'notify', value: 'role:PA-T1' }] },
  { name: 'New social post → designer', trigger: { type: 'created' }, cond: { category: 'Social media' }, actions: [{ type: 'assign', value: 'role:Graphic Designer' }] },
  { name: 'Grievance done → feedback call', trigger: { type: 'status_to', value: 'DONE' }, cond: { category: 'Grievance follow-up' }, actions: [{ type: 'create_task', value: 'b:feedback' }] },
  { name: 'Changes requested → back to work', trigger: { type: 'approval_to', value: 'CHANGES' }, cond: {}, actions: [{ type: 'set_status', value: 'WORKING' }, { type: 'notify', value: 'assignees' }] },
  { name: 'New update → notify people', trigger: { type: 'comment' }, cond: {}, actions: [{ type: 'notify', value: 'assignees' }] },
];

/** "Notify / assign" targets an automation can point at, besides a specific person. */
export const AUTOMATION_TARGETS = [
  { code: 'assignees', label: 'The people on the task' },
  { code: 'approver', label: 'The approver' },
  { code: 'creator', label: 'Whoever created it' },
] as const;
