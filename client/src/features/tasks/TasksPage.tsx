import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Card, Chip, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, ListSubheader, MenuItem,
  Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PERMISSIONS, TASK_CATEGORIES, TASK_FOR, TASK_TEAMS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/app/AuthProvider';
import { addDays, personText, taskPeople, tasksApi, useTaskMutation, useWs, type Task } from './tasksApi';
import { TaskDrawer } from './TaskDrawer';
import { NewTaskDialog, type NewTaskPreset } from './NewTaskDialog';
import { BoardView, CalendarView, TableView, TimelineView, type GroupBy } from './TaskViews';
import { AutomationsPanel, DashboardPanel, HomePanel, TeamPanel, WorkflowsPanel, WorkloadPanel } from './TaskPanels';

type TabKey = 'home' | 'tasks' | 'workload' | 'dashboard' | 'workflows' | 'automations' | 'team';
type ViewKey = 'table' | 'board' | 'calendar' | 'timeline';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: 'My work', icon: 'Home' },
  { key: 'tasks', label: 'Tasks', icon: 'Checklist' },
  { key: 'workload', label: 'Workload', icon: 'BarChart' },
  { key: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
  { key: 'workflows', label: 'Workflows', icon: 'AccountTree' },
  { key: 'automations', label: 'Automations', icon: 'Bolt' },
  { key: 'team', label: 'Team', icon: 'Groups' },
];
const LS = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const weekStart = (today: string) => { const d = new Date(`${today}T00:00:00Z`); return addDays(today, -((d.getUTCDay() + 6) % 7)); };

