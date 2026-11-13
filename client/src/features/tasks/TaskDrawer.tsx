import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Divider, Drawer, FormControlLabel, IconButton, InputBase, LinearProgress, MenuItem,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { BUILTIN_WORKFLOWS, TASK_CATEGORIES, TASK_FOR, TASK_REPEATS, PERMISSIONS } from '@mla/shared';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  dueTone, fmtWhen, nextStep, taskText, tasksApi, useTaskMutation, useWs, type Step, type Task, type TaskPatch,
} from './tasksApi';
import { MemberAvatar, PeopleMenu, PriorityMenu, PriorityPill, StatusMenu, StatusPill, Tick } from './TaskBits';

function Field({ label, icon, children }: { label: string; icon?: string; children: ReactNode }) {
  return (
    <>
      <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 36 }}>
        {icon && <Icon name={icon} sx={{ fontSize: 16 }} />}{label}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minHeight: 36 }}>{children}</Stack>
    </>
  );
}
const sectionTitle = (t: string) => <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mt: 2.5, mb: 0.5 }}>{t}</Typography>;

export function TaskDrawer({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const ws = useWs();
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const ro = !can(PERMISSIONS.TASK_MANAGE);
  const t = id ? ws.task(id) : undefined;
  const [stAnchor, setStAnchor] = useState<HTMLElement | null>(null);
  const [prAnchor, setPrAnchor] = useState<HTMLElement | null>(null);
  const [pplAnchor, setPplAnchor] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [comment, setComment] = useState('');
  const [newStep, setNewStep] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => { setTitle(t?.title ?? ''); setNotes(t?.notes ?? ''); }, [t?.id, t?.title, t?.notes]);

  const patch = useTaskMutation((b: TaskPatch) => tasksApi.patch(id!, b));
  const post = useTaskMutation((text: string) => tasksApi.comment(id!, text));
  const remove = useTaskMutation(() => tasksApi.remove(id!), 'Task deleted');

  const open = !!id;
  const content = (() => {
    if (!t) return ws.isLoading ? <LinearProgress /> : <Box sx={{ p: 3 }}><Typography color="text.secondary">This task is not available (deleted, or not in your offices).</Typography></Box>;
    const steps = t.steps;
    const dn = steps.filter((s) => s.done).length;
    const cur = nextStep(t);
    const blockers = t.dependsOn.map((d) => ws.task(d)).filter(Boolean) as Task[];
    const pending = blockers.filter((b) => b.status !== 'DONE');
    const ap = t.approval;
    const setSteps = (fn: (s: Step[]) => Step[]) => patch.mutate({ steps: fn(steps.map((s) => ({ ...s }))) });
    const feed = [...t.updates].reverse();
    const tone = dueTone(t, ws.today);

    return (
      <>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <StatusPill status={t.status} height={32} onClick={ro ? undefined : (e) => setStAnchor(e.currentTarget)} />
          <PriorityPill priority={t.priority} height={32} onClick={ro ? undefined : (e) => setPrAnchor(e.currentTarget)} />
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Copy for WhatsApp">
            <IconButton onClick={() => navigator.clipboard?.writeText(taskText(t, ws.member, true)).then(() => enqueueSnackbar('Copied – paste it in WhatsApp', { variant: 'success' }))}><Icon name="ContentCopy" /></IconButton>
          </Tooltip>
          {!ro && (
            <Tooltip title="Delete">
              <IconButton onClick={async () => { if (await confirm({ title: 'Delete this task?', message: t.title, confirmLabel: 'Delete', destructive: true })) { remove.mutate(); onClose(); } }}><Icon name="Delete" /></IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose} aria-label="Close"><Icon name="Close" /></IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2, pb: 6 }}>
          <InputBase
            fullWidth multiline value={title} readOnly={ro} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { const v = title.trim(); if (v && v !== t.title) patch.mutate({ title: v }); }}
            sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', mb: 1.5, px: 1, mx: -1, borderRadius: 1.5, '&:hover': { bgcolor: ro ? undefined : 'action.hover' } }}
          />
          {!!pending.length && (
            <Alert severity="warning" icon={<Icon name="Lock" />} sx={{ mb: 1.5 }}>
              Waiting for: {pending.map((b, i) => <span key={b.id}>{i ? ', ' : ''}<Box component="a" href="#" onClick={(e) => { e.preventDefault(); onOpen(b.id); }} sx={{ fontWeight: 700 }}>{b.title}</Box></span>)}
            </Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' }, columnGap: 1.5, rowGap: 0.5, mb: 1 }}>
            <Field label="For">
              <TextField select size="small" value={t.forWhom} disabled={ro} onChange={(e) => patch.mutate({ forWhom: e.target.value })} sx={{ minWidth: 220 }}>
                {TASK_FOR.map((f) => <MenuItem key={f.code} value={f.code}>{f.name}</MenuItem>)}
                <MenuItem value="">Office (general)</MenuItem>
              </TextField>
            </Field>
            <Field label="People">
              {t.assignees.map((mid) => {
                const m = ws.member(mid);
                return (
                  <Chip key={mid} avatar={<MemberAvatar m={m} size={22} />} label={m?.name ?? 'Removed'} size="small"
                    onDelete={ro ? undefined : () => patch.mutate({ assignees: t.assignees.filter((a) => a !== mid) })} />
                );
              })}
              {!ro && <IconButton size="small" sx={{ border: '1px dashed', borderColor: 'divider' }} onClick={(e) => setPplAnchor(e.currentTarget)}><Icon name="Add" fontSize="small" /></IconButton>}
            </Field>
            <Field label="Type">
              <TextField select size="small" value={t.category} disabled={ro} onChange={(e) => patch.mutate({ category: e.target.value })} sx={{ minWidth: 220 }}>
                {TASK_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Dates">
              <TextField type="date" size="small" value={t.start} disabled={ro} onChange={(e) => patch.mutate({ start: e.target.value })} title="Start" />
              <Typography color="text.secondary">→</Typography>
              <TextField type="date" size="small" value={t.due} disabled={ro} onChange={(e) => patch.mutate({ due: e.target.value })} title="Due" />
              {tone && <Typography variant="caption" fontWeight={700} color={`${tone}.main`}>{tone === 'error' ? 'Overdue' : 'Today'}</Typography>}
            </Field>
            <Field label="Repeat" icon="Autorenew">
              <TextField select size="small" value={t.repeat} disabled={ro} SelectProps={{ displayEmpty: true }} onChange={(e) => patch.mutate({ repeat: e.target.value })} sx={{ minWidth: 180 }}>
                {TASK_REPEATS.map((r) => <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Labels" icon="Label">
              {t.labels.map((l) => <Chip key={l} size="small" label={l} onDelete={ro ? undefined : () => patch.mutate({ labels: t.labels.filter((x) => x !== l) })} />)}
              {!ro && (
                <TextField
                  size="small" placeholder="+ label, Enter" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} sx={{ width: 150 }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newLabel.trim()) { patch.mutate({ labels: [...new Set([...t.labels, newLabel.trim()])] }); setNewLabel(''); } }}
                />
              )}
            </Field>
            <Field label="Blocked by" icon="Lock">
              {blockers.map((b) => (
                <Chip key={b.id} size="small" label={b.title} onClick={() => onOpen(b.id)} sx={{ textDecoration: b.status === 'DONE' ? 'line-through' : 'none', maxWidth: 220 }}
                  onDelete={ro ? undefined : () => patch.mutate({ dependsOn: t.dependsOn.filter((d) => d !== b.id) })} />
              ))}
              {!ro && (
                <TextField select size="small" value="" label="+ another task" onChange={(e) => e.target.value && patch.mutate({ dependsOn: [...t.dependsOn, e.target.value] })} sx={{ minWidth: 180 }}>
                  {(ws.data?.tasks ?? []).filter((z) => z.id !== t.id && z.status !== 'DONE' && !t.dependsOn.includes(z.id)).slice(0, 200).map((z) => <MenuItem key={z.id} value={z.id}>{z.title}</MenuItem>)}
                </TextField>
              )}
            </Field>
          </Box>

          {sectionTitle('Approval')}
          <Stack
            direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap
            sx={{ p: 1.25, borderRadius: 2, border: 1, borderColor: ap.state === 'APPROVED' ? 'success.main' : ap.state === 'CHANGES' ? 'error.main' : 'divider', bgcolor: ap.state === 'APPROVED' ? 'rgba(5,150,105,.06)' : ap.state === 'CHANGES' ? 'rgba(220,38,38,.05)' : undefined }}
          >
            {!ro && <FormControlLabel control={<Checkbox size="small" checked={ap.required} onChange={(e) => patch.mutate({ approval: { required: e.target.checked } })} />} label="Needs approval" />}
            {ap.required ? (
              <>
                <Typography variant="caption" color="text.secondary">by</Typography>
                <TextField select size="small" value={ap.approver ?? ''} disabled={ro} onChange={(e) => patch.mutate({ approval: { approver: e.target.value || null } })} sx={{ minWidth: 200 }}>
                  <MenuItem value="">— choose —</MenuItem>
                  {ws.active.map((m) => <MenuItem key={m.id} value={m.id}>{m.name} – {m.role}</MenuItem>)}
                </TextField>
                <Chip size="small" label={ap.state === 'APPROVED' ? 'Approved' : ap.state === 'CHANGES' ? 'Changes requested' : 'Not yet approved'} color={ap.state === 'APPROVED' ? 'success' : ap.state === 'CHANGES' ? 'error' : 'default'} />
                {!ro && ap.state !== 'APPROVED' && (
                  <>
                    <Box sx={{ flex: 1 }} />
                    <Button size="small" variant="outlined" color="success" startIcon={<Icon name="Check" />} onClick={() => patch.mutate({ approval: { state: 'APPROVED' } })}>Approve</Button>
                    <Button size="small" color="error" onClick={() => patch.mutate({ approval: { state: 'CHANGES' } })}>Request changes</Button>
                  </>
                )}
              </>
            ) : ro ? <Typography variant="body2" color="text.secondary">Not needed</Typography> : null}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5}>
            {sectionTitle(`Steps${steps.length ? ` · ${dn}/${steps.length}` : ''}`)}
            {!!steps.length && <LinearProgress variant="determinate" value={(dn / steps.length) * 100} color="success" sx={{ width: 120, mt: 2, height: 6, borderRadius: 3, bgcolor: 'action.hover' }} />}
          </Stack>
          {steps.map((s, i) => (
            <Stack
              key={s.id} direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }}
              sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: cur?.id === s.id ? 'rgba(201,151,0,.07)' : undefined, px: 0.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <Tick on={s.done} disabled={ro} onClick={() => setSteps((ss) => ss.map((z, j) => (j === i ? { ...z, done: !z.done } : z)))} />
                <InputBase
                  key={`${s.id}:${s.text}`} defaultValue={s.text} readOnly={ro} fullWidth
                  onBlur={(e) => { if (e.target.value !== s.text) setSteps((ss) => ss.map((z, j) => (j === i ? { ...z, text: e.target.value } : z))); }}
                  sx={{ textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'text.secondary' : 'text.primary' }}
                />
              </Stack>
              <TextField select size="small" value={s.assignee ?? ''} disabled={ro} onChange={(e) => setSteps((ss) => ss.map((z, j) => (j === i ? { ...z, assignee: e.target.value || null } : z)))} sx={{ minWidth: 150 }}>
                <MenuItem value="">{s.role || '— who —'}</MenuItem>
                {ws.active.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
              </TextField>
              <TextField type="date" size="small" value={s.due} disabled={ro} onChange={(e) => setSteps((ss) => ss.map((z, j) => (j === i ? { ...z, due: e.target.value } : z)))} sx={{ width: 150 }} />
              {!ro && <IconButton size="small" onClick={() => setSteps((ss) => ss.filter((_z, j) => j !== i))}><Icon name="Close" fontSize="small" /></IconButton>}
            </Stack>
          ))}
          {!ro && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small" fullWidth placeholder="+ Add a step and press Enter" value={newStep} onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newStep.trim()) { patch.mutate({ steps: [...steps, { text: newStep.trim(), role: '', assignee: null, done: false, due: '' }] }); setNewStep(''); } }}
              />
              {!steps.length && (
                <TextField select size="small" value="" label="Use a workflow…" onChange={(e) => e.target.value && patch.mutate({ workflowId: e.target.value })} sx={{ minWidth: 200 }}>
                  {[...BUILTIN_WORKFLOWS, ...(ws.data?.workflows ?? [])].map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                </TextField>
              )}
            </Stack>
          )}

          {sectionTitle('Notes')}
          <TextField
            fullWidth multiline minRows={3} value={notes} disabled={ro} placeholder="Details, phone numbers, file links…"
            onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== t.notes) patch.mutate({ notes }); }}
          />

          {sectionTitle('Updates')}
          {!ro && (
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth multiline maxRows={6} size="small" value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Write an update… use @name to notify someone (Ctrl+Enter to post)"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && comment.trim()) { post.mutate(comment.trim()); setComment(''); } }}
              />
              <Button variant="contained" disabled={!comment.trim() || post.isPending} onClick={() => { post.mutate(comment.trim()); setComment(''); }} sx={{ minWidth: 0, px: 1.5 }}><Icon name="Send" fontSize="small" /></Button>
            </Stack>
          )}
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {feed.map((u) => {
              const w = ws.member(u.who);
              const who = w?.name || u.byName;
              const notified = u.notify.map((n) => ws.member(n)?.name).filter(Boolean).join(', ');
              return (
                <Stack key={u.id || `${u.at}${u.text}`} direction="row" spacing={1}>
                  {u.kind === 'comment' && <MemberAvatar m={w} size={28} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={u.kind === 'comment'
                        ? { bgcolor: 'action.hover', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
                        : u.kind === 'auto'
                          ? { bgcolor: 'rgba(201,151,0,.08)', border: 1, borderColor: 'rgba(201,151,0,.25)', borderRadius: 2, px: 1.5, py: 0.75 }
                          : { color: 'text.secondary', py: 0.25 }}
                    >
                      {u.kind === 'comment' && <Typography variant="body2" fontWeight={700}>{who || 'Someone'}</Typography>}
                      <Typography variant="body2" component="div">{u.text}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {u.kind !== 'comment' && who ? `${who} · ` : ''}{fmtWhen(u.at)}{notified ? ` · notified ${notified}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">Created {fmtWhen(t.createdAt)}</Typography>
        </Box>

        <StatusMenu anchor={stAnchor} onClose={() => setStAnchor(null)} onPick={(s) => patch.mutate({ status: s })} />
        <PriorityMenu anchor={prAnchor} onClose={() => setPrAnchor(null)} onPick={(p) => patch.mutate({ priority: p })} />
        <PeopleMenu
          anchor={pplAnchor} onClose={() => setPplAnchor(null)} members={ws.members} selected={t.assignees}
          onPick={(m) => patch.mutate({ assignees: t.assignees.includes(m) ? t.assignees.filter((a) => a !== m) : [...t.assignees, m] })}
        />
      </>
    );
  })();

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: (th) => th.zIndex.drawer + 2 }} PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, display: 'flex', flexDirection: 'column' } }}>
        {open && content}
      </Drawer>
      {dialog}
    </>
  );
}
