import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Autocomplete, Box, Button, ButtonBase, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ALL_TEAM_ROLES, AUTOMATION_ACTIONS, AUTOMATION_RECIPES, AUTOMATION_TARGETS, AUTOMATION_TRIGGERS, BUILTIN_WORKFLOWS,
  PERMISSIONS, TASK_CATEGORIES, TASK_FOR, TASK_PRIORITIES, TASK_STATUSES, TASK_TEAMS, rolesForTeam, taskForColor,
  taskForMeta, taskPriorityMeta, taskStatusMeta,
} from '@mla/shared';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  addDays, bucket, dueTone, fmtDay, fmtWhen, nextStep, personText, sortTasks, taskPeople, tasksApi, useTaskMutation, useWs, waLink,
  type Automation, type Member, type Task, type Workflow,
} from './tasksApi';
import { AvatarStack, ForChip, MemberAvatar, StatusPill, Tick } from './TaskBits';

/** Standard roles plus any custom role someone has been given. */
function useAllRoles() {
  const ws = useWs();
  return [...new Set([...ALL_TEAM_ROLES, ...ws.members.map((m) => m.role).filter(Boolean)])];
}

const Tile = ({ label, value, color, onClick }: { label: string; value: number | string; color?: string; onClick?: () => void }) => (
  <Card sx={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
    <CardContent sx={{ py: 2 }}>
      <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color }}>{value}</Typography>
    </CardContent>
  </Card>
);
const Tiles = ({ children }: { children: ReactNode }) => <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>{children}</Box>;

