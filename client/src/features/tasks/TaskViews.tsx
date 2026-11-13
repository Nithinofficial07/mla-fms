import { useState, type ReactNode } from 'react';
import {
  Box, Button, ButtonBase, Checkbox, Chip, IconButton, InputBase, LinearProgress, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  PERMISSIONS, TASK_CATEGORIES, TASK_FOR, TASK_PRIORITIES, TASK_STATUSES, TASK_OFFICE_COLOR, taskForColor, taskStatusMeta,
} from '@mla/shared';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  BUCKETS, addDays, bucket, dueTone, fmtDay, nextStep, sortTasks, taskPeople, tasksApi, useTaskMutation, useWs, type Task, type TaskPatch,
} from './tasksApi';
import { AvatarStack, DuePopover, ForChip, PeopleMenu, PriorityMenu, PriorityPill, StatusMenu, StatusPill } from './TaskBits';

type Pop = { kind: 'status' | 'priority' | 'people' | 'due'; anchor: HTMLElement; ids: string[] } | null;

/** Shared popovers + mutations for the views (single task or a bulk selection). */
function usePops() {
  const ws = useWs();
  const [pop, setPop] = useState<Pop>(null);
  const patch = useTaskMutation(({ id, b }: { id: string; b: TaskPatch }) => tasksApi.patch(id, b));
  const bulk = useTaskMutation((b: Parameters<typeof tasksApi.bulk>[0]) => tasksApi.bulk(b));
  const apply = (b: { status?: string; priority?: string; addAssignee?: string; due?: string }) => {
    if (!pop) return;
    if (pop.ids.length === 1) {
      const t = ws.task(pop.ids[0]);
      if (!t) return;
      if (b.addAssignee) {
        const a = b.addAssignee;
        patch.mutate({ id: t.id, b: { assignees: t.assignees.includes(a) ? t.assignees.filter((x) => x !== a) : [...t.assignees, a] } });
      } else patch.mutate({ id: t.id, b: b as TaskPatch });
    } else bulk.mutate({ ids: pop.ids, ...b });
  };
  const close = () => setPop(null);
  const one = pop && pop.ids.length === 1 ? ws.task(pop.ids[0]) : undefined;
  const menus = (
    <>
      <StatusMenu anchor={pop?.kind === 'status' ? pop.anchor : null} onClose={close} onPick={(s) => apply({ status: s })} />
      <PriorityMenu anchor={pop?.kind === 'priority' ? pop.anchor : null} onClose={close} onPick={(p) => apply({ priority: p })} />
      <PeopleMenu anchor={pop?.kind === 'people' ? pop.anchor : null} onClose={close} members={ws.members} selected={one?.assignees} onPick={(m) => { apply({ addAssignee: m }); if (pop && pop.ids.length > 1) close(); }} />
      <DuePopover anchor={pop?.kind === 'due' ? pop.anchor : null} onClose={close} value={one?.due ?? ''} today={ws.today} onPick={(d) => apply({ due: d })} />
    </>
  );
  return { setPop, menus, patch };
}

/* ------------------------------------- table ------------------------------------- */
export type GroupBy = 'status' | 'forWhom' | 'person' | 'due' | 'priority' | 'category';
interface Group { key: string; label: string; color: string; items: Task[]; preset: TaskPatch }

