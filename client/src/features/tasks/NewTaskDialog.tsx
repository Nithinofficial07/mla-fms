import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { BUILTIN_WORKFLOWS, TASK_CATEGORIES, TASK_FOR, TASK_PRIORITIES, TASK_REPEATS, isSocialRole } from '@mla/shared';
import { addDays, tasksApi, useTaskMutation, useWs, type Member, type TaskPatch } from './tasksApi';
import { MemberAvatar } from './TaskBits';

export interface NewTaskPreset extends TaskPatch { workflowId?: string }

const roleHolder = (members: Member[], role: string, forWhom: string) =>
  members.find((m) => m.active && m.role === role && (isSocialRole(role) ? m.team === 'SOCIAL' : (!forWhom || m.team === forWhom)));

export function NewTaskDialog({ open, preset, onClose, onCreated }: { open: boolean; preset?: NewTaskPreset; onClose: () => void; onCreated: (id: string) => void }) {
  const ws = useWs();
  const [f, setF] = useState<Required<Pick<TaskPatch, 'title' | 'forWhom' | 'category' | 'priority' | 'start' | 'due' | 'repeat' | 'notes' | 'assignees'>> & { workflowId: string }>(() => blank());
  function blank() {
    return { title: '', forWhom: 'MLA_S', category: 'Other', priority: '', start: '', due: '', repeat: '', notes: '', assignees: [] as string[], workflowId: '' };
  }
  useEffect(() => {
    if (!open) return;
    const b = { ...blank(), ...preset } as typeof f;
    if (!preset?.assignees && ws.me && !preset?.workflowId) b.assignees = [ws.me.id];
    setF(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const workflows = [...BUILTIN_WORKFLOWS, ...(ws.data?.workflows ?? [])];
  const wf = workflows.find((w) => w.id === f.workflowId);
  const create = useTaskMutation((b: TaskPatch & { title: string }) => tasksApi.create(b));

  const pickWorkflow = (id: string) => {
    const w = workflows.find((x) => x.id === id);
    setF((x) => ({
      ...x, workflowId: id,
      category: w?.category ?? x.category,
      priority: x.priority || (w?.priority ?? ''),
      due: x.due || (w?.dueInDays != null ? addDays(ws.today, Number(w.dueInDays)) : ''),
      assignees: id && ws.me && x.assignees.length === 1 && x.assignees[0] === ws.me.id ? [] : x.assignees,
    }));
  };

  const submit = () => {
    if (!f.title.trim()) return;
    create.mutate({ ...f, title: f.title.trim(), workflowId: f.workflowId || undefined }, {
      onSuccess: (t) => { onClose(); onCreated((t as { id: string }).id); },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New task</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField select label="Workflow" value={f.workflowId} onChange={(e) => pickWorkflow(e.target.value)}>
            <MenuItem value="">No workflow – simple task</MenuItem>
            {workflows.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          {wf && (
            <Alert severity="info" icon={false}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{wf.name}</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
                {wf.steps.map((s, i) => {
                  const who = s.role ? roleHolder(ws.members, s.role, f.forWhom) : undefined;
                  return (
                    <Box key={i} component="span" sx={{ fontSize: 13 }}>
                      {i ? '→ ' : ''}{s.text} {who ? <b>({who.name})</b> : <i>({s.role ? `no ${s.role} yet` : 'anyone'})</i>}
                    </Box>
                  );
                })}
                {wf.approval.required && (
                  <Box component="span" sx={{ fontSize: 13 }}>→ approval by <b>{roleHolder(ws.members, wf.approval.approverRole, f.forWhom)?.name ?? `(no ${wf.approval.approverRole} yet)`}</b></Box>
                )}
              </Stack>
            </Alert>
          )}
          <TextField autoFocus label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Kannada Rajyotsava poster" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="For" value={f.forWhom} onChange={(e) => set('forWhom', e.target.value)}>
                {TASK_FOR.map((x) => <MenuItem key={x.code} value={x.code}>{x.short}</MenuItem>)}
                <MenuItem value="">Office (general)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Type" value={f.category} onChange={(e) => set('category', e.target.value)}>
                {TASK_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                <MenuItem value="">—</MenuItem>
                {TASK_PRIORITIES.map((p) => <MenuItem key={p.code} value={p.code}>{p.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth type="date" label="Start" InputLabelProps={{ shrink: true }} value={f.start} onChange={(e) => set('start', e.target.value)} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth type="date" label="Due" InputLabelProps={{ shrink: true }} value={f.due} onChange={(e) => set('due', e.target.value)} /></Grid>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Repeat" SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} value={f.repeat} onChange={(e) => set('repeat', e.target.value)}>
                {TASK_REPEATS.map((r) => <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>People {wf ? '(workflow steps pick people by role; add more here)' : ''}</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
              {ws.active.map((m) => {
                const on = f.assignees.includes(m.id);
                return (
                  <Chip
                    key={m.id} avatar={<MemberAvatar m={m} size={22} />} label={<span>{m.name} <Typography component="span" variant="caption" sx={{ opacity: 0.75 }}>{m.role}</Typography></span>}
                    color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                    onClick={() => set('assignees', on ? f.assignees.filter((a) => a !== m.id) : [...f.assignees, m.id])}
                  />
                );
              })}
              {!ws.active.length && <Typography variant="body2" color="text.secondary">Add people on the Team tab first.</Typography>}
            </Stack>
          </Box>
          <TextField label="Notes" multiline minRows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Details, phone numbers, file links…" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!f.title.trim() || create.isPending}>Add task</Button>
      </DialogActions>
    </Dialog>
  );
}
