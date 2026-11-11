import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete, Box, Button, ButtonBase, Card, CardContent, Chip, CircularProgress, Dialog, DialogContent, Divider, IconButton,
  InputAdornment, LinearProgress, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CALENDAR_CODES, CALENDAR_REAL_CODES, CALENDAR_ROLE_AT_EVENT, CALENDAR_SOCIAL_PLATFORMS, PERMISSIONS, calendarTypeMeta,
} from '@mla/shared';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { downloadViaApi } from '@/lib/download';
import {
  documentsForEvent, fetchChangeLog, fetchMonthlySummary, fetchWhatsappText, searchEvents, setAttendance, setReply, setRsvp, setSocial,
  uploadEventDocument,
} from './calendarApi';
import { AttendanceMark, MemberBadges, itemColor } from './CalendarViews';
import { CalendarAvatar } from './CalendarAvatar';
import { useMyCalendarCodes } from './CalendarsField';
import { useCalendarReference } from './useCalendarReference';
import { rsvpOf, timeLabel, type AttendanceEntry, type CalendarItem } from './calendarUtils';

const codeMeta = (code: string) => CALENDAR_CODES.find((c) => c.code === code);
const eventIdOf = (i: CalendarItem) => i.eventId ?? i.id.split(':')[0].split('@')[0];
const dateLine = (i: CalendarItem) => (i.dateUnknown ? 'Date not set' : `${dayjs(i.start).format('ddd D MMM')} · ${timeLabel(i)}`);

/** Calendars of this event the signed-in user may act for. */
function useActableCodes(item: CalendarItem) {
  const { codes, viewAll } = useMyCalendarCodes();
  return viewAll ? item.members : item.members.filter((m) => codes.includes(m));
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['calendar'] });
}

/* ------------------------------ attendance -------------------------------- */
export const ATTENDANCE_META: Record<AttendanceEntry['status'], { label: string; icon: string; color: string }> = {
  ATTENDED: { label: 'Attended', icon: 'CheckCircle', color: '#2E7D32' },
  REPRESENTATIVE: { label: 'Representative', icon: 'Group', color: '#ED6C02' },
  NOT_ATTENDED: { label: 'Did not attend', icon: 'Cancel', color: '#D32F2F' },
};