function groupsFor(list: Task[], by: GroupBy, ws: ReturnType<typeof useWs>): Group[] {
  const g: Group[] = [];
  const add = (key: string, label: string, color: string, items: Task[], preset: TaskPatch) => g.push({ key, label, color, items, preset });
  if (by === 'status') TASK_STATUSES.forEach((s) => add(s.code, s.label, s.color, list.filter((x) => x.status === s.code), { status: s.code }));
  else if (by === 'forWhom') {
    TASK_FOR.forEach((f) => add(f.code, f.name, f.color, list.filter((x) => x.forWhom === f.code), { forWhom: f.code }));
    add('OFFICE', 'Office (general)', TASK_OFFICE_COLOR, list.filter((x) => !x.forWhom), { forWhom: '' });
  } else if (by === 'person') {
    ws.active.forEach((m) => { const it = list.filter((x) => taskPeople(x).includes(m.id)); if (it.length) add(m.id, `${m.name} · ${m.role}`, taskForColor(m.team), it, { assignees: [m.id] }); });
    add('none', 'Unassigned', TASK_OFFICE_COLOR, list.filter((x) => !taskPeople(x).length), {});
  } else if (by === 'due') {
    const c: Record<string, string> = { Overdue: '#DC2626', Today: '#D97706', 'Next 7 days': '#2563EB', Later: '#0A2540', 'No date': '#94A3B8', Done: '#00A86B' };
    BUCKETS.forEach((b) => add(b, b, c[b], list.filter((x) => bucket(x, ws.today) === b), b === 'Today' ? { due: ws.today } : b === 'Next 7 days' ? { due: addDays(ws.today, 3) } : {}));
  } else if (by === 'priority') {
    TASK_PRIORITIES.forEach((p) => add(p.code, p.label, p.color, list.filter((x) => x.priority === p.code), { priority: p.code }));
    add('none', 'No priority', '#94A3B8', list.filter((x) => !x.priority), {});
  } else TASK_CATEGORIES.forEach((c) => add(c, c, '#0A2540', list.filter((x) => x.category === c), { category: c }));
  return g;
}

const COLS = '40px minmax(260px, 2.6fr) 116px 120px 170px 120px 104px 120px 150px';
const cell = { display: 'flex', alignItems: 'center', px: 1.25, minHeight: 42, borderRight: 1, borderColor: 'divider', minWidth: 0 } as const;