export function TasksPage() {
  const ws = useWs();
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canEdit = can(PERMISSIONS.TASK_MANAGE);
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.some((t) => t.key === sp.get('tab')) ? sp.get('tab') : 'home') as TabKey;
  const openId = sp.get('open');
  const setParam = (k: string, v: string | null) => { const p = new URLSearchParams(sp); if (v) p.set(k, v); else p.delete(k); setSp(p, { replace: k === 'open' ? false : true }); };

  const [view, setView] = useState<ViewKey>(() => LS.get('tasks:view', 'table'));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => LS.get('tasks:gb', 'status'));
  const [f, setF] = useState(() => LS.get('tasks:f', { for: '', person: '', cat: '', q: '', done: false }));
  useEffect(() => { LS.set('tasks:view', view); LS.set('tasks:gb', groupBy); LS.set('tasks:f', f); }, [view, groupBy, f]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [tlStart, setTlStart] = useState<string | null>(null);
  const [newPreset, setNewPreset] = useState<NewTaskPreset | null>(null);
  const [quick, setQuick] = useState(false);
  const [quickText, setQuickText] = useState('');
  const quickAdd = useTaskMutation((title: string) => tasksApi.create({ title, forWhom: f.for || 'MLA_S', assignees: ws.me ? [ws.me.id] : [] }), (t) => `Added: ${t}`);

  const all = useMemo(() => ws.data?.tasks ?? [], [ws.data]);
  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all.filter((x: Task) => (!f.for || x.forWhom === f.for) && (!f.cat || x.category === f.cat)
      && (!f.person || taskPeople(x).includes(f.person))
      && (!q || `${x.title} ${x.notes} ${x.labels.join(' ')}`.toLowerCase().includes(q)));
  }, [all, f]);
  const open = (id: string) => setParam('open', id);
  const tl = tlStart ?? weekStart(ws.today);

  const filterBar = (opts: { person?: boolean; search?: boolean; done?: boolean } = {}) => (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
      <Chip label="Everyone" color={!f.for ? 'primary' : 'default'} variant={!f.for ? 'filled' : 'outlined'} onClick={() => setF({ ...f, for: '' })} />
      {TASK_FOR.map((x) => (
        <Chip key={x.code} label={x.short} variant={f.for === x.code ? 'filled' : 'outlined'} onClick={() => setF({ ...f, for: x.code })}
          icon={<Box component="span" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: x.color, ml: '10px !important' }} />}
          sx={f.for === x.code ? { bgcolor: x.color, color: '#fff' } : undefined} />
      ))}
      {opts.person !== false && (
        <TextField select size="small" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} sx={{ minWidth: 170 }} SelectProps={{ displayEmpty: true }}>
          <MenuItem value="">All people</MenuItem>
          {TASK_TEAMS.flatMap((t) => {
            const ms = ws.active.filter((m) => m.team === t.code);
            return ms.length ? [<ListSubheader key={t.code}>{t.short}</ListSubheader>, ...ms.map((m) => <MenuItem key={m.id} value={m.id}>{m.name} – {m.role}</MenuItem>)] : [];
          })}
        </TextField>
      )}
      <TextField select size="small" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} sx={{ minWidth: 170 }} SelectProps={{ displayEmpty: true }}>
        <MenuItem value="">All types</MenuItem>
        {TASK_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>
      {opts.search !== false && (
        <TextField size="small" placeholder="Search…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} sx={{ width: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="Search" fontSize="small" /></InputAdornment> }} />
      )}
      {opts.done && <Chip icon={<Icon name="Check" />} label="Show done" color={f.done ? 'primary' : 'default'} variant={f.done ? 'filled' : 'outlined'} onClick={() => setF({ ...f, done: !f.done })} />}
      {(f.for || f.person || f.cat || f.q) && <Button size="small" onClick={() => setF({ for: '', person: '', cat: '', q: '', done: f.done })}>Clear</Button>}
    </Stack>
  );

  const actions = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {ws.me && (
        <Button startIcon={<Icon name="WhatsApp" />} onClick={() => navigator.clipboard?.writeText(personText(ws.me!, all, ws.member, ws.today)).then(() => enqueueSnackbar('Copied – paste it in WhatsApp', { variant: 'success' }))}>
          Copy my work
        </Button>
      )}
      {canEdit && <Button variant="outlined" startIcon={<Icon name="Bolt" />} onClick={() => setQuick(true)}>Quick add</Button>}
      {canEdit && <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setNewPreset({})}>New task</Button>}
    </Stack>
  );

  return (
    <Box>
      <PageHeader title="Office Tasks" subtitle="What the office is working on for MLA South, MLA North and MP – and who is doing it" crumbs={[{ label: 'Home', to: '/' }, { label: 'Tasks' }]} action={actions} />
      <Tabs value={tab} onChange={(_e, v) => setParam('tab', v === 'home' ? null : v)} variant="scrollable" scrollButtons={false} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((t) => <Tab key={t.key} value={t.key} icon={<Icon name={t.icon} fontSize="small" />} iconPosition="start" label={t.label} sx={{ minHeight: 48 }} />)}
      </Tabs>
      {ws.isLoading && <LinearProgress />}
      {ws.isError && <Typography color="error">Could not load tasks.</Typography>}

      {ws.data && tab === 'home' && <HomePanel tasks={all} onOpen={open} goTasks={() => setParam('tab', 'tasks')} />}

      {ws.data && tab === 'tasks' && (
        <>
          {filterBar({ done: view === 'table' || view === 'board' })}
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, gap: 0.75, px: 1.5 } }}>
                <ToggleButton value="table"><Icon name="TableView" fontSize="small" />Table</ToggleButton>
                <ToggleButton value="board"><Icon name="ViewKanban" fontSize="small" />Board</ToggleButton>
                <ToggleButton value="calendar"><Icon name="CalendarMonth" fontSize="small" />Calendar</ToggleButton>
                <ToggleButton value="timeline"><Icon name="Timeline" fontSize="small" />Timeline</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ flex: 1 }} />
              {view === 'table' && (
                <TextField select size="small" label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} sx={{ minWidth: 150 }}>
                  {([['status', 'Status'], ['forWhom', 'For'], ['person', 'People'], ['due', 'Due'], ['priority', 'Priority'], ['category', 'Type']] as const).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
              )}
              {view === 'calendar' && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Button size="small" variant="outlined" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
                  <IconButton size="small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="ChevronLeft" /></IconButton>
                  <IconButton size="small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="ChevronRight" /></IconButton>
                  <Typography fontWeight={700} fontSize={17}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Typography>
                </Stack>
              )}
              {view === 'timeline' && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Button size="small" variant="outlined" onClick={() => setTlStart(null)}>Today</Button>
                  <IconButton size="small" onClick={() => setTlStart(addDays(tl, -7))}><Icon name="ChevronLeft" /></IconButton>
                  <IconButton size="small" onClick={() => setTlStart(addDays(tl, 7))}><Icon name="ChevronRight" /></IconButton>
                  <Typography fontWeight={700}>{new Date(`${tl}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – {new Date(`${addDays(tl, 27)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</Typography>
                </Stack>
              )}
            </Stack>
            {view === 'table' && <TableView list={f.done || groupBy === 'status' ? filtered : filtered.filter((x) => x.status !== 'DONE')} groupBy={groupBy} onOpen={open} showDone={f.done} />}
            {view === 'board' && <BoardView list={filtered} onOpen={open} showDone={f.done} />}
            {view === 'calendar' && <CalendarView list={filtered} month={month} onOpen={open} onNewOn={canEdit ? (d) => setNewPreset({ due: d }) : undefined} />}
            {view === 'timeline' && <TimelineView list={filtered} start={tl} onOpen={open} />}
          </Card>
        </>
      )}

      {ws.data && tab === 'workload' && <>{filterBar({ person: false, search: false })}<WorkloadPanel tasks={filtered} forWhom={f.for} onOpen={open} /></>}
      {ws.data && tab === 'dashboard' && <>{filterBar({ person: false, search: false })}<DashboardPanel tasks={filtered} /></>}
      {ws.data && tab === 'workflows' && <WorkflowsPanel onStart={(id) => setNewPreset({ workflowId: id })} />}
      {ws.data && tab === 'automations' && <AutomationsPanel tasks={all} onOpen={open} />}
      {ws.data && tab === 'team' && <TeamPanel tasks={all} onFilterPerson={(id) => { setF({ ...f, person: id }); setParam('tab', 'tasks'); }} />}

      <TaskDrawer id={openId} onClose={() => setParam('open', null)} onOpen={open} />
      <NewTaskDialog open={!!newPreset} preset={newPreset ?? undefined} onClose={() => setNewPreset(null)} onCreated={open} />
      <Dialog open={quick} onClose={() => setQuick(false)} fullWidth maxWidth="sm">
        <DialogTitle>Quick add</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth placeholder="Type a task and press Enter – e.g. Call AEE about drain" value={quickText} onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && quickText.trim()) { quickAdd.mutate(quickText.trim()); setQuickText(''); } }} sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Goes to {TASK_FOR.find((x) => x.code === (f.for || 'MLA_S'))?.short}{ws.me ? ` and is assigned to ${ws.me.name}` : ''}. Press Enter again to add more.
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