function AttendanceForCode({ item, code, disabled }: { item: CalendarItem; code: string; disabled?: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = useInvalidate();
  const saved = item.attendance?.[code];
  const [status, setStatus] = useState<AttendanceEntry['status'] | ''>(saved?.status ?? '');
  const [who, setWho] = useState<string[]>(saved?.members ?? []);
  const [note, setNote] = useState(saved?.note ?? '');
  useEffect(() => { setStatus(saved?.status ?? ''); setWho(saved?.members ?? []); setNote(saved?.note ?? ''); }, [saved?.status, saved?.note, (saved?.members ?? []).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: { status: string | null; members?: string[]; note?: string }) => setAttendance(eventIdOf(item), { code, ...body }),
    onSuccess: (_d, v) => { invalidate(); enqueueSnackbar(v.status ? 'Attendance saved' : 'Attendance cleared', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const dirty = status !== (saved?.status ?? '') || note !== (saved?.note ?? '') || who.join('|') !== (saved?.members ?? []).join('|');
  const c = codeMeta(code);

  return (
    <Stack spacing={1} sx={{ p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <CalendarAvatar code={code} size={24} />
        <Typography variant="body2" fontWeight={700} sx={{ color: c?.color, minWidth: 64 }}>{c?.title ?? code}</Typography>
        <ToggleButtonGroup
          size="small" exclusive value={status} disabled={disabled}
          onChange={(_e, v) => {
            if (!v) return;
            setStatus(v);
            // NOT_ATTENDED needs nothing else - save straight away.
            if (v === 'NOT_ATTENDED') save.mutate({ status: v, members: [], note });
          }}
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, textTransform: 'none', fontSize: 12, fontWeight: 700, gap: 0.5 } }}
        >
          {(Object.keys(ATTENDANCE_META) as AttendanceEntry['status'][]).map((s) => (
            <ToggleButton
              key={s} value={s}
              sx={{ '&.Mui-selected': { color: '#fff', bgcolor: `${ATTENDANCE_META[s].color} !important` } }}
            >
              <Icon name={ATTENDANCE_META[s].icon} sx={{ fontSize: 15 }} />{ATTENDANCE_META[s].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {saved && !disabled && (
          <Button size="small" color="inherit" onClick={() => save.mutate({ status: null })} disabled={save.isPending}>Clear</Button>
        )}
      </Stack>
      {(status === 'ATTENDED' || status === 'REPRESENTATIVE') && (
        <>
          <Autocomplete
            multiple freeSolo size="small" disabled={disabled}
            options={item.attendees ?? []} value={who}
            onChange={(_e, v) => setWho(v.map(String).map((s) => s.trim()).filter(Boolean))}
            renderTags={(v, getTagProps) => v.map((o, i) => <Chip size="small" label={o} {...getTagProps({ index: i })} key={o} />)}
            renderInput={(p) => <TextField {...p} label={status === 'REPRESENTATIVE' ? 'Who went on their behalf?' : 'Who went with them?'} placeholder="Type a name, press Enter" />}
          />
          <TextField size="small" label="Note" value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} multiline maxRows={4} />
        </>
      )}
      {dirty && status && status !== 'NOT_ATTENDED' && (
        <Button
          size="small" variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={save.isPending}
          onClick={() => save.mutate({ status, members: who, note })}
        >
          Save attendance
        </Button>
      )}
    </Stack>
  );
}

/** Per-calendar "did they go?" marking - the details dialog and the To check list. */
export function AttendanceEditor({ item }: { item: CalendarItem }) {
  const { can } = useAuth();
  const mine = useActableCodes(item);
  // Only the calendars that were going (or already marked) need a mark.
  const codes = mine.filter((m) => rsvpOf(item, m) === 'GOING' || item.attendance?.[m]);
  const list = codes.length ? codes : mine;
  if (!list.length) return null;
  return (
    <Stack spacing={1}>
      {list.map((code) => <AttendanceForCode key={code} item={item} code={code} disabled={!can(PERMISSIONS.CALENDAR_MANAGE)} />)}
    </Stack>
  );
}

/* -------------------------------- photos ---------------------------------- */
interface DocRow { id: string; documentType: string; versions: { fileName: string; mimeType?: string }[] }
const isImage = (d: DocRow) => /\.(jpe?g|png|webp|gif|heic)$/i.test(d.versions[0]?.fileName ?? '') || (d.versions[0]?.mimeType ?? '').startsWith('image/');

function Thumb({ id, size }: { id: string; size: number }) {
  const { data } = useQuery({ queryKey: ['documents', 'url', id], queryFn: () => api.get(`/documents/${id}/url`).then((r) => r.data as { url: string }), staleTime: 5 * 60_000 });
  return (
    <ButtonBase onClick={() => data?.url && window.open(data.url, '_blank')} sx={{ width: size, height: size, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0 }}>
      {data?.url ? <Box component="img" src={data.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <CircularProgress size={16} />}
    </ButtonBase>
  );
}

/** Event photos (attachments labelled Photo / Event photo) with a camera upload button. */
export function EventPhotos({ eventId, size = 72 }: { eventId: string; size?: number }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ['calendar', 'documents', eventId], queryFn: () => documentsForEvent(eventId) as Promise<DocRow[]> });
  const photos = (data ?? []).filter((d) => (d.documentType === 'Event photo' || d.documentType === 'Photo') && isImage(d));
  const upload = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map((f) => uploadEventDocument(eventId, f, 'Event photo'))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar', 'documents', eventId] }); enqueueSnackbar('Photo added', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const canUpload = can(PERMISSIONS.DOCUMENT_UPLOAD);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5 }}>
      {photos.map((p) => <Thumb key={p.id} id={p.id} size={size} />)}
      {canUpload && (
        <ButtonBase
          onClick={() => fileRef.current?.click()} disabled={upload.isPending}
          sx={{ width: size, height: size, borderRadius: 1.5, border: '1.5px dashed', borderColor: 'divider', flexDirection: 'column', gap: 0.25, color: 'text.secondary', flexShrink: 0 }}
        >
          {upload.isPending ? <CircularProgress size={18} /> : <Icon name="PhotoCamera" />}
          <Typography variant="caption" sx={{ fontSize: 10.5 }}>Add photo</Typography>
        </ButtonBase>
      )}
      {!photos.length && !canUpload && <Typography variant="caption" color="text.secondary">No photos.</Typography>}
      <input
        ref={fileRef} type="file" hidden multiple accept="image/*"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) upload.mutate(f); e.target.value = ''; }}
      />
    </Stack>
  );
}

/* ------------------------------- list rows -------------------------------- */
function ItemHeader({ item, onOpen }: { item: CalendarItem; onOpen?: (i: CalendarItem) => void }) {
  const { tCal } = useCalendarReference();
  return (
    <ButtonBase onClick={() => onOpen?.(item)} sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1.25, width: '100%', borderRadius: 1.5 }}>
      <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: itemColor(item), flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <MemberBadges item={item} size="md" />
          <Typography variant="body2" fontWeight={700} noWrap>{item.title}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {[dateLine(item), item.venue, item.area, tCal(calendarTypeMeta(item.type).label)].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

const RSVP_CHOICES = [
  { code: 'GOING', label: 'Going', color: '#2E7D32' },
  { code: 'UNDECIDED', label: 'Not decided', color: '#F59E0B' },
  { code: 'NOT_GOING', label: 'Not going', color: '#D32F2F' },
] as const;

/** Per-calendar going / not going buttons. */
export function RsvpButtons({ item, codes, disabled }: { item: CalendarItem; codes: string[]; disabled?: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: ({ code, status }: { code: string; status: string }) => setRsvp(eventIdOf(item), code, status),
    onSuccess: invalidate,
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  return (
    <Stack spacing={0.75}>
      {codes.map((code) => {
        const cur = rsvpOf(item, code);
        const c = codeMeta(code);
        return (
          <Stack key={code} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <CalendarAvatar code={code} size={24} />
            <Typography variant="body2" fontWeight={700} sx={{ color: c?.color, minWidth: 64 }}>{c?.title ?? code}</Typography>
            <ToggleButtonGroup
              size="small" exclusive value={cur} disabled={disabled || m.isPending}
              onChange={(_e, v) => v && v !== cur && m.mutate({ code, status: v })}
              sx={{ '& .MuiToggleButton-root': { py: 0.2, px: 1.1, textTransform: 'none', fontSize: 12, fontWeight: 700 } }}
            >
              {RSVP_CHOICES.map((o) => (
                <ToggleButton key={o.code} value={o.code} sx={{ '&.Mui-selected': { color: '#fff', bgcolor: `${o.color} !important` } }}>{o.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        );
      })}
    </Stack>
  );
}

export function ReplySelect({ item, disabled }: { item: CalendarItem; disabled?: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: (v: string) => setReply(eventIdOf(item), v),
    onSuccess: invalidate,
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  return (
    <ToggleButtonGroup
      size="small" exclusive value={item.reply ?? 'PENDING'} disabled={disabled || m.isPending}
      onChange={(_e, v) => v && m.mutate(v)}
      sx={{ '& .MuiToggleButton-root': { py: 0.2, px: 1.1, textTransform: 'none', fontSize: 12, fontWeight: 700 } }}
    >
      <ToggleButton value="PENDING">Not replied</ToggleButton>
      <ToggleButton value="CONFIRMED" sx={{ '&.Mui-selected': { color: '#fff', bgcolor: '#2E7D32 !important' } }}>Told: coming</ToggleButton>
      <ToggleButton value="REGRET" sx={{ '&.Mui-selected': { color: '#fff', bgcolor: '#D32F2F !important' } }}>Told: regret</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function DecideRow({ item, onOpen }: { item: CalendarItem; onOpen?: (i: CalendarItem) => void }) {
  const { can } = useAuth();
  const codes = useActableCodes(item);
  const canManage = can(PERMISSIONS.CALENDAR_MANAGE);
  return (
    <Stack spacing={1} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <ItemHeader item={item} onOpen={onOpen} />
      <RsvpButtons item={item} codes={codes} disabled={!canManage} />
      {item.organizer && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>Reply to {item.organizer}:</Typography>
          <ReplySelect item={item} disabled={!canManage} />
        </Stack>
      )}
    </Stack>
  );
}

export function CheckRow({ item, onOpen }: { item: CalendarItem; onOpen?: (i: CalendarItem) => void }) {
  return (
    <Stack spacing={1} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <ItemHeader item={item} onOpen={onOpen} />
      <AttendanceEditor item={item} />
      <EventPhotos eventId={eventIdOf(item)} size={56} />
    </Stack>
  );
}

/* --------------------------------- search --------------------------------- */
export function SearchDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (i: CalendarItem) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const res = useQuery({ queryKey: ['calendar', 'search', debounced], queryFn: () => searchEvents(debounced), enabled: open && debounced.length >= 2 });
  const now = dayjs();
  const list = res.data ?? [];
  const firstPast = list.findIndex((i) => dayjs(i.start).isBefore(now, 'day'));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { alignSelf: 'flex-start', mt: { xs: 2, sm: 8 } } }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <TextField
          autoFocus fullWidth value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, venue, ward, organiser, contact or phone"
          InputProps={{
            startAdornment: <InputAdornment position="start"><Icon name="Search" /></InputAdornment>,
            endAdornment: res.isFetching ? <CircularProgress size={18} /> : q ? <IconButton size="small" onClick={() => setQ('')}><Icon name="Close" fontSize="small" /></IconButton> : null,
          }}
        />
      </Box>
      <DialogContent sx={{ pt: 0, minHeight: 200 }}>
        {debounced.length < 2 && <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Type at least 2 letters. Phone numbers match on digits.</Typography>}
        {debounced.length >= 2 && res.isSuccess && !list.length && (
          <Stack alignItems="center" sx={{ py: 4, color: 'text.secondary' }}><Icon name="SearchOff" sx={{ fontSize: 40, opacity: 0.5 }} /><Typography variant="body2">No events match "{debounced}".</Typography></Stack>
        )}
        <Stack spacing={0.5}>
          {list.map((it, idx) => (
            <Box key={it.id}>
              {idx === 0 && firstPast !== 0 && <Typography variant="overline" color="text.secondary">Upcoming</Typography>}
              {idx === firstPast && <Typography variant="overline" color="text.secondary" component="div" sx={{ mt: 1 }}>Past</Typography>}
              <ButtonBase
                onClick={() => { onSelect(it); onClose(); }}
                sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', gap: 1.25, p: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Box sx={{ width: 46, flexShrink: 0, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.1 }}>{dayjs(it.start).format('MMM')}</Typography>
                  <Typography variant="h6" sx={{ lineHeight: 1.1, fontWeight: 800 }}>{dayjs(it.start).format('D')}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.1, fontSize: 10 }}>{dayjs(it.start).format('YYYY')}</Typography>
                </Box>
                <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: itemColor(it), flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    <MemberBadges item={it} />
                    <AttendanceMark item={it} />
                    <Typography variant="body2" fontWeight={700} noWrap>{it.title}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {[timeLabel(it), it.venue, it.area, it.organizer, it.contactName && `${it.contactName}${it.contactPhone ? ` ${it.contactPhone}` : ''}`].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ social media ------------------------------ */
function fetchRange(from: Dayjs, to: Dayjs) {
  return api.get('/calendar/events', {
    params: { from: from.toISOString(), to: to.toISOString(), members: CALENDAR_REAL_CODES.join(','), includeDeadlines: 'false' },
  }).then((r) => (r.data as CalendarItem[]).filter((i) => i.kind === 'event'));
}

const ROLE_WORDS: Record<string, string> = {
  CHIEF_GUEST: 'as Chief Guest', INAUGURATOR: 'and inaugurated the programme', GUEST_OF_HONOUR: 'as Guest of Honour',
  PRESIDING: 'and presided over the programme', SPEAKER: 'and addressed the gathering', GUEST: '',
};

/** A few caption shapes; "Suggest again" walks through them. */
function suggestCaption(item: CalendarItem, n: number): string {
  const who = item.members.filter((m) => {
    const a = item.attendance?.[m];
    return a?.status === 'ATTENDED';
  }).map((m) => codeMeta(m)?.title).filter(Boolean).join(', ') || 'We';
  const place = [item.venue, item.area].filter(Boolean).join(', ');
  const at = place ? ` at ${place}` : '';
  const when = dayjs(item.start).format('D MMMM');
  const role = item.role && ROLE_WORDS[item.role] ? ` ${ROLE_WORDS[item.role]}` : '';
  const org = item.organizer ? ` organised by ${item.organizer}` : '';
  const options = [
    `${who} took part in ${item.title}${at}${role} on ${when}.${org ? ` Thanks to everyone${org.replace(' organised', ' who organised')}.` : ''}`,
    `Glad to be part of ${item.title}${at} today${role}. Thank you for the warm welcome!`,
    `${item.title}${org}${at}, ${when}. ${who === 'We' ? 'It was' : `${who}:`} a pleasure to meet everyone.`,
    `Highlights from ${item.title}${at}. ${item.writeup ?? ''}`.trim(),
  ];
  return options[n % options.length].replace(/\s+/g, ' ').trim();
}

function ToPostCard({ item, onOpen }: { item: CalendarItem; onOpen: (i: CalendarItem) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = useInvalidate();
  const [n, setN] = useState(0);
  const [caption, setCaption] = useState(() => item.writeup || suggestCaption(item, 0));
  const [platforms, setPlatforms] = useState<string[]>(['Facebook', 'Instagram']);
  const codes = item.members.filter((m) => item.attendance?.[m]?.status === 'ATTENDED' || item.attendance?.[m]?.status === 'REPRESENTATIVE');
  const targets = codes.length ? codes : item.members;
  const m = useMutation({
    mutationFn: (status: 'POSTED' | 'SKIPPED') => Promise.all(targets.map((code) => setSocial(eventIdOf(item), { code, status, platforms: status === 'POSTED' ? platforms : [], caption }))),
    onSuccess: (_d, s) => { invalidate(); enqueueSnackbar(s === 'POSTED' ? 'Marked as posted' : 'Skipped', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const copy = () => navigator.clipboard?.writeText(caption).then(() => enqueueSnackbar('Caption copied', { variant: 'success' })).catch(() => {});

  return (
    <Card variant="outlined" sx={{ '&:hover': { transform: 'none' } }}>
      <CardContent>
        <Stack spacing={1.25}>
          <ItemHeader item={item} onOpen={onOpen} />
          <EventPhotos eventId={eventIdOf(item)} size={84} />
          <TextField
            label="Post text" multiline minRows={3} maxRows={8} value={caption} onChange={(e) => setCaption(e.target.value)}
            InputProps={{ endAdornment: <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}><Tooltip title="Copy"><IconButton size="small" onClick={copy}><Icon name="ContentCopy" fontSize="small" /></IconButton></Tooltip></InputAdornment> }}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Button size="small" startIcon={<Icon name="Autorenew" />} onClick={() => { const next = n + 1; setN(next); setCaption(suggestCaption(item, next)); }}>Suggest again</Button>
            <Box sx={{ flex: 1 }} />
            {CALENDAR_SOCIAL_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return <Chip key={p} size="small" label={p} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])} />;
            })}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button color="inherit" onClick={() => m.mutate('SKIPPED')} disabled={m.isPending}>Skip</Button>
            <Button variant="contained" startIcon={<Icon name="TaskAlt" />} onClick={() => m.mutate('POSTED')} disabled={m.isPending || !platforms.length}>Mark posted</Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function publicScheduleText(day: Dayjs, items: CalendarItem[], tCal: (s: string) => string) {
  const lines = items.map((i) => {
    const who = i.members.filter((m) => rsvpOf(i, m) === 'GOING').map((m) => codeMeta(m)?.title).join(', ');
    const place = [i.venue, i.area].filter(Boolean).join(', ');
    return `• ${i.allDay ? tCal('All day') : dayjs(i.start).format('h:mm A')} - ${i.title}${place ? `, ${place}` : ''}${who ? ` (${who})` : ''}`;
  });
  return `*${tCal('Programmes')} - ${day.format('dddd, D MMMM YYYY')}*\n\n${lines.join('\n')}`;
}

export function SocialMediaPanel({ onSelect, onPoster }: { onSelect: (i: CalendarItem) => void; onPoster?: (d: Dayjs) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = useInvalidate();
  const { tCal } = useCalendarReference();
  const [tab, setTab] = useState<'post' | 'posted'>('post');
  const [day, setDay] = useState(dayjs().startOf('day'));

  const dayQ = useQuery({ queryKey: ['calendar', 'public-day', day.format('YYYY-MM-DD')], queryFn: () => fetchRange(day, day.add(1, 'day')) });
  const dayItems = (dayQ.data ?? [])
    .filter((i) => !i.draft && i.status !== 'CANCELLED' && i.type !== 'UNAVAILABLE' && i.publicSchedule !== false && i.members.some((m) => rsvpOf(i, m) === 'GOING'))
    .sort((a, b) => dayjs(a.start).diff(dayjs(b.start)));
  const scheduleText = dayItems.length ? publicScheduleText(day, dayItems, tCal) : '';

  const recentFrom = dayjs().subtract(45, 'day').startOf('day');
  const recent = useQuery({ queryKey: ['calendar', 'social-recent', recentFrom.format('YYYY-MM-DD')], queryFn: () => fetchRange(recentFrom, dayjs().add(1, 'day').startOf('day')) });
  const { toPost, posted } = useMemo(() => {
    const seen = new Set<string>();
    const list = (recent.data ?? []).filter((i) => {
      const k = eventIdOf(i);
      if (seen.has(k)) return false;
      seen.add(k);
      return !i.draft && i.type !== 'UNAVAILABLE' && dayjs(i.start).isBefore(dayjs());
    });
    const done = (i: CalendarItem) => Object.values(i.social ?? {}).some((s) => s.status === 'POSTED' || s.status === 'SKIPPED');
    const went = (i: CalendarItem) => Object.values(i.attendance ?? {}).some((a) => a.status === 'ATTENDED' || a.status === 'REPRESENTATIVE');
    return {
      toPost: list.filter((i) => i.publicSchedule !== false && went(i) && !done(i)).sort((a, b) => dayjs(b.start).diff(dayjs(a.start))),
      posted: list.filter(done).sort((a, b) => dayjs(b.start).diff(dayjs(a.start))),
    };
  }, [recent.data]);

  const undo = useMutation({
    mutationFn: (i: CalendarItem) => Promise.all(Object.keys(i.social ?? {}).map((code) => setSocial(eventIdOf(i), { code, status: null }))),
    onSuccess: () => { invalidate(); enqueueSnackbar('Moved back to "To post"', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  return (
    <Stack spacing={2}>
      <Card sx={{ '&:hover': { transform: 'none' } }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={800}>Public schedule</Typography>
              <Typography variant="caption" color="text.secondary">Programmes someone is going to, ready to share. Personal, official and away entries are left out.</Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton size="small" onClick={() => setDay(day.subtract(1, 'day'))}><Icon name="ChevronLeft" /></IconButton>
              <TextField type="date" size="small" value={day.format('YYYY-MM-DD')} onChange={(e) => e.target.value && setDay(dayjs(e.target.value))} />
              <IconButton size="small" onClick={() => setDay(day.add(1, 'day'))}><Icon name="ChevronRight" /></IconButton>
              <Button size="small" onClick={() => setDay(dayjs().add(1, 'day').startOf('day'))}>Tomorrow</Button>
              {onPoster && <Button size="small" variant="contained" startIcon={<Icon name="PhotoLibrary" />} onClick={() => onPoster(day)}>Poster</Button>}
            </Stack>
          </Stack>
          {dayQ.isLoading ? <LinearProgress /> : scheduleText ? (
            <Box sx={{ position: 'relative' }}>
              <Box component="pre" sx={{ m: 0, p: 1.5, pr: 6, borderRadius: 1.5, bgcolor: 'action.hover', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14 }}>{scheduleText}</Box>
              <Tooltip title="Copy">
                <IconButton
                  sx={{ position: 'absolute', top: 6, right: 6 }}
                  onClick={() => navigator.clipboard?.writeText(scheduleText).then(() => enqueueSnackbar('Schedule copied', { variant: 'success' })).catch(() => {})}
                >
                  <Icon name="ContentCopy" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : <Typography variant="body2" color="text.secondary">Nothing public on {day.format('ddd D MMM')}.</Typography>}
        </CardContent>
      </Card>

      <Card sx={{ '&:hover': { transform: 'none' } }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="post" label={`To post (${toPost.length})`} />
          <Tab value="posted" label={`Posted (${posted.length})`} />
        </Tabs>
        <CardContent>
          {recent.isLoading && <LinearProgress />}
          {tab === 'post' && (
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary">Events from the last 45 days that someone attended and haven't been posted yet.</Typography>
              {toPost.map((i) => <ToPostCard key={eventIdOf(i)} item={i} onOpen={onSelect} />)}
              {recent.isSuccess && !toPost.length && <Typography variant="body2" color="text.secondary">All caught up - nothing waiting to be posted.</Typography>}
            </Stack>
          )}
          {tab === 'posted' && (
            <Stack divider={<Divider />}>
              {posted.map((i) => {
                const s = Object.values(i.social ?? {})[0];
                return (
                  <Stack key={eventIdOf(i)} direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <ItemHeader item={i} onOpen={onSelect} />
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                        {s?.status === 'SKIPPED' ? 'Skipped' : `Posted on ${s?.platforms?.join(', ') || '—'}`}{s?.at ? ` · ${dayjs(s.at).format('D MMM')}` : ''}
                      </Typography>
                    </Box>
                    <Button size="small" startIcon={<Icon name="Undo" />} onClick={() => undo.mutate(i)} disabled={undo.isPending}>Undo</Button>
                  </Stack>
                );
              })}
              {recent.isSuccess && !posted.length && <Typography variant="body2" color="text.secondary">Nothing posted in the last 45 days.</Typography>}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

/* --------------------------------- reports -------------------------------- */
interface PersonRow { invited: number; going: number; notGoing: number; undecided: number; attended: number; representative: number; notAttended: number; unmarked: number; awayDays: number }
interface MonthlySummary {
  month: string; total: number; attendedEvents: number;
  byType: Record<string, number>; byTypeAttended?: Record<string, number>;
  topAreas: { area: string; count: number }[];
  replies: { PENDING: number; CONFIRMED: number; REGRET: number };
  social: { posted: number; toPost: number };
  perMember: Record<string, PersonRow>;
}

function Tile({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', minWidth: 0 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.14), color, flexShrink: 0 }}><Icon name={icon} fontSize="small" /></Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">{label}</Typography>
      </Box>
    </Stack>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Stack spacing={0.75}>
      {rows.map((r) => (
        <Box key={r.label}>
          <Stack direction="row" justifyContent="space-between"><Typography variant="caption" noWrap>{r.label}</Typography><Typography variant="caption" fontWeight={700}>{r.value}</Typography></Stack>
          <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}><Box sx={{ height: 6, borderRadius: 3, width: `${(r.value / max) * 100}%`, bgcolor: r.color }} /></Box>
        </Box>
      ))}
      {!rows.length && <Typography variant="body2" color="text.secondary">No data.</Typography>}
    </Stack>
  );
}

export function ReportsPanel({ filters }: { filters: { types?: string; members?: string } }) {
  const { enqueueSnackbar } = useSnackbar();
  const { can } = useAuth();
  const { tCal } = useCalendarReference();
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [histQ, setHistQ] = useState('');
  const key = month.format('YYYY-MM');
  const summary = useQuery({ queryKey: ['calendar', 'summary', key], queryFn: () => fetchMonthlySummary(key) as Promise<MonthlySummary> });
  const changes = useQuery({
    queryKey: ['calendar', 'changes', key],
    queryFn: () => fetchChangeLog({ from: month.toISOString(), to: month.add(1, 'month').toISOString(), limit: 500 }),
  });
  const s = summary.data;
  const people = CALENDAR_CODES.map((c) => ({ c, r: s?.perMember?.[c.code] }));
  const hist = (changes.data ?? []).filter((c) => {
    const q = histQ.trim().toLowerCase();
    return !q || [c.title, c.byName, c.action, ...c.detail].join(' ').toLowerCase().includes(q);
  });

  const range = { from: month.toISOString(), to: month.add(1, 'month').toISOString(), ...filters } as Record<string, string>;
  const download = (format: 'ics' | 'csv' | 'xlsx') =>
    downloadViaApi('/calendar/export', { ...range, format }, `calendar-${key}.${format}`).catch((e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }));
  const copyWhatsapp = async () => {
    try { await navigator.clipboard.writeText(await fetchWhatsappText(range)); enqueueSnackbar('Copied', { variant: 'success' }); } catch (e) { enqueueSnackbar(errorMessage(e), { variant: 'error' }); }
  };
  const cols: { k: keyof PersonRow; label: string }[] = [
    { k: 'invited', label: 'Invited' }, { k: 'going', label: 'Going' }, { k: 'notGoing', label: 'Not going' }, { k: 'undecided', label: 'Not decided' },
    { k: 'attended', label: 'Attended' }, { k: 'representative', label: 'Representative' }, { k: 'notAttended', label: 'Did not attend' },
    { k: 'unmarked', label: 'Not marked' }, { k: 'awayDays', label: 'Days away' },
  ];

  return (
    <Stack spacing={2}>
      <Card sx={{ '&:hover': { transform: 'none' } }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton size="small" onClick={() => setMonth(month.subtract(1, 'month'))}><Icon name="ChevronLeft" /></IconButton>
              <Typography variant="h6" fontWeight={800} sx={{ minWidth: 160, textAlign: 'center' }}>{month.format('MMMM YYYY')}</Typography>
              <IconButton size="small" onClick={() => setMonth(month.add(1, 'month'))}><Icon name="ChevronRight" /></IconButton>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" startIcon={<Icon name="Download" />} onClick={() => download('csv')}>CSV</Button>
              <Button size="small" variant="outlined" startIcon={<Icon name="Download" />} onClick={() => download('xlsx')}>Excel</Button>
              <Button size="small" variant="outlined" startIcon={<Icon name="Download" />} onClick={() => download('ics')}>.ics</Button>
              <Button size="small" variant="outlined" startIcon={<Icon name="ContentCopy" />} onClick={copyWhatsapp}>WhatsApp</Button>
              {can(PERMISSIONS.CALENDAR_ADMIN) && (
                <Button size="small" variant="outlined" color="secondary" startIcon={<Icon name="CloudDone" />} onClick={() => downloadViaApi('/calendar/backup', undefined, 'calendar-backup.json')}>Full backup</Button>
              )}
            </Stack>
          </Stack>
          {summary.isLoading && <LinearProgress />}
          {s && (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' } }}>
              <Tile label="Events" value={s.total} color="#3F51B5" icon="Event" />
              <Tile label="Attended" value={s.attendedEvents} color="#2E7D32" icon="CheckCircle" />
              <Tile label="Days away" value={Object.values(s.perMember ?? {}).reduce((a, r) => a + r.awayDays, 0)} color="#90A4AE" icon="FlightTakeoff" />
              <Tile label="Replies pending" value={s.replies?.PENDING ?? 0} color="#F59E0B" icon="MarkEmailRead" />
              <Tile label="Posted / to post" value={`${s.social?.posted ?? 0} / ${s.social?.toPost ?? 0}`} color="#D81B60" icon="Share" />
            </Box>
          )}
        </CardContent>
      </Card>

      {s && (
        <Card sx={{ '&:hover': { transform: 'none' } }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>By person</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    {cols.map((c) => <TableCell key={c.k} align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{c.label}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {people.map(({ c, r }) => (
                    <TableRow key={c.code}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center"><CalendarAvatar code={c.code} size={26} /><Typography variant="body2" fontWeight={700} sx={{ color: c.color, whiteSpace: 'nowrap' }}>{tCal(c.title)}</Typography></Stack>
                      </TableCell>
                      {cols.map((col) => (
                        <TableCell key={col.k} align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: col.k === 'unmarked' && (r?.[col.k] ?? 0) > 0 ? 'warning.main' : undefined, fontWeight: col.k === 'attended' ? 800 : 400 }}>
                          {r?.[col.k] ?? 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {s && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <Card sx={{ '&:hover': { transform: 'none' } }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>By type</Typography>
              <Bars rows={Object.entries(s.byType ?? {}).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ label: tCal(calendarTypeMeta(t).label), value: v, color: calendarTypeMeta(t).color }))} />
            </CardContent>
          </Card>
          <Card sx={{ '&:hover': { transform: 'none' } }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Top wards / areas</Typography>
              <Bars rows={(s.topAreas ?? []).map((a) => ({ label: a.area, value: a.count, color: '#00897B' }))} />
            </CardContent>
          </Card>
          <Card sx={{ '&:hover': { transform: 'none' } }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Replies to organisers</Typography>
              <Bars rows={[
                { label: 'Told: coming', value: s.replies?.CONFIRMED ?? 0, color: '#2E7D32' },
                { label: 'Told: regret', value: s.replies?.REGRET ?? 0, color: '#D32F2F' },
                { label: 'Not replied', value: s.replies?.PENDING ?? 0, color: '#F59E0B' },
              ]} />
              <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 2, mb: 1 }}>Social media</Typography>
              <Bars rows={[{ label: 'Posted', value: s.social?.posted ?? 0, color: '#D81B60' }, { label: 'To post', value: s.social?.toPost ?? 0, color: '#9E9E9E' }]} />
            </CardContent>
          </Card>
        </Box>
      )}

      <Card sx={{ '&:hover': { transform: 'none' } }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={800}>Change history</Typography>
            <TextField
              size="small" placeholder="Search changes" value={histQ} onChange={(e) => setHistQ(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="Search" fontSize="small" /></InputAdornment> }}
            />
          </Stack>
          {changes.isLoading && <LinearProgress />}
          <Stack divider={<Divider />} sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {hist.map((c) => (
              <Box key={c.id} sx={{ py: 0.75 }}>
                <Typography variant="body2"><b>{c.byName}</b> {c.action} <b>{c.title}</b></Typography>
                <Typography variant="caption" color="text.secondary">{dayjs(c.at).format('D MMM, h:mm A')}{c.detail.length ? ` · ${c.detail.join('; ')}` : ''}</Typography>
              </Box>
            ))}
            {changes.isSuccess && !hist.length && <Typography variant="body2" color="text.secondary">No changes{histQ ? ' match' : ' this month'}.</Typography>}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

/** Role-at-event labels used by the editor and details dialog. */
export const ROLE_LABEL: Record<string, string> = Object.fromEntries(CALENDAR_ROLE_AT_EVENT.map((r) => [r, r.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')]));