export function TableView({ list, groupBy, onOpen, showDone }: { list: Task[]; groupBy: GroupBy; onOpen: (id: string) => void; showDone: boolean }) {
  const ws = useWs();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.TASK_MANAGE);
  const { setPop, menus } = usePops();
  const [closed, setClosed] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('tasks:closed') ?? '[]')); } catch { return new Set(); } });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const create = useTaskMutation((b: TaskPatch & { title: string }) => tasksApi.create(b));
  const { confirm, dialog } = useConfirm();
  const bulkDelete = useTaskMutation((ids: string[]) => tasksApi.bulkDelete(ids), (ids) => `Deleted ${ids.length}`);

  const visible = groupBy === 'status' && !showDone ? list.filter((x) => x.status !== 'DONE' || Date.now() - Date.parse(x.doneAt ?? '0') < 7 * 864e5) : list;
  const groups = groupsFor(sortTasks(visible), groupBy, ws).filter((g) => g.items.length || ['status', 'forWhom'].includes(groupBy));
  const toggleGroup = (k: string) => setClosed((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    try { localStorage.setItem('tasks:closed', JSON.stringify([...n])); } catch { /* ignore */ }
    return n;
  });

  const header = (
    <Box sx={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: 1, borderColor: 'divider' }}>
      {['', 'Task', 'For', 'People', 'Status', 'Priority', 'Due', 'Progress', 'Type'].map((h, i) => (
        <Box key={h || i} sx={{ ...cell, minHeight: 36, justifyContent: i === 1 ? 'flex-start' : 'center', fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.02em', borderRight: i === 8 ? 0 : 1, borderColor: 'divider' }}>{h}</Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: 1100 }}>
          {groups.map((g) => {
            const k = `${groupBy}:${g.key}`;
            const isClosed = closed.has(k);
            const counts = TASK_STATUSES.map((s) => [s, g.items.filter((x) => x.status === s.code).length] as const).filter(([, n]) => n);
            return (
              <Box key={k} sx={{ mb: 2.75 }}>
                <ButtonBase onClick={() => toggleGroup(k)} sx={{ gap: 1, py: 1, px: 0.5, fontWeight: 700, fontSize: 16, color: g.color }}>
                  <Icon name="ExpandMore" sx={{ transform: isClosed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
                  {g.label} <Typography component="span" variant="body2" color="text.secondary">{g.items.length}</Typography>
                </ButtonBase>
                {!isClosed && (
                  <Paper variant="outlined" sx={{ borderLeft: `5px solid ${g.color}`, borderRadius: 2.5, overflow: 'hidden' }}>
                    {header}
                    {g.items.map((t) => (
                      <Row key={t.id} t={t} canEdit={canEdit} selected={selected.has(t.id)} onOpen={onOpen}
                        onSelect={(on) => setSelected((s) => { const n = new Set(s); if (on) n.add(t.id); else n.delete(t.id); return n; })}
                        onPop={(kind, anchor) => setPop({ kind, anchor, ids: [t.id] })} />
                    ))}
                    {canEdit && (
                      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <InputBase
                          fullWidth placeholder="+ Add task" sx={{ pl: 6.5, height: 40 }}
                          onKeyDown={(e) => {
                            const el = e.target as HTMLInputElement;
                            if (e.key === 'Enter' && el.value.trim()) {
                              create.mutate({ ...g.preset, title: el.value.trim(), assignees: g.preset.assignees ?? (ws.me ? [ws.me.id] : []) });
                              el.value = '';
                            }
                          }}
                        />
                      </Box>
                    )}
                    {!!g.items.length && (
                      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1.5} sx={{ px: 1.25 }}>
                        <Typography variant="caption" color="text.secondary">{counts.map(([s, n]) => `${s.label} ${n}`).join(' · ')}</Typography>
                        <Box sx={{ display: 'flex', gap: '2px', height: 22, borderRadius: 1.5, overflow: 'hidden', my: 1, width: 170 }}>
                          {counts.map(([s, n]) => <Tooltip key={s.code} title={`${s.label}: ${n}`}><Box sx={{ bgcolor: s.color, flex: n }} /></Tooltip>)}
                        </Box>
                      </Stack>
                    )}
                  </Paper>
                )}
              </Box>
            );
          })}
          {!groups.length && <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>No tasks match.</Typography>}
        </Box>
      </Box>
      {menus}
      {selected.size > 0 && (
        <Paper elevation={8} sx={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 1200, px: 2, py: 1.25, borderRadius: 3, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label={selected.size} color="primary" size="small" /><Typography variant="body2">selected</Typography>
          <Button size="small" variant="outlined" onClick={(e) => setPop({ kind: 'status', anchor: e.currentTarget, ids: [...selected] })}>Status</Button>
          <Button size="small" variant="outlined" onClick={(e) => setPop({ kind: 'priority', anchor: e.currentTarget, ids: [...selected] })}>Priority</Button>
          <Button size="small" variant="outlined" onClick={(e) => setPop({ kind: 'people', anchor: e.currentTarget, ids: [...selected] })}>Assign</Button>
          <Button size="small" variant="outlined" onClick={(e) => setPop({ kind: 'due', anchor: e.currentTarget, ids: [...selected] })}>Due</Button>
          <Button size="small" color="error" startIcon={<Icon name="Delete" />} onClick={async () => {
            if (await confirm({ title: `Delete ${selected.size} task(s)?`, message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true })) { bulkDelete.mutate([...selected]); setSelected(new Set()); }
          }}>Delete</Button>
          <IconButton size="small" onClick={() => setSelected(new Set())}><Icon name="Close" fontSize="small" /></IconButton>
        </Paper>
      )}
      {dialog}
    </Box>
  );
}

function Row({ t, canEdit, selected, onSelect, onOpen, onPop }: {
  t: Task; canEdit: boolean; selected: boolean; onSelect: (on: boolean) => void; onOpen: (id: string) => void;
  onPop: (kind: 'status' | 'priority' | 'people' | 'due', anchor: HTMLElement) => void;
}) {
  const ws = useWs();
  const steps = t.steps;
  const dn = steps.filter((s) => s.done).length;
  const comments = t.updates.filter((u) => u.kind === 'comment').length;
  const tone = dueTone(t, ws.today);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: 1, borderColor: 'divider', '&:hover > div': { bgcolor: 'action.hover' } }}>
      <Box sx={{ ...cell, justifyContent: 'center', px: 0 }}>{canEdit && <Checkbox size="small" checked={selected} onChange={(e) => onSelect(e.target.checked)} />}</Box>
      <Box sx={{ ...cell, gap: 1, cursor: 'pointer' }} onClick={() => onOpen(t.id)}>
        {ws.isBlocked(t) && <Tooltip title="Blocked by another task"><Box component="span" sx={{ display: 'inline-flex' }}><Icon name="Lock" sx={{ fontSize: 16, color: 'warning.main' }} /></Box></Tooltip>}
        {t.repeat && <Tooltip title={`Repeats ${t.repeat}`}><Box component="span" sx={{ display: 'inline-flex' }}><Icon name="Autorenew" sx={{ fontSize: 16, color: 'text.secondary' }} /></Box></Tooltip>}
        <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>{t.title}</Typography>
        {!!steps.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><Icon name="Checklist" sx={{ fontSize: 15 }} />{dn}/{steps.length}</Typography>}
        {!!comments && <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><Icon name="Comment" sx={{ fontSize: 15 }} />{comments}</Typography>}
      </Box>
      <Box sx={{ ...cell, justifyContent: 'center' }}><ForChip code={t.forWhom} small /></Box>
      <Box sx={{ ...cell, justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default' }} onClick={(e) => canEdit && onPop('people', e.currentTarget)}>
        <AvatarStack people={taskPeople(t).map((i) => ws.member(i))} />
      </Box>
      <Box sx={{ ...cell, px: 0 }}><StatusPill status={t.status} full height={42} onClick={canEdit ? (e) => onPop('status', e.currentTarget) : undefined} /></Box>
      <Box sx={{ ...cell, px: 0 }}><PriorityPill priority={t.priority} full height={42} onClick={canEdit ? (e) => onPop('priority', e.currentTarget) : undefined} /></Box>
      <Box sx={{ ...cell, justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default' }} onClick={(e) => canEdit && onPop('due', e.currentTarget)}>
        <Typography variant="body2" fontWeight={tone ? 700 : 400} color={tone ? `${tone}.main` : 'text.primary'}>{t.due ? fmtDay(t.due) : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}</Typography>
      </Box>
      <Box sx={{ ...cell, justifyContent: 'center' }}>
        {steps.length ? <Tooltip title={`${dn} of ${steps.length} steps`}><LinearProgress variant="determinate" color="success" value={(dn / steps.length) * 100} sx={{ width: '100%', height: 6, borderRadius: 3, bgcolor: 'action.hover' }} /></Tooltip> : <Typography color="text.disabled">—</Typography>}
      </Box>
      <Box sx={{ ...cell, borderRight: 0 }}><Typography variant="caption" color="text.secondary" noWrap>{t.category}</Typography></Box>
    </Box>
  );
}

/* ------------------------------------- board ------------------------------------- */
export function BoardView({ list, onOpen, showDone }: { list: Task[]; onOpen: (id: string) => void; showDone: boolean }) {
  const ws = useWs();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.TASK_MANAGE);
  const [over, setOver] = useState<string | null>(null);
  const patch = useTaskMutation(({ id, status }: { id: string; status: string }) => tasksApi.patch(id, { status }));
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))', gap: 1.5, p: 2, overflowX: 'auto', alignItems: 'start' }}>
      {TASK_STATUSES.map((s) => {
        let it = list.filter((x) => x.status === s.code);
        if (s.code === 'DONE') { it = [...it].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')); if (!showDone) it = it.filter((x) => Date.now() - Date.parse(x.doneAt ?? '0') < 7 * 864e5); } else it = sortTasks(it);
        return (
          <Box
            key={s.code}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(s.code); } }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) patch.mutate({ id, status: s.code }); }}
            sx={{ bgcolor: 'action.hover', borderRadius: 3, p: 1, minHeight: 140, borderTop: `4px solid ${s.color}`, outline: over === s.code ? '2px dashed' : 'none', outlineColor: 'primary.main' }}
          >
            <Stack direction="row" justifyContent="space-between" sx={{ m: 0.75, mb: 1.25 }}>
              <Typography variant="body2" fontWeight={700}>{s.label}</Typography>
              <Typography variant="body2" color="text.secondary">{it.length}</Typography>
            </Stack>
            {it.map((t) => {
              const dn = t.steps.filter((z) => z.done).length;
              const n = nextStep(t);
              const tone = dueTone(t, ws.today);
              return (
                <Paper
                  key={t.id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => onOpen(t.id)}
                  sx={{ p: 1.25, mb: 1, cursor: 'pointer', borderLeft: `4px solid ${taskForColor(t.forWhom)}`, borderRadius: 2.5, transition: 'transform .2s, box-shadow .2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, lineHeight: 1.35 }}>
                    {ws.isBlocked(t) && <Icon name="Lock" sx={{ fontSize: 14, color: 'warning.main', mr: 0.5, verticalAlign: '-2px' }} />}{t.title}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <ForChip code={t.forWhom} small />
                    {t.priority && t.priority !== 'LOW' && <PriorityPill priority={t.priority} height={20} />}
                    {t.due && <Typography variant="caption" fontWeight={tone ? 700 : 400} color={tone ? `${tone}.main` : 'text.secondary'}>{fmtDay(t.due)}</Typography>}
                    {!!t.steps.length && <Typography variant="caption" color="text.secondary">{dn}/{t.steps.length}</Typography>}
                    <Box sx={{ flex: 1 }} />
                    <AvatarStack people={taskPeople(t).map((i) => ws.member(i))} max={3} size={22} />
                  </Stack>
                  {n && t.status !== 'DONE' && (
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>→ {n.text}{n.assignee ? <> · <b>{ws.member(n.assignee)?.name}</b></> : null}</Typography>
                  )}
                  {!!t.steps.length && <LinearProgress variant="determinate" color="success" value={(dn / t.steps.length) * 100} sx={{ mt: 1, height: 5, borderRadius: 3, bgcolor: 'action.hover' }} />}
                </Paper>
              );
            })}
            {!it.length && <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', p: 2 }}>—</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ------------------------------------ calendar ------------------------------------ */
export function CalendarView({ list, month, onOpen, onNewOn }: { list: Task[]; month: Date; onOpen: (id: string) => void; onNewOn?: (day: string) => void }) {
  const ws = useWs();
  const first = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const cells: ReactNode[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const k = d.toISOString().slice(0, 10);
    const it = sortTasks(list.filter((x) => x.due === k));
    const out = d.getUTCMonth() !== first.getUTCMonth();
    cells.push(
      <Box key={k} onClick={() => onNewOn?.(k)} sx={{ minHeight: 110, p: 0.75, borderRight: (i + 1) % 7 ? 1 : 0, borderBottom: 1, borderColor: 'divider', cursor: onNewOn ? 'pointer' : 'default', bgcolor: out ? 'action.hover' : undefined, minWidth: 0 }}>
        <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, mb: 0.5, bgcolor: k === ws.today ? '#C99700' : undefined, color: k === ws.today ? '#fff' : out ? 'text.disabled' : 'text.primary' }}>{d.getUTCDate()}</Box>
        {it.slice(0, 4).map((x) => (
          <Tooltip key={x.id} title={`${x.title} · ${taskStatusMeta(x.status).label}`}>
            <Box
              onClick={(e) => { e.stopPropagation(); onOpen(x.id); }}
              sx={{ fontSize: 11.5, fontWeight: 600, px: 0.75, py: 0.25, mb: 0.4, borderRadius: 1, color: '#fff', bgcolor: taskForColor(x.forWhom), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: x.status === 'DONE' ? 0.5 : 1, textDecoration: x.status === 'DONE' ? 'line-through' : 'none' }}
            >
              {x.title}
            </Box>
          </Tooltip>
        ))}
        {it.length > 4 && <Typography variant="caption" color="text.secondary">+{it.length - 4} more</Typography>}
      </Box>,
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
        <Typography key={d} variant="caption" sx={{ p: 1.25, textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', color: i === 0 ? 'error.main' : 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{d}</Typography>
      ))}
      {cells}
    </Box>
  );
}

/* ------------------------------------ timeline ------------------------------------ */
export function TimelineView({ list, start, onOpen }: { list: Task[]; start: string; onOpen: (id: string) => void }) {
  const ws = useWs();
  const N = 28;
  const end = addDays(start, N - 1);
  const dated = sortTasks(list.filter((x) => x.due || x.start));
  const idx = (k: string) => Math.round((Date.parse(`${k}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 864e5);
  const days = Array.from({ length: N }, (_, i) => addDays(start, i));
  const isWeekend = (k: string) => [0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay());
  const dayBg = (k: string) => (k === ws.today ? alpha('#C99700', 0.12) : isWeekend(k) ? 'action.hover' : undefined);
  const groups = [...TASK_FOR.map((f) => ({ key: f.code, name: f.name, color: f.color, items: dated.filter((x) => x.forWhom === f.code) })),
    { key: '', name: 'Office (general)', color: TASK_OFFICE_COLOR, items: dated.filter((x) => !x.forWhom) }].filter((g) => g.items.length);
  const grid = (children: ReactNode) => <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider', minHeight: 38 }}>{days.map((k, i) => <Box key={k} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / N) * 100}%`, width: `${100 / N}%`, borderLeft: 1, borderColor: 'divider', bgcolor: dayBg(k) }} />)}{children}</Box>;
  const nameCell = (t: Task) => <Box onClick={() => onOpen(t.id)} sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', px: 1.5, py: 1, borderBottom: 1, borderRight: 1, borderColor: 'divider', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{t.title}</Box>;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '240px 1fr', minWidth: 1000 }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderRight: 1, borderColor: 'divider', fontSize: 12, color: 'text.secondary', position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>Task</Box>
        <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider', minHeight: 30 }}>
          {days.map((k, i) => (
            <Box key={k} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / N) * 100}%`, width: `${100 / N}%`, borderLeft: 1, borderColor: 'divider', bgcolor: dayBg(k), textAlign: 'center', fontSize: 11, fontWeight: 700, color: k === ws.today ? '#C99700' : 'text.secondary', pt: 0.75 }}>
              {Number(k.slice(8))}
            </Box>
          ))}
        </Box>
        {groups.map((g) => (
          <Box key={g.key || 'office'} sx={{ display: 'contents' }}>
            <Box sx={{ gridColumn: '1 / -1', px: 1.5, py: 1, fontWeight: 700, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider', color: g.color }}>{g.name}</Box>
            {g.items.map((t) => {
              const a = t.start || t.due;
              const b = t.due || t.start;
              const sa = a < b ? a : b;
              const sb = a < b ? b : a;
              if (sb < start || sa > end) {
                return (
                  <Box key={t.id} sx={{ display: 'contents' }}>
                    {nameCell(t)}
                    {grid(<Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: 8, top: 11 }}>{sb < start ? '← earlier' : 'later →'} · {fmtDay(t.due || t.start)}</Typography>)}
                  </Box>
                );
              }
              const i0 = Math.max(0, idx(sa));
              const i1 = Math.min(N - 1, idx(sb));
              return (
                <Box key={t.id} sx={{ display: 'contents' }}>
                  {nameCell(t)}
                  {grid(
                    <Tooltip title={`${t.title} · ${taskStatusMeta(t.status).label} · ${fmtDay(sa)}${sa !== sb ? ` – ${fmtDay(sb)}` : ''}`}>
                      <Box
                        onClick={() => onOpen(t.id)}
                        sx={{ position: 'absolute', top: 8, height: 22, left: `calc(${(i0 / N) * 100}% + 2px)`, width: `calc(${((i1 - i0 + 1) / N) * 100}% - 4px)`, bgcolor: taskStatusMeta(t.status).color, color: '#fff', borderRadius: 1.5, fontSize: 11.5, fontWeight: 600, px: 1, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer', zIndex: 1 }}
                      >
                        {taskPeople(t).map((p) => ws.member(p)?.name.split(' ')[0]).filter(Boolean).join(', ')}
                      </Box>
                    </Tooltip>,
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
        {!groups.length && <Typography color="text.secondary" sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center' }}>No tasks with dates in this view. Add a start or due date to a task.</Typography>}
      </Box>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ px: 2, py: 1.5 }}>
        {TASK_STATUSES.map((s) => <Stack key={s.code} direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: s.color }} /><Typography variant="caption" color="text.secondary">{s.label}</Typography></Stack>)}
      </Stack>
    </Box>
  );
}