/* ------------------------------------- list row ------------------------------------- */
export function TaskRow({ t, onOpen, showWho }: { t: Task; onOpen: (id: string) => void; showWho?: boolean }) {
  const ws = useWs();
  const { can } = useAuth();
  const n = nextStep(t);
  const tone = dueTone(t, ws.today);
  const tick = useTaskMutation(() => tasksApi.patch(t.id, { status: t.status === 'DONE' ? 'WORKING' : 'DONE' }));
  return (
    <Box role="button" tabIndex={0} onClick={() => onOpen(t.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(t.id)} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', gap: 1.25, px: 1.75, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 1, bgcolor: taskForColor(t.forWhom) }} />
      {can(PERMISSIONS.TASK_MANAGE) && <Tick on={t.status === 'DONE'} onClick={() => tick.mutate()} />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {ws.isBlocked(t) && <Icon name="Lock" sx={{ fontSize: 14, color: 'warning.main', mr: 0.5, verticalAlign: '-2px' }} />}{t.title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
          <ForChip code={t.forWhom} small />
          {t.due && <Typography variant="caption" fontWeight={tone ? 700 : 400} color={tone ? `${tone}.main` : 'text.secondary'}>{fmtDay(t.due)}</Typography>}
          {n && t.status !== 'DONE' && <Typography variant="caption" color="text.secondary" noWrap>→ {n.text}{showWho && n.assignee ? ` · ${ws.member(n.assignee)?.name ?? ''}` : ''}</Typography>}
        </Stack>
      </Box>
      <StatusPill status={t.status} />
      {showWho && <Box sx={{ display: { xs: 'none', sm: 'block' } }}><AvatarStack people={taskPeople(t).map((i) => ws.member(i))} max={3} size={24} /></Box>}
    </Box>
  );
}

/* --------------------------------------- home --------------------------------------- */
export function HomePanel({ tasks, onOpen, goTasks }: { tasks: Task[]; onOpen: (id: string) => void; goTasks: () => void }) {
  const ws = useWs();
  const me = ws.me;
  const mine = me ? tasks.filter((x) => taskPeople(x).includes(me.id)) : tasks;
  const open = mine.filter((x) => x.status !== 'DONE');
  const over = open.filter((x) => x.due && x.due < ws.today);
  const dueT = open.filter((x) => x.due === ws.today);
  const wait = me ? tasks.filter((x) => x.status !== 'DONE' && (nextStep(x)?.assignee === me.id || (x.status === 'APPROVAL' && x.approval.approver === me.id))) : [];
  const doneW = mine.filter((x) => x.status === 'DONE' && Date.now() - Date.parse(x.doneAt ?? '0') < 7 * 864e5);
  const groups: Record<string, Task[]> = {};
  open.forEach((x) => { (groups[bucket(x, ws.today)] ??= []).push(x); });
  const order = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No date'].filter((b) => groups[b]);
  const recent = useMemo(() => tasks.flatMap((t) => t.updates.map((u) => ({ t, u }))).sort((a, b) => b.u.at.localeCompare(a.u.at)).slice(0, 20), [tasks]);
  return (
    <>
      {!ws.members.length && <Alert severity="info" sx={{ mb: 2 }}>Start by adding your team on the <b>Team</b> tab: PAs, typists, drivers, attenders and the social media team.</Alert>}
      {ws.members.length > 0 && !me && <Alert severity="info" sx={{ mb: 2 }}>Showing the whole office. Ask an admin to link your login to your name on the <b>Team</b> tab to see your own work and what is waiting on you.</Alert>}
      <Tiles>
        <Tile label={me ? 'My work' : 'Open tasks'} value={open.length} onClick={goTasks} />
        <Tile label="Overdue" value={over.length} color={over.length ? '#DC2626' : undefined} onClick={goTasks} />
        <Tile label="Due today" value={dueT.length} color={dueT.length ? '#D97706' : undefined} onClick={goTasks} />
        <Tile label={me ? 'Waiting on me' : 'Done this week'} value={me ? wait.length : doneW.length} />
      </Tiles>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7.5}>
          {me && !!wait.length && (
            <Card sx={{ mb: 2, borderColor: 'rgba(201,151,0,.4)' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography fontWeight={700}>Waiting on me</Typography><Typography variant="caption" color="text.secondary">Your step is next or your approval is needed</Typography>
              </Stack>
              {sortTasks(wait).map((t) => <TaskRow key={t.id} t={t} onOpen={onOpen} />)}
            </Card>
          )}
          <Card>
            {order.length ? order.map((b) => (
              <Box key={b}>
                <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Typography fontWeight={700}>{b}</Typography><Typography variant="caption" color="text.secondary">{groups[b].length}</Typography>
                </Stack>
                {sortTasks(groups[b]).map((t) => <TaskRow key={t.id} t={t} onOpen={onOpen} showWho={!me} />)}
              </Box>
            )) : <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>Nothing pending {me ? 'for you ' : ''}🎉</Typography>}
          </Card>
        </Grid>
        <Grid item xs={12} md={4.5}>
          <Card>
            <Typography fontWeight={700} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>Recent activity</Typography>
            {recent.map(({ t, u }) => (
              <ButtonBase key={`${t.id}:${u.id}`} onClick={() => onOpen(t.id)} sx={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{t.title}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{u.text}</Typography>
                  <Typography variant="caption" color="text.secondary">{ws.member(u.who)?.name || u.byName} · {fmtWhen(u.at)}</Typography>
                </Box>
              </ButtonBase>
            ))}
            {!recent.length && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>No activity yet</Typography>}
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

/* ------------------------------------- workload ------------------------------------- */
export function WorkloadPanel({ tasks, forWhom, onOpen }: { tasks: Task[]; forWhom: string; onOpen: (id: string) => void }) {
  const ws = useWs();
  const [cell, setCell] = useState<{ m: Member; d: string } | null>(null);
  const N = 14;
  const days = Array.from({ length: N }, (_, i) => addDays(ws.today, i));
  const open = tasks.filter((x) => x.status !== 'DONE');
  const heat = (n: number) => (n === 0 ? 'action.hover' : n === 1 ? '#C7D7EA' : n === 2 ? '#8FB0D6' : n <= 4 ? '#4F7FB8' : '#1E4E8C');
  const listFor = (m: Member, d: string) => sortTasks(open.filter((z) => taskPeople(z).includes(m.id) && (d === 'over' ? z.due && z.due < ws.today : d === 'none' ? !z.due : z.due === d)));
  const td = (content: ReactNode, bg: string, onClick: () => void, title: string, color?: string) => (
    <Tooltip title={title} disableInteractive>
      <Box component="td" onClick={onClick} sx={{ height: 34, minWidth: 38, borderRadius: 1.5, textAlign: 'center', fontWeight: 700, fontSize: 13, cursor: 'pointer', bgcolor: bg, color }}>{content}</Box>
    </Tooltip>
  );
  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: '3px', minWidth: 900, width: '100%' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper' }} />
              <Box component="th" sx={{ fontSize: 11.5, color: 'error.main' }}>Overdue</Box>
              {days.map((k) => { const d = new Date(`${k}T00:00:00Z`); return <Box component="th" key={k} sx={{ fontSize: 11.5, fontWeight: 700, color: k === ws.today ? '#C99700' : 'text.secondary', whiteSpace: 'nowrap' }}>{d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}<br />{d.getUTCDate()}</Box>; })}
              <Box component="th" sx={{ fontSize: 11.5, color: 'text.secondary' }}>No date</Box>
              <Box component="th" sx={{ fontSize: 11.5, color: 'text.secondary' }}>Total</Box>
            </tr>
          </thead>
          <tbody>
            {TASK_TEAMS.filter((t) => !forWhom || t.code === forWhom || t.code === 'SOCIAL').map((team) => {
              const ms = ws.active.filter((m) => m.team === team.code);
              if (!ms.length) return null;
              return [
                <tr key={team.code}><Box component="td" colSpan={N + 4} sx={{ pt: 1.5, pb: 0.5, fontWeight: 700, color: team.color }}>{team.name}</Box></tr>,
                ...ms.map((m) => {
                  const mine = open.filter((x) => taskPeople(x).includes(m.id));
                  const ov = mine.filter((x) => x.due && x.due < ws.today).length;
                  const nd = mine.filter((x) => !x.due).length;
                  return (
                    <tr key={m.id}>
                      <Box component="td" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', px: 1, whiteSpace: 'nowrap' }}>
                        <Stack direction="row" spacing={1} alignItems="center"><MemberAvatar m={m} /><Box><Typography variant="body2" fontWeight={700}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.role}</Typography></Box></Stack>
                      </Box>
                      {td(ov || '·', ov ? 'rgba(220,38,38,.14)' : 'action.hover', () => setCell({ m, d: 'over' }), `${m.name}: ${ov} overdue`, ov ? '#DC2626' : 'transparent')}
                      {days.map((k) => { const n = mine.filter((x) => x.due === k).length; return <Fragment key={k}>{td(n || '·', heat(n), () => setCell({ m, d: k }), `${m.name} · ${fmtDay(k)}: ${n} task${n === 1 ? '' : 's'}`, n >= 3 ? '#fff' : n ? 'text.primary' : 'transparent')}</Fragment>; })}
                      {td(nd || '', 'action.hover', () => setCell({ m, d: 'none' }), `No due date: ${nd}`)}
                      <Box component="td" sx={{ textAlign: 'center', fontWeight: 700 }}>{mine.length}</Box>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </Box>
      </Box>
      {!ws.active.length && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Add people on the Team tab.</Typography>}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary">Tasks due per day:</Typography>
        {[[0, '0'], [1, '1'], [2, '2'], [3, '3–4'], [5, '5+']].map(([n, l]) => <Stack key={String(l)} direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: heat(Number(n)), border: 1, borderColor: 'divider' }} /><Typography variant="caption">{l}</Typography></Stack>)}
      </Stack>
      <Dialog open={!!cell} onClose={() => setCell(null)} fullWidth maxWidth="sm">
        {cell && <DialogTitle>{cell.m.name} · {cell.d === 'over' ? 'Overdue' : cell.d === 'none' ? 'No date' : fmtDay(cell.d)}</DialogTitle>}
        {cell && <Box>{listFor(cell.m, cell.d).map((t) => <TaskRow key={t.id} t={t} onOpen={(id) => { setCell(null); onOpen(id); }} />)}{!listFor(cell.m, cell.d).length && <Typography color="text.secondary" sx={{ p: 3 }}>Nothing here</Typography>}</Box>}
      </Dialog>
    </Card>
  );
}

/* ------------------------------------- dashboard ------------------------------------ */
function Bars({ rows }: { rows: { label: string; value: number; color: string; tip?: string }[] }) {
  const mx = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Typography color="text.secondary">—</Typography>;
  return (
    <Stack spacing={1}>
      {rows.map((r) => (
        <Tooltip key={r.label} title={r.tip ?? `${r.label}: ${r.value}`} disableInteractive>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', gap: 1.25, alignItems: 'center' }}>
            <Typography variant="body2" noWrap>{r.label}</Typography>
            <Box sx={{ height: 16 }}><Box sx={{ height: '100%', width: `${(r.value / mx) * 100}%`, minWidth: 2, bgcolor: r.color, borderRadius: '0 4px 4px 0' }} /></Box>
            <Typography variant="body2" fontWeight={700} textAlign="right">{r.value}</Typography>
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}

export function DashboardPanel({ tasks }: { tasks: Task[] }) {
  const ws = useWs();
  const open = tasks.filter((x) => x.status !== 'DONE');
  const over = open.filter((x) => x.due && x.due < ws.today).length;
  const stuck = open.filter((x) => x.status === 'STUCK').length;
  const doneW = tasks.filter((x) => x.status === 'DONE' && Date.now() - Date.parse(x.doneAt ?? '0') < 7 * 864e5).length;
  const byS = TASK_STATUSES.map((s) => ({ s, n: tasks.filter((x) => x.status === s.code).length })).filter((z) => z.n);
  const tot = byS.reduce((a, z) => a + z.n, 0);
  const days = Array.from({ length: 14 }, (_, i) => addDays(ws.today, i - 13));
  const doneD = days.map((k) => tasks.filter((x) => x.status === 'DONE' && x.doneAt && new Date(Date.parse(x.doneAt) + 5.5 * 3600_000).toISOString().slice(0, 10) === k).length);
  const mx = Math.max(1, ...doneD);
  return (
    <>
      <Tiles>
        <Tile label="Open tasks" value={open.length} />
        <Tile label="Overdue" value={over} color={over ? '#DC2626' : undefined} />
        <Tile label="Stuck" value={stuck} color={stuck ? '#E2445C' : undefined} />
        <Tile label="Done this week" value={doneW} color="#059669" />
      </Tiles>
      <Card sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Status · {tot} tasks</Typography>
        {tot ? (
          <>
            <Box sx={{ display: 'flex', gap: '2px', height: 30, borderRadius: 2, overflow: 'hidden', mt: 1 }}>
              {byS.map(({ s, n }) => <Tooltip key={s.code} title={`${s.label}: ${n} (${Math.round((n / tot) * 100)}%)`}><Box sx={{ bgcolor: s.color, flex: n }} /></Tooltip>)}
            </Box>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
              {byS.map(({ s, n }) => <Stack key={s.code} direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} /><Typography variant="body2" color="text.secondary">{s.label} <b>{n}</b></Typography></Stack>)}
            </Stack>
          </>
        ) : <Typography color="text.secondary">No tasks yet</Typography>}
      </Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>Open tasks by office</Typography>
          <Bars rows={[...TASK_FOR.map((f) => ({ label: f.short, value: open.filter((x) => x.forWhom === f.code).length, color: f.color })), { label: 'Office', value: open.filter((x) => !x.forWhom).length, color: '#64748B' }]} />
        </Card>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>Completed per day · last 14 days</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 170, borderBottom: 1, borderColor: 'divider', pt: 1 }}>
            {doneD.map((n, i) => <Tooltip key={days[i]} title={`${fmtDay(days[i])}: ${n} done`}><Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><Box sx={{ width: '70%', maxWidth: 26, height: `${(n / mx) * 100}%`, bgcolor: 'primary.main', borderRadius: '4px 4px 0 0' }} /></Box></Tooltip>)}
          </Box>
          <Box sx={{ display: 'flex', gap: '2px', mt: 0.75 }}>{days.map((k, i) => <Typography key={k} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center', fontSize: 10.5 }}>{i % 2 ? '' : Number(k.slice(8))}</Typography>)}</Box>
        </Card>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>Open tasks by person (top 10)</Typography>
          <Bars rows={ws.active.map((m) => { const it = open.filter((x) => taskPeople(x).includes(m.id)); const o = it.filter((x) => x.due && x.due < ws.today).length; return { label: m.name, value: it.length, color: taskForColor(m.team), tip: `${m.name} (${m.role}): ${it.length} open${o ? `, ${o} overdue` : ''}` }; }).filter((r) => r.value).sort((a, b) => b.value - a.value).slice(0, 10)} />
        </Card>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>Open tasks by type</Typography>
          <Bars rows={TASK_CATEGORIES.map((c) => ({ label: c, value: open.filter((x) => x.category === c).length, color: '#0A2540' })).filter((r) => r.value).sort((a, b) => b.value - a.value)} />
        </Card>
      </Box>
    </>
  );
}

/* ------------------------------------- workflows ------------------------------------ */
export function WorkflowsPanel({ onStart }: { onStart: (workflowId: string) => void }) {
  const ws = useWs();
  const { can } = useAuth();
  const admin = can(PERMISSIONS.TASK_ADMIN);
  const canStart = can(PERMISSIONS.TASK_MANAGE);
  const { confirm, dialog } = useConfirm();
  const [edit, setEdit] = useState<Partial<Workflow> | null>(null);
  const del = useTaskMutation((id: string) => tasksApi.deleteWorkflow(id), 'Workflow deleted');
  const custom = ws.data?.workflows ?? [];
  const card = (w: Workflow, isCustom: boolean) => (
    <Card key={w.id} sx={{ p: 2.25, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontSize={16} fontWeight={700}>{w.name}</Typography>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        <Chip size="small" label={w.category} />
        {w.dueInDays != null && <Typography variant="caption" color="text.secondary">Due in {w.dueInDays} day{w.dueInDays === 1 ? '' : 's'}</Typography>}
        {w.approval.required && <Chip size="small" label={`Approval: ${w.approval.approverRole}`} sx={{ bgcolor: '#A25DDC', color: '#fff' }} />}
        {!isCustom && <Chip size="small" variant="outlined" label="Built-in" />}
      </Stack>
      <Box component="ol" sx={{ my: 1.5, pl: 2.5, color: 'text.secondary', fontSize: 13, lineHeight: 1.8, flex: 1 }}>
        {w.steps.map((s, i) => <li key={i}>{s.text} – <Box component="b" sx={{ color: 'text.primary' }}>{s.role || 'anyone'}</Box></li>)}
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {canStart && <Button size="small" variant="contained" startIcon={<Icon name="Add" />} onClick={() => onStart(w.id)}>Start</Button>}
        {admin && <Button size="small" startIcon={<Icon name="ContentCopy" />} onClick={() => setEdit({ ...w, id: undefined, name: `${w.name} (copy)` })}>Duplicate</Button>}
        {admin && isCustom && <Button size="small" startIcon={<Icon name="Edit" />} onClick={() => setEdit(w)}>Edit</Button>}
        {admin && isCustom && <IconButton size="small" color="error" onClick={async () => { if (await confirm({ title: 'Delete this workflow?', message: w.name, confirmLabel: 'Delete', destructive: true })) del.mutate(w.id); }}><Icon name="Delete" fontSize="small" /></IconButton>}
      </Stack>
    </Card>
  );
  const grid = (items: ReactNode) => <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2, mb: 3 }}>{items}</Box>;
  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography color="text.secondary" sx={{ flex: 1 }}>Reusable step-by-step processes. Each step goes to a role, so the right person is picked for MLA South, MLA North or MP automatically.</Typography>
        {admin && <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setEdit({ name: '', category: 'Other', priority: 'MEDIUM', dueInDays: null, approval: { required: false, approverRole: 'PA-T1' }, steps: [{ text: '', role: 'PA-T1' }] })}>New workflow</Button>}
      </Stack>
      {!!custom.length && <><Typography variant="overline" color="text.secondary" fontWeight={700}>Your workflows</Typography>{grid(custom.map((w) => card(w, true)))}</>}
      <Typography variant="overline" color="text.secondary" fontWeight={700}>Built-in</Typography>
      {grid(BUILTIN_WORKFLOWS.map((w) => card(w, false)))}
      {edit && <WorkflowDialog value={edit} onClose={() => setEdit(null)} />}
      {dialog}
    </>
  );
}

function WorkflowDialog({ value, onClose }: { value: Partial<Workflow>; onClose: () => void }) {
  const [w, setW] = useState(value);
  const allRoles = useAllRoles();
  const save = useTaskMutation((x: Partial<Workflow>) => tasksApi.saveWorkflow(x), 'Workflow saved');
  const steps = w.steps ?? [];
  const setStep = (i: number, p: Partial<{ text: string; role: string }>) => setW({ ...w, steps: steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{w.id ? 'Edit' : 'New'} workflow</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={w.name ?? ''} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="e.g. Ward visit follow-up" />
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={4}><TextField select fullWidth label="Type" value={w.category ?? 'Other'} onChange={(e) => setW({ ...w, category: e.target.value })}>{TASK_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={4}><TextField select fullWidth label="Priority" value={w.priority ?? 'MEDIUM'} onChange={(e) => setW({ ...w, priority: e.target.value })}>{TASK_PRIORITIES.map((p) => <MenuItem key={p.code} value={p.code}>{p.label}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth type="number" label="Due in (days)" value={w.dueInDays ?? ''} onChange={(e) => setW({ ...w, dueInDays: e.target.value === '' ? null : Number(e.target.value) })} inputProps={{ min: 0 }} /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={!!w.approval?.required} onChange={(e) => setW({ ...w, approval: { approverRole: w.approval?.approverRole ?? 'PA-T1', required: e.target.checked } })} />} label="Needs approval" /></Grid>
            {w.approval?.required && <Grid item xs={12} sm={6}><TextField select fullWidth label="Approver role" value={w.approval.approverRole} onChange={(e) => setW({ ...w, approval: { required: true, approverRole: e.target.value } })}>{allRoles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</TextField></Grid>}
          </Grid>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>Steps</Typography>
          {steps.map((s, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Typography color="text.secondary" sx={{ width: 20 }}>{i + 1}.</Typography>
              <TextField size="small" sx={{ flex: 2 }} value={s.text} placeholder="What needs doing" onChange={(e) => setStep(i, { text: e.target.value })} />
              <TextField select size="small" sx={{ flex: 1 }} value={s.role} onChange={(e) => setStep(i, { role: e.target.value })}>
                <MenuItem value="">Anyone</MenuItem>{allRoles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <IconButton size="small" onClick={() => setW({ ...w, steps: steps.filter((_s, j) => j !== i) })}><Icon name="Close" fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Button size="small" startIcon={<Icon name="Add" />} sx={{ alignSelf: 'flex-start' }} onClick={() => setW({ ...w, steps: [...steps, { text: '', role: '' }] })}>Add step</Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!w.name?.trim() || !steps.some((s) => s.text.trim()) || save.isPending}
          onClick={() => save.mutate({ ...w, steps: steps.filter((s) => s.text.trim()) }, { onSuccess: onClose })}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------------------------ automations ----------------------------------- */
function useValueName() {
  const ws = useWs();
  const workflows = [...BUILTIN_WORKFLOWS, ...(ws.data?.workflows ?? [])];
  const target = (v: string) => AUTOMATION_TARGETS.find((t) => t.code === v)?.label.replace(/^The /, 'the ').replace(/^Whoever/, 'whoever') ?? (v.startsWith('role:') ? `${v.slice(5)} (same team)` : ws.member(v)?.name ?? '—');
  return (kind: string | undefined, v: string) => {
    if (!kind || !v) return '';
    if (kind === 'status') return taskStatusMeta(v).label;
    if (kind === 'priority') return taskPriorityMeta(v)?.label ?? v;
    if (kind === 'approval') return v === 'APPROVED' ? 'Approved' : 'Changes requested';
    if (kind === 'target' || kind === 'person') return target(v);
    if (kind === 'days') return Number(v) === 0 ? 'today' : Number(v) === 1 ? 'tomorrow' : `+${v} days`;
    if (kind === 'workflow') return workflows.find((w) => w.id === v)?.name ?? '—';
    return v;
  };
}

function RuleSentence({ r }: { r: Omit<Automation, 'id' | 'on'> }) {
  const valueName = useValueName();
  const tok = (text: string, color: string, bg: string) => <Box component="span" sx={{ display: 'inline-flex', px: 1, py: 0.25, mx: 0.25, borderRadius: 1.5, fontWeight: 600, fontSize: 13, color, bgcolor: bg, lineHeight: 1.6 }}>{text}</Box>;
  const tr = AUTOMATION_TRIGGERS.find((t) => t.code === r.trigger.type);
  const conds: string[] = [];
  if (r.cond?.forWhom) conds.push(`For is ${taskForMeta(r.cond.forWhom)?.short ?? r.cond.forWhom}`);
  if (r.cond?.category) conds.push(`Type is ${r.cond.category}`);
  if (r.cond?.priority) conds.push(`Priority is ${taskPriorityMeta(r.cond.priority)?.label ?? ''}`);
  return (
    <Box sx={{ lineHeight: 2 }}>
      <b>When</b> {tok(`${tr?.label ?? r.trigger.type}${'value' in (tr ?? {}) && r.trigger.value ? ` ${valueName((tr as { value?: string }).value, r.trigger.value)}` : ''}`, '#1D4ED8', 'rgba(37,99,235,.1)')}
      {!!conds.length && <> <b>and</b> {conds.map((c) => <span key={c}>{tok(c, '#B45309', 'rgba(217,119,6,.1)')}</span>)}</>}
      {' '}<b>then</b> {r.actions.map((a, i) => { const d = AUTOMATION_ACTIONS.find((x) => x.code === a.type); return <span key={i}>{i ? ' + ' : ''}{tok(`${d?.label ?? a.type} ${valueName(d?.value, a.value)}`, '#047857', 'rgba(5,150,105,.1)')}</span>; })}
    </Box>
  );
}

export function AutomationsPanel({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const ws = useWs();
  const { can } = useAuth();
  const admin = can(PERMISSIONS.TASK_ADMIN);
  const { confirm, dialog } = useConfirm();
  const [edit, setEdit] = useState<Partial<Automation> | null>(null);
  const rules = ws.data?.automations ?? [];
  const toggle = useTaskMutation((r: Automation) => tasksApi.saveAutomation({ id: r.id, on: !r.on }));
  const del = useTaskMutation((id: string) => tasksApi.deleteAutomation(id), 'Automation deleted');
  const runs = useMemo(() => tasks.flatMap((t) => t.updates.filter((u) => u.kind === 'auto' && u.text.startsWith('⚡')).map((u) => ({ t, u }))).sort((a, b) => b.u.at.localeCompare(a.u.at)).slice(0, 25), [tasks]);
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={8}>
        <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography color="text.secondary" sx={{ flex: 1 }}>When something happens, do something – they run on the server whenever anyone updates a task, and hourly for due dates.</Typography>
          {admin && <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setEdit({ name: '', on: true, trigger: { type: 'status_to', value: 'STUCK' }, cond: { forWhom: '', category: '', priority: '' }, actions: [{ type: 'notify', value: 'assignees' }] })}>New automation</Button>}
        </Stack>
        {!admin && <Alert severity="info" sx={{ mb: 1.5 }}>Only task admins can change automations.</Alert>}
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Your automations · {rules.filter((r) => r.on).length} on</Typography>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {rules.map((r) => (
            <Card key={r.id} sx={{ p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start', opacity: r.on ? 1 : 0.6 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(201,151,0,.14)', color: '#C99700', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="Bolt" /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700}>{r.name}</Typography><RuleSentence r={r} /></Box>
              {admin ? (
                <>
                  <Switch checked={r.on} onChange={() => toggle.mutate(r)} />
                  <IconButton size="small" onClick={() => setEdit(r)}><Icon name="Edit" fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={async () => { if (await confirm({ title: 'Delete this automation?', message: r.name, confirmLabel: 'Delete', destructive: true })) del.mutate(r.id); }}><Icon name="Delete" fontSize="small" /></IconButton>
                </>
              ) : <Chip size="small" label={r.on ? 'On' : 'Off'} />}
            </Card>
          ))}
          {!rules.length && <Card sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>No automations yet. Pick one from the gallery below.</Card>}
        </Stack>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Gallery – ready-made automations</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5 }}>
          {AUTOMATION_RECIPES.map((r) => (
            <Card key={r.name} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography fontWeight={700}>{r.name}</Typography>
              <Box sx={{ flex: 1, fontSize: 13 }}><RuleSentence r={{ ...r, cond: { forWhom: '', category: '', priority: '', ...r.cond }, trigger: { value: '', ...r.trigger }, actions: r.actions.map((a) => ({ value: '', ...a })) }} /></Box>
              {admin && <Button size="small" variant="outlined" startIcon={<Icon name="Add" />} sx={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ ...r, on: true, cond: { forWhom: '', category: '', priority: '', ...r.cond }, trigger: { value: '', ...r.trigger }, actions: r.actions.map((a) => ({ value: '', ...a })) })}>Use this</Button>}
            </Card>
          ))}
        </Box>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <Typography fontWeight={700} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>Recent runs</Typography>
          {runs.map(({ t, u }) => (
            <ButtonBase key={`${t.id}:${u.id}`} onClick={() => onOpen(t.id)} sx={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600} noWrap>{t.title}</Typography><Typography variant="body2">{u.text}</Typography><Typography variant="caption" color="text.secondary">{fmtWhen(u.at)}</Typography></Box>
            </ButtonBase>
          ))}
          {!runs.length && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Nothing has run yet</Typography>}
        </Card>
      </Grid>
      {edit && <AutomationDialog value={edit} onClose={() => setEdit(null)} />}
      {dialog}
    </Grid>
  );
}

function ValueInput({ kind, value, onChange }: { kind?: string; value: string; onChange: (v: string) => void }) {
  const ws = useWs();
  const allRoles = useAllRoles();
  if (!kind) return null;
  const sel = (opts: [string, string][]) => (
    <TextField select size="small" value={value} onChange={(e) => onChange(e.target.value)} sx={{ flex: 1, minWidth: 160 }}>
      {opts.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
    </TextField>
  );
  const people: [string, string][] = [
    ...allRoles.filter((r) => r !== 'Other').map((r) => [`role:${r}`, `${r} (same team)`] as [string, string]),
    ...ws.active.map((m) => [m.id, `${m.name} – ${m.role}`] as [string, string]),
  ];
  if (kind === 'status') return sel(TASK_STATUSES.map((s) => [s.code, s.label]));
  if (kind === 'priority') return sel(TASK_PRIORITIES.map((p) => [p.code, p.label]));
  if (kind === 'approval') return sel([['APPROVED', 'Approved'], ['CHANGES', 'Changes requested']]);
  if (kind === 'target') return sel([...AUTOMATION_TARGETS.map((t) => [t.code, t.label] as [string, string]), ...people]);
  if (kind === 'person') return sel([['creator', 'Whoever created it'], ...people]);
  if (kind === 'days') return sel([['0', 'Today'], ['1', 'Tomorrow'], ['2', 'In 2 days'], ['3', 'In 3 days'], ['7', 'In a week']]);
  if (kind === 'workflow') return sel([...BUILTIN_WORKFLOWS, ...(ws.data?.workflows ?? [])].map((w) => [w.id, w.name]));
  return <TextField size="small" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Update text" sx={{ flex: 1 }} />;
}

function AutomationDialog({ value, onClose }: { value: Partial<Automation>; onClose: () => void }) {
  const [r, setR] = useState(value);
  const save = useTaskMutation((x: Partial<Automation>) => tasksApi.saveAutomation(x), 'Automation saved');
  const tr = AUTOMATION_TRIGGERS.find((t) => t.code === r.trigger?.type);
  const trKind = tr && 'value' in tr ? tr.value : undefined;
  const actions = r.actions ?? [];
  const setAction = (i: number, p: Partial<{ type: string; value: string }>) => setR({ ...r, actions: actions.map((a, j) => (j === i ? { ...a, ...p } : a)) });
  const step = (n: number, label: string, color: string, children: ReactNode, extra?: ReactNode) => (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 1.5 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="caption" fontWeight={800} sx={{ color, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{n} · {label}</Typography>{extra}</Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{children}</Stack>
    </Box>
  );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{r.id ? 'Edit' : 'New'} automation</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField label="Name" value={r.name ?? ''} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="e.g. Stuck → alert the PA" />
          {step(1, 'When this happens', '#2563EB', <>
            <TextField select size="small" value={r.trigger?.type ?? ''} onChange={(e) => setR({ ...r, trigger: { type: e.target.value, value: '' } })} sx={{ flex: 1, minWidth: 220 }}>
              {AUTOMATION_TRIGGERS.map((t) => <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>)}
            </TextField>
            <ValueInput kind={trKind} value={r.trigger?.value ?? ''} onChange={(v) => setR({ ...r, trigger: { type: r.trigger!.type, value: v } })} />
          </>)}
          {step(2, 'Only if (optional)', '#D97706', <>
            <TextField select size="small" label="For" value={r.cond?.forWhom ?? ''} onChange={(e) => setR({ ...r, cond: { ...r.cond!, forWhom: e.target.value } })} sx={{ minWidth: 150 }}>
              <MenuItem value="">Any</MenuItem>{TASK_FOR.map((f) => <MenuItem key={f.code} value={f.code}>{f.short}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Type" value={r.cond?.category ?? ''} onChange={(e) => setR({ ...r, cond: { ...r.cond!, category: e.target.value } })} sx={{ minWidth: 180 }}>
              <MenuItem value="">Any</MenuItem>{TASK_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Priority" value={r.cond?.priority ?? ''} onChange={(e) => setR({ ...r, cond: { ...r.cond!, priority: e.target.value } })} sx={{ minWidth: 140 }}>
              <MenuItem value="">Any</MenuItem>{TASK_PRIORITIES.map((p) => <MenuItem key={p.code} value={p.code}>{p.label}</MenuItem>)}
            </TextField>
          </>)}
          {actions.map((a, i) => {
            const d = AUTOMATION_ACTIONS.find((x) => x.code === a.type);
            return (
              <Box key={i}>
                {step(i + 3, 'Then do this', '#059669', <>
                  <TextField select size="small" value={a.type} onChange={(e) => setAction(i, { type: e.target.value, value: '' })} sx={{ minWidth: 220 }}>
                    {AUTOMATION_ACTIONS.map((x) => <MenuItem key={x.code} value={x.code}>{x.label}</MenuItem>)}
                  </TextField>
                  <ValueInput kind={d?.value} value={a.value} onChange={(v) => setAction(i, { value: v })} />
                </>, actions.length > 1 ? <IconButton size="small" onClick={() => setR({ ...r, actions: actions.filter((_x, j) => j !== i) })}><Icon name="Close" fontSize="small" /></IconButton> : undefined)}
              </Box>
            );
          })}
          <Button size="small" startIcon={<Icon name="Add" />} sx={{ alignSelf: 'flex-start' }} onClick={() => setR({ ...r, actions: [...actions, { type: 'notify', value: 'assignees' }] })}>Add another action</Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate({ ...r, name: r.name?.trim() || tr?.label || 'Automation' }, { onSuccess: onClose })}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------------------------------- team --------------------------------------- */
export function TeamPanel({ tasks, onFilterPerson }: { tasks: Task[]; onFilterPerson: (id: string) => void }) {
  const ws = useWs();
  const { can } = useAuth();
  const admin = can(PERMISSIONS.TASK_ADMIN);
  const [edit, setEdit] = useState<Partial<Member> | null>(null);
  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography color="text.secondary" sx={{ flex: 1 }}>Teams for each office and the shared social media team. Link a person to their app login so they get notifications and see “My work”.</Typography>
        {admin && <Button variant="contained" startIcon={<Icon name="PersonAdd" />} onClick={() => setEdit({ name: '', team: 'MLA_S', role: 'PA-T1', phone: '', userId: null, active: true })}>Add person</Button>}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
        {TASK_TEAMS.map((team) => {
          const roles = rolesForTeam(team.code);
          const ms = ws.members.filter((m) => m.team === team.code).sort((a, b) => ((roles.indexOf(a.role) + 1) || 99) - ((roles.indexOf(b.role) + 1) || 99) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
          return (
            <Card key={team.code} sx={{ overflow: 'hidden' }}>
              <Stack direction="row" justifyContent="space-between" sx={{ bgcolor: team.color, color: '#fff', px: 2, py: 1.5 }}>
                <Typography fontWeight={700}>{team.name}</Typography><Typography variant="body2">{ms.length} people</Typography>
              </Stack>
              {ms.map((m) => {
                const open = tasks.filter((x) => x.status !== 'DONE' && taskPeople(x).includes(m.id));
                const ov = open.filter((x) => x.due && x.due < ws.today).length;
                const wa = waLink(m.phone, personText(m, tasks, ws.member, ws.today));
                return (
                  <Stack key={m.id} direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', opacity: m.active ? 1 : 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                    <MemberAvatar m={m} size={36} />
                    <ButtonBase sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => (admin ? setEdit(m) : onFilterPerson(m.id))}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{m.role}{m.phone ? ` · ${m.phone}` : ''}{!m.active ? ' · inactive' : ''}</Typography>
                        {admin && !m.userId && <Typography variant="caption" color="warning.main" component="div">No app login linked</Typography>}
                      </Box>
                    </ButtonBase>
                    <ButtonBase onClick={() => onFilterPerson(m.id)} sx={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                      <Typography fontWeight={800}>{open.length}</Typography>
                      <Typography variant="caption" color={ov ? 'error.main' : 'text.secondary'} fontWeight={ov ? 700 : 400}>{ov ? `${ov} overdue` : 'pending'}</Typography>
                    </ButtonBase>
                    {wa && <Tooltip title={`Send ${m.name} their pending work on WhatsApp`}><IconButton component="a" href={wa} target="_blank" rel="noopener" sx={{ color: '#16A34A' }}><Icon name="WhatsApp" /></IconButton></Tooltip>}
                  </Stack>
                );
              })}
              {!ms.length && <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>No one added yet</Typography>}
              {admin && <ButtonBase onClick={() => setEdit({ name: '', team: team.code, role: rolesForTeam(team.code)[0], phone: '', userId: null, active: true })} sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', color: 'primary.main', fontWeight: 600 }}><Icon name="Add" fontSize="small" />Add person</ButtonBase>}
            </Card>
          );
        })}
      </Box>
      {edit && <MemberDialog value={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function MemberDialog({ value, onClose }: { value: Partial<Member>; onClose: () => void }) {
  const [m, setM] = useState(value);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const { confirm, dialog } = useConfirm();
  const save = useTaskMutation((x: Partial<Member>) => tasksApi.saveMember(x), (x) => (x.id ? 'Saved' : `Added ${x.name}`));
  const del = useTaskMutation((id: string) => tasksApi.deleteMember(id), 'Removed');
  useEffect(() => {
    const t = setTimeout(() => { tasksApi.linkableUsers(q).then(setUsers).catch(() => setUsers([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const ws = useWs();
  const std = rolesForTeam(m.team ?? 'MLA_S').filter((r) => r !== 'Other');
  const roles = [...new Set([...std, ...ws.members.filter((x) => x.team === m.team).map((x) => x.role)])];
  const linked = users.find((u) => u.id === m.userId);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{m.id ? 'Edit person' : 'Add person'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} autoFocus />
          <Stack direction="row" spacing={1.5}>
            <TextField select fullWidth label="Team" value={m.team} onChange={(e) => { const team = e.target.value; setM({ ...m, team, role: m.role?.trim() ? m.role : rolesForTeam(team)[0] }); }}>
              {TASK_TEAMS.map((t) => <MenuItem key={t.code} value={t.code}>{t.name}</MenuItem>)}
            </TextField>
            <Autocomplete
              freeSolo fullWidth options={roles} value={m.role ?? ''} inputValue={m.role ?? ''}
              onInputChange={(_e, v) => setM({ ...m, role: v })} onChange={(_e, v) => setM({ ...m, role: v ?? '' })}
              renderInput={(p) => <TextField {...p} label="Role" placeholder="Pick or type a role" helperText="Type any role, e.g. Office Assistant" />}
            />
          </Stack>
          <TextField label="Phone (for WhatsApp)" value={m.phone ?? ''} onChange={(e) => setM({ ...m, phone: e.target.value })} inputProps={{ inputMode: 'tel' }} placeholder="98xxxxxxxx" />
          <Autocomplete
            options={users} value={linked ?? (m.userId ? { id: m.userId, name: 'Linked login', email: '' } : null)}
            getOptionLabel={(u) => `${u.name}${u.email ? ` – ${u.email}` : ''}`} isOptionEqualToValue={(a, b) => a.id === b.id}
            onInputChange={(_e, v, reason) => reason === 'input' && setQ(v)} onChange={(_e, u) => setM({ ...m, userId: u?.id ?? null })}
            renderInput={(p) => <TextField {...p} label="App login (optional)" helperText="Linked people get bell notifications and see “My work” and “Waiting on me”." />}
          />
          <FormControlLabel control={<Switch checked={m.active !== false} onChange={(e) => setM({ ...m, active: e.target.checked })} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions>
        {m.id && <Button color="error" sx={{ mr: 'auto' }} onClick={async () => { if (await confirm({ title: `Remove ${m.name}?`, message: 'They are taken off open tasks. Tip: switch Active off instead to keep them in history.', confirmLabel: 'Remove', destructive: true })) { del.mutate(m.id!); onClose(); } }}>Remove</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!m.name?.trim() || !m.role?.trim() || save.isPending} onClick={() => save.mutate({ ...m, name: m.name!.trim(), role: m.role!.trim() }, { onSuccess: onClose })}>Save</Button>
      </DialogActions>
      {dialog}
    </Dialog>
  );
}

