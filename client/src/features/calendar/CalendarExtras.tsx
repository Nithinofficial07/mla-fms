import { useEffect, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  List, ListItemButton, ListItemText, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { CALENDAR_CODES, CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_TYPES, CALENDAR_REAL_CODES, PERMISSIONS, calendarTypeMeta } from '@mla/shared';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { downloadViaApi } from '@/lib/download';
import {
  createQuickEvent, fetchChangeLog, fetchMonthlySummary, fetchPhoto, fetchReferenceData, fetchWhatsappText, fetchWorkLists,
  importBackup, importGoogleIcs, markAway, uploadPhoto, type WorkLists,
} from './calendarApi';
import { CalendarsField, useDefaultCalendars } from './CalendarsField';
import { timeLabel, type CalendarItem } from './calendarUtils';

/* ------------------------------- quick event ------------------------------ */
export function QuickEventDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const defaultCalendars = useDefaultCalendars();
  const [members, setMembers] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>(CALENDAR_DEFAULT_TYPE);
  const [dateUnknown, setDateUnknown] = useState(false);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [time, setTime] = useState(dayjs().add(1, 'hour').format('HH:mm'));
  const [venue, setVenue] = useState('');

  useEffect(() => {
    if (!open) return;
    setMembers(defaultCalendars);
    setTitle(''); setType(CALENDAR_DEFAULT_TYPE); setDateUnknown(false);
    setDate(dayjs().format('YYYY-MM-DD')); setTime(dayjs().add(1, 'hour').format('HH:mm')); setVenue('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () => createQuickEvent({
      members, title: title.trim(), type, dateUnknown,
      start: dateUnknown ? undefined : dayjs(`${date}T${time}`).toISOString(),
      venue: venue.trim() || undefined,
    }),
    onSuccess: () => {
      enqueueSnackbar('Added - fill in the rest whenever you can', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Quick event</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">Just hold the slot - you can fill in the rest later.</Typography>
          <CalendarsField value={members} onChange={setMembers} label="Calendar(s)" size="small" />
          <TextField autoFocus fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField select fullWidth size="small" label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {CALENDAR_EVENT_TYPES.map((t) => <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>)}
          </TextField>
          <FormControlLabel control={<Switch checked={dateUnknown} onChange={(e) => setDateUnknown(e.target.checked)} />} label="Don't know the date yet" />
          {!dateUnknown && (
            <Stack direction="row" spacing={1}>
              <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} fullWidth />
              <TextField type="time" size="small" label="Time" InputLabelProps={{ shrink: true }} value={time} onChange={(e) => setTime(e.target.value)} fullWidth />
            </Stack>
          )}
          <TextField fullWidth size="small" label="Venue (optional)" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!title.trim() || !members.length || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Adding…' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------------------------- away ----------------------------------- */
export function AwayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const defaultCalendars = useDefaultCalendars();
  const [members, setMembers] = useState<string[]>([]);
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [reason, setReason] = useState('');
  const { data: ref } = useQuery({ queryKey: ['calendar', 'reference'], queryFn: fetchReferenceData, staleTime: 60 * 60 * 1000 });

  useEffect(() => {
    if (!open) return;
    setMembers(defaultCalendars.filter((c) => (CALENDAR_REAL_CODES as readonly string[]).includes(c)));
    setFrom(dayjs().format('YYYY-MM-DD')); setTo(dayjs().format('YYYY-MM-DD')); setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () => markAway({
      members, start: dayjs(from).startOf('day').toISOString(), end: dayjs(to).endOf('day').toISOString(), reason: reason.trim() || undefined,
    }),
    onSuccess: () => { enqueueSnackbar('Marked away', { variant: 'success' }); qc.invalidateQueries({ queryKey: ['calendar'] }); onClose(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mark away / unavailable</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <CalendarsField value={members} onChange={setMembers} label="Who" size="small" />
          <Stack direction="row" spacing={1}>
            <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} fullWidth />
            <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} fullWidth />
          </Stack>
          {!!ref?.awayPresets?.length && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {ref.awayPresets.map((p) => (
                <Button key={p.code} size="small" variant="outlined" onClick={() => setReason(p.label)}>{p.label}</Button>
              ))}
            </Stack>
          )}
          <TextField fullWidth size="small" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button variant="contained" color="warning" disabled={!members.length || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Mark away'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------------------- import from google ---------------------------- */
export function ImportGoogleCalendarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const defaultCalendars = useDefaultCalendars();
  const fileRef = useRef<HTMLInputElement>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [type, setType] = useState<string>(CALENDAR_DEFAULT_TYPE);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMembers(defaultCalendars);
    setResult(null);
  }, [open, defaultCalendars]);

  const importMut = useMutation({
    mutationFn: (file: File) => importGoogleIcs(members, file, type),
    onSuccess: (r) => { setResult(r); enqueueSnackbar('Import finished', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import from Google Calendar</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
            <Typography component="li" variant="body2" color="text.secondary">
              On a computer, open Google Calendar and go to Settings (the gear icon).
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Under "Import &amp; export", click <b>Export</b>. This downloads a .zip file.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Unzip it - inside is one .ics file per calendar. Pick the one for the calendar you want to bring in.
            </Typography>
          </Box>
          <CalendarsField value={members} onChange={setMembers} label="Add these events to" size="small" />
          <TextField select fullWidth size="small" label="Import as type" value={type} onChange={(e) => setType(e.target.value)} helperText="You can re-sort individual events afterwards.">
            {CALENDAR_EVENT_TYPES.map((t) => <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>)}
          </TextField>
          <Button variant="outlined" startIcon={<Icon name="UploadFile" />} onClick={() => fileRef.current?.click()} disabled={!members.length || importMut.isPending}>
            {importMut.isPending ? 'Importing…' : 'Choose .ics file'}
          </Button>
          <input ref={fileRef} type="file" hidden accept=".ics" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
          {result && (
            <Alert severity={result.errors.length ? 'warning' : 'success'}>
              {result.created} added, {result.updated} already there (updated), {result.skipped} skipped.
              {!!result.errors.length && ` ${result.errors.length} error(s): ${result.errors.slice(0, 3).join('; ')}`}
              {' '}Repeating events came in as separate one-off entries, not a single series - edit any of them if you'd like it to repeat going forward.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

/* -------------------------------- work lists -------------------------------- */
const LIST_META: { key: keyof WorkLists; label: string; icon: string; empty: string }[] = [
  { key: 'toDecide', label: 'To decide (RSVP)', icon: 'HelpOutline', empty: 'Nothing waiting on an RSVP.' },
  { key: 'organisersNotReplied', label: 'Organisers not replied', icon: 'MarkEmailRead', empty: 'Every organiser has replied.' },
  { key: 'toCheck', label: 'To check (preparation)', icon: 'Checklist', empty: 'Preparation is up to date.' },
  { key: 'toFill', label: 'To fill in (quick events)', icon: 'EditNote', empty: 'No quick events waiting for details.' },
  { key: 'toPost', label: 'To post (social media)', icon: 'ContentCopy', empty: 'Nothing waiting to be posted.' },
  { key: 'comingUp', label: 'Coming up', icon: 'Event', empty: 'Nothing in the next 3 weeks.' },
];

function ItemRow({ item, onClick }: { item: CalendarItem; onClick: () => void }) {
  const color = calendarTypeMeta(item.type).color;
  return (
    <ListItemButton onClick={onClick} sx={{ borderRadius: 1.5, px: 1 }}>
      <Box sx={{ width: 4, height: 28, borderRadius: 2, bgcolor: color, mr: 1.25, flexShrink: 0 }} />
      <ListItemText
        primary={item.title}
        secondary={item.dateUnknown ? 'Date not set' : `${dayjs(item.start).format('D MMM')} · ${timeLabel(item)}`}
        primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
    </ListItemButton>
  );
}

export function WorkListsDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (item: CalendarItem) => void }) {
  const [tab, setTab] = useState(0);
  const { data, isLoading } = useQuery({ queryKey: ['calendar', 'worklists'], queryFn: fetchWorkLists, enabled: open });
  const meta = LIST_META[tab];
  const list = data?.[meta.key] ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Work lists</DialogTitle>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        {LIST_META.map((m, i) => <Tab key={m.key} label={`${m.label}${data ? ` (${data[m.key].length})` : ''}`} value={i} />)}
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {isLoading && <Typography color="text.secondary">Loading…</Typography>}
        {!isLoading && !list.length && <Typography color="text.secondary">{meta.empty}</Typography>}
        <List dense>
          {list.map((it) => <ItemRow key={it.id} item={it} onClick={() => { onSelect(it); onClose(); }} />)}
        </List>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

/* --------------------------------- reports ---------------------------------- */
export function ReportsDialog({ open, onClose, filters }: { open: boolean; onClose: () => void; filters: { types?: string; members?: string } }) {
  const { enqueueSnackbar } = useSnackbar();
  const { can } = useAuth();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const summary = useQuery({ queryKey: ['calendar', 'summary', month], queryFn: () => fetchMonthlySummary(month), enabled: open });
  const changes = useQuery({ queryKey: ['calendar', 'changes'], queryFn: () => fetchChangeLog({ limit: 20 }), enabled: open });
  const canAdmin = can(PERMISSIONS.CALENDAR_ADMIN);

  const copyWhatsapp = async () => {
    try {
      const from = dayjs().startOf('day').toISOString();
      const to = dayjs().add(7, 'day').toISOString();
      const text = await fetchWhatsappText({ from, to, ...filters });
      await navigator.clipboard.writeText(text);
      enqueueSnackbar('Copied next 7 days to clipboard', { variant: 'success' });
    } catch (e) { enqueueSnackbar(errorMessage(e), { variant: 'error' }); }
  };
  const download = (format: 'ics' | 'csv' | 'xlsx') => {
    const from = dayjs().subtract(1, 'month').toISOString();
    const to = dayjs().add(2, 'month').toISOString();
    downloadViaApi('/calendar/export', { format, from, to, ...filters } as Record<string, string>, `calendar.${format}`);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reports &amp; export</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Monthly summary</Typography>
            <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ mb: 1.5 }} />
            {summary.data && (
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                <Typography variant="body2">Total events: <b>{summary.data.total}</b></Typography>
                <Typography variant="body2">Going: <b>{summary.data.rsvp?.going ?? 0}</b></Typography>
                <Typography variant="body2">Not going: <b>{summary.data.rsvp?.notGoing ?? 0}</b></Typography>
                <Typography variant="body2">Attended: <b>{summary.data.attendance?.attended ?? 0}</b></Typography>
              </Stack>
            )}
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Export</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" startIcon={<Icon name="Download" />} onClick={() => download('ics')}>.ics</Button>
              <Button size="small" variant="outlined" startIcon={<Icon name="Download" />} onClick={() => download('xlsx')}>Excel</Button>
              <Button size="small" variant="outlined" startIcon={<Icon name="ContentCopy" />} onClick={copyWhatsapp}>Copy WhatsApp (7 days)</Button>
              {canAdmin && (
                <Button size="small" variant="outlined" color="secondary" startIcon={<Icon name="CloudDone" />} onClick={() => downloadViaApi('/calendar/backup', undefined, 'calendar-backup.json')}>
                  Full backup (admin)
                </Button>
              )}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent changes</Typography>
            <Stack spacing={0.5}>
              {(changes.data ?? []).map((c) => (
                <Typography key={c.id} variant="caption" color="text.secondary">
                  {dayjs(c.at).format('D MMM, h:mm A')} · <b>{c.byName}</b> {c.action} "{c.title}"{c.detail.length ? ` — ${c.detail.join('; ')}` : ''}
                </Typography>
              ))}
              {!changes.data?.length && <Typography variant="body2" color="text.secondary">No changes logged yet.</Typography>}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

/* --------------------------------- admin ------------------------------------ */
function PhotoRow({ code, label }: { code: string; label: string }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ['calendar', 'photo', code], queryFn: () => fetchPhoto(code) });
  const upload = useMutation({
    mutationFn: (file: File) => uploadPhoto(code, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar', 'photo', code] }); enqueueSnackbar('Photo updated', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Avatar src={data?.url ?? undefined} sx={{ width: 40, height: 40 }}>{label[0]}</Avatar>
      <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
      <Button size="small" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>Change</Button>
      <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
    </Stack>
  );
}

export function AdminCalendarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const events = Array.isArray(parsed) ? parsed : parsed.events ?? [];
      return importBackup(events);
    },
    onSuccess: (r) => { setResult(r); enqueueSnackbar('Import finished', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Calendar admin</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Calendar photos</Typography>
            <Stack spacing={1.5}>
              {CALENDAR_CODES.map((c) => <PhotoRow key={c.code} code={c.code} label={c.title} />)}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Import calendar backup</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Loads a backup JSON file (from the old calendar, or from this one). Safe to run twice - events already
              imported are updated in place rather than duplicated.
            </Typography>
            <Button variant="outlined" startIcon={<Icon name="UploadFile" />} onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
              {importMut.isPending ? 'Importing…' : 'Choose backup file'}
            </Button>
            <input ref={fileRef} type="file" hidden accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
            {result && (
              <Alert severity={result.errors.length ? 'warning' : 'success'} sx={{ mt: 1.5 }}>
                {result.created} created, {result.updated} updated, {result.skipped} skipped.
                {!!result.errors.length && ` ${result.errors.length} error(s): ${result.errors.slice(0, 3).join('; ')}`}
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
