import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, MenuItem, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CALENDAR_CODES, CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_GROUPS, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPES,
  CALENDAR_PREP_ITEMS, CALENDAR_RECURRENCE, CALENDAR_ROLE_AT_EVENT, calendarTypeMeta,
} from '@mla/shared';
import { errorMessage } from '@/api/client';
import { Icon } from '@/components/Icon';
import { checkClashes, createEvent, fetchSuggestions, updateEvent } from './calendarApi';
import { CalendarsField, useDefaultCalendars } from './CalendarsField';
import { CalendarAvatar } from './CalendarAvatar';
import { SpeechEditor } from './SpeechEditor';
import { useCalendarReference } from './useCalendarReference';
import type { CalendarItem } from './calendarUtils';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled', TENTATIVE: 'Tentative', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
export const PREP_LABEL: Record<string, string> = {
  SHAWL: 'Shawl & garland', MEMENTO: 'Memento / gift', DONATION: 'Donation (Kanike)', SPEECH: 'Speech points',
  PRESS: 'Press informed', PHOTO: 'Photographer / video', POLICE: 'Police / security informed', VEHICLE: 'Vehicle arranged',
};
export const ROLE_LABEL: Record<string, string> = {
  CHIEF_GUEST: 'Chief Guest', INAUGURATOR: 'Inaugurator', GUEST_OF_HONOUR: 'Guest of Honour', PRESIDING: 'Presiding', SPEAKER: 'Speaker', GUEST: 'Guest',
};
const RSVP_OPTS = [
  { code: 'GOING', label: 'Going', color: '#2E7D32' },
  { code: 'UNDECIDED', label: 'Not decided', color: '#F59E0B' },
  { code: 'NOT_GOING', label: 'Not going', color: '#D32F2F' },
];

interface SessionForm { date: string; start: string; end: string; arrival: string }

interface FormState {
  members: string[];
  rsvp: Record<string, string>;
  title: string;
  type: string;
  status: string;
  allDay: boolean;
  startDate: string; startTime: string;
  endDate: string; endTime: string;
  arrival: string;
  sessions: SessionForm[];
  recurrence: string;
  recurrenceUntil: string;
  venue: string;
  area: string;
  organizer: string;
  organizerKind: string;
  contactName: string;
  contactPhone: string;
  contact2Name: string;
  contact2Phone: string;
  attendees: string[];
  description: string;
  role: string;
  prep: string[];
  prepDone: string[];
  prepNote: string;
  speechNeeded: boolean;
  speechKn: string;
  speechEn: string;
  reply: string;
  publicSchedule: boolean;
  writeup: string;
}

/** A timed session's end: when the end time isn't after the start it runs past midnight. */
function sessionEnd(date: string, start: string, end: string) {
  const s = dayjs(`${date}T${start}`);
  let e = dayjs(`${date}T${end}`);
  if (s.isValid() && e.isValid() && !e.isAfter(s)) e = e.add(1, 'day');
  return e;
}

function fromItem(item: CalendarItem): FormState {
  // Editing an occurrence edits the whole series, so use the series' own dates.
  const s = dayjs(item.seriesStart ?? item.start);
  const e = dayjs(item.seriesEnd ?? item.end);
  return {
    members: item.members ?? [],
    rsvp: Object.fromEntries((item.members ?? []).map((m) => [m, item.rsvp?.[m] ?? 'UNDECIDED'])),
    title: item.title,
    type: calendarTypeMeta(item.type).code === 'UNKNOWN' ? CALENDAR_DEFAULT_TYPE : calendarTypeMeta(item.type).code,
    status: item.status ?? 'SCHEDULED',
    allDay: !!item.allDay,
    startDate: s.format('YYYY-MM-DD'), startTime: s.format('HH:mm'),
    endDate: e.format('YYYY-MM-DD'), endTime: e.format('HH:mm'),
    arrival: item.seriesArrival ?? item.arrival ?? '',
    sessions: (item.sessions ?? []).map((x) => ({
      date: dayjs(x.start).format('YYYY-MM-DD'), start: dayjs(x.start).format('HH:mm'), end: dayjs(x.end).format('HH:mm'), arrival: x.arrival ?? '',
    })),
    recurrence: item.recurrence ?? 'NONE',
    recurrenceUntil: item.recurrenceUntil ? dayjs(item.recurrenceUntil).format('YYYY-MM-DD') : '',
    venue: item.venue ?? '',
    area: item.area ?? '',
    organizer: item.organizer ?? '',
    organizerKind: item.organizerKind ?? 'IND',
    contactName: item.contactName ?? '',
    contactPhone: item.contactPhone ?? '',
    contact2Name: item.contact2Name ?? '',
    contact2Phone: item.contact2Phone ?? '',
    attendees: item.attendees ?? [],
    description: item.description ?? '',
    role: item.role ?? '',
    prep: item.prep ?? [],
    prepDone: item.prepDone ?? [],
    prepNote: item.prepNote ?? '',
    speechNeeded: !!item.speech?.needed,
    speechKn: item.speech?.kn ?? '',
    speechEn: item.speech?.en ?? '',
    reply: item.reply ?? 'PENDING',
    publicSchedule: item.publicSchedule ?? true,
    writeup: item.writeup ?? '',
  };
}

function blank(start: Dayjs, end: Dayjs, allDay: boolean, members: string[]): FormState {
  return {
    members, rsvp: {}, title: '', type: CALENDAR_DEFAULT_TYPE, status: 'SCHEDULED', allDay,
    startDate: start.format('YYYY-MM-DD'), startTime: start.format('HH:mm'),
    endDate: end.format('YYYY-MM-DD'), endTime: end.format('HH:mm'),
    arrival: '', sessions: [],
    recurrence: 'NONE', recurrenceUntil: '',
    venue: '', area: '', organizer: '', organizerKind: 'IND',
    contactName: '', contactPhone: '', contact2Name: '', contact2Phone: '',
    attendees: [], description: '',
    role: '', prep: [], prepDone: [], prepNote: '',
    speechNeeded: false, speechKn: '', speechEn: '',
    reply: 'PENDING', publicSchedule: true, writeup: '',
  };
}

function Section({ icon, title, children, right }: { icon: string; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2"><Icon name={icon} fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />{title}</Typography>
        {right}
      </Stack>
      {children}
    </Box>
  );
}

const phoneOnly = (v: string) => v.replace(/[^\d+ ]/g, '').slice(0, 15);

/** Free-text field with suggestions from past events. */
function Suggest({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <Autocomplete
      freeSolo size="small" options={options} value={value} inputValue={value}
      onInputChange={(_e, v) => onChange(v)} filterOptions={(opts, s) => {
        const q = s.inputValue.trim().toLowerCase();
        return (q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts).slice(0, 12);
      }}
      renderInput={(p) => <TextField {...p} label={label} placeholder={placeholder} />}
    />
  );
}

function ContactField({
  n, name, phone, onChange, contacts,
}: { n: 1 | 2; name: string; phone: string; onChange: (name: string, phone: string) => void; contacts: { name: string; phone: string }[] }) {
  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} sm={7}>
        <Autocomplete
          freeSolo size="small" options={contacts} inputValue={name}
          getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
          filterOptions={(opts, s) => {
            const q = s.inputValue.trim().toLowerCase();
            const digits = q.replace(/\D/g, '');
            return (q ? opts.filter((o) => o.name.toLowerCase().includes(q) || (digits.length >= 3 && o.phone.replace(/\D/g, '').includes(digits))) : []).slice(0, 10);
          }}
          renderOption={(props, o) => (
            <li {...props} key={`${o.name}|${o.phone}`}>
              <Box><Typography variant="body2">{o.name}</Typography><Typography variant="caption" color="text.secondary">{o.phone}</Typography></Box>
            </li>
          )}
          onInputChange={(_e, v, reason) => { if (reason === 'input' || reason === 'clear') onChange(v, phone); }}
          onChange={(_e, v) => { if (v && typeof v !== 'string') onChange(v.name, v.phone || phone); }}
          renderInput={(p) => <TextField {...p} label={n === 1 ? 'Contact person' : '2nd contact (optional)'} />}
        />
      </Grid>
      <Grid item xs={12} sm={5}>
        <TextField fullWidth size="small" label="Phone" value={phone} onChange={(e) => onChange(name, phoneOnly(e.target.value))} inputProps={{ inputMode: 'tel' }} />
      </Grid>
    </Grid>
  );
}

export interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing event to edit; omit to create. */
  item?: CalendarItem | null;
  /** Pre-filled slot for a new event. */
  defaults?: { start: Dayjs; end: Dayjs; allDay?: boolean; members?: string[] } | null;
}

export function EventDialog({ open, onClose, item, defaults }: EventDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const ref = useCalendarReference();
  const { tCal } = ref;
  const defaultCalendars = useDefaultCalendars();
  const editing = !!item?.eventId;
  const [form, setForm] = useState<FormState>(() => blank(dayjs(), dayjs().add(1, 'hour'), false, []));
  const [error, setError] = useState<string | null>(null);
  const [showEndDate, setShowEndDate] = useState(false);
  const sugg = useQuery({ queryKey: ['calendar', 'suggestions'], queryFn: fetchSuggestions, enabled: open, staleTime: 10 * 60_000 });
  const awayPresets = (ref.data?.awayPresets ?? []).map((p) => (typeof p === 'string' ? p : (p as { label: string }).label));

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      const f = fromItem(item);
      setForm(f);
      // Timed events that span more than an overnight need the explicit end-date field.
      const span = dayjs(f.endDate).diff(dayjs(f.startDate), 'day');
      setShowEndDate(!f.allDay && (span > 1 || (span === 1 && f.endTime > f.startTime)));
    } else {
      const s = defaults?.start ?? dayjs().add(1, 'hour').startOf('hour');
      const e = defaults?.end ?? s.add(1, 'hour');
      setForm(blank(s, e, !!defaults?.allDay, defaults?.members?.length ? defaults.members : defaultCalendars));
      setShowEndDate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, defaults]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const meta = calendarTypeMeta(form.type);
  const isAway = form.type === 'UNAVAILABLE';

  const startAt = form.allDay ? dayjs(form.startDate).startOf('day') : dayjs(`${form.startDate}T${form.startTime}`);
  const endAt = form.allDay
    ? dayjs(form.endDate).endOf('day').millisecond(0)
    : showEndDate ? dayjs(`${form.endDate}T${form.endTime}`) : sessionEnd(form.startDate, form.startTime, form.endTime);
  const endsNextDay = !form.allDay && !showEndDate && endAt.isValid() && !endAt.isSame(startAt, 'day');
  const rangeValid = startAt.isValid() && endAt.isValid() && !endAt.isBefore(startAt);
  const sessionsValid = form.sessions.every((s) => dayjs(`${s.date}T${s.start}`).isValid() && dayjs(`${s.date}T${s.end}`).isValid());
  const canSave = form.title.trim().length > 0 && rangeValid && sessionsValid && form.members.length > 0;

  // Keep the end the same distance after the start when the start moves.
  const moveStart = (date: string, time: string) => {
    const dur = rangeValid ? Math.max(0, endAt.diff(startAt, 'minute')) : 60;
    const ns = dayjs(`${date}T${time || '00:00'}`);
    if (!ns.isValid()) { setForm((f) => ({ ...f, startDate: date, startTime: time })); return; }
    const ne = form.allDay ? dayjs(date).add(Math.max(0, dayjs(form.endDate).diff(dayjs(form.startDate), 'day')), 'day') : ns.add(dur, 'minute');
    setForm((f) => ({ ...f, startDate: date, startTime: time, endDate: ne.format('YYYY-MM-DD'), endTime: form.allDay ? f.endTime : ne.format('HH:mm') }));
  };

  const setMembers = (codes: string[]) => setForm((f) => ({ ...f, members: codes, rsvp: Object.fromEntries(codes.map((c) => [c, f.rsvp[c] ?? 'UNDECIDED'])) }));

  const addSession = () => {
    const last = form.sessions[form.sessions.length - 1];
    const date = dayjs(last?.date ?? form.startDate).add(1, 'day').format('YYYY-MM-DD');
    set('sessions', [...form.sessions, { date, start: last?.start ?? form.startTime, end: last?.end ?? form.endTime, arrival: last?.arrival ?? form.arrival }]);
  };
  const setSession = (i: number, patch: Partial<SessionForm>) => set('sessions', form.sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const togglePrep = (code: string) => {
    const has = form.prep.includes(code);
    setForm((f) => ({
      ...f,
      prep: has ? f.prep.filter((c) => c !== code) : [...f.prep, code],
      prepDone: has ? f.prepDone.filter((c) => c !== code) : f.prepDone,
      speechNeeded: code === 'SPEECH' && !has ? true : f.speechNeeded,
    }));
  };

  // Non-blocking "someone's already committed elsewhere" warning.
  const clashQuery = useQuery({
    queryKey: ['calendar', 'clashes', form.members, startAt.toISOString(), endAt.toISOString(), item?.eventId],
    queryFn: () => checkClashes({ members: form.members, start: startAt.toISOString(), end: endAt.toISOString(), excludeId: item?.eventId }),
    enabled: open && rangeValid && form.members.length > 0,
    placeholderData: keepPreviousData,
  });
  const clashes = useMemo(() => clashQuery.data ?? [], [clashQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const realMembers = form.members.filter((m) => CALENDAR_CODES.some((c) => c.code === m));
      const body: Record<string, unknown> = {
        members: form.members,
        title: form.title.trim(),
        type: form.type,
        status: form.status,
        allDay: form.allDay,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        arrival: form.allDay ? '' : form.arrival,
        sessions: form.allDay || form.recurrence !== 'NONE' ? [] : form.sessions.map((s) => ({
          start: dayjs(`${s.date}T${s.start}`).toISOString(), end: sessionEnd(s.date, s.start, s.end).toISOString(), arrival: s.arrival || undefined,
        })),
        recurrence: form.recurrence,
        recurrenceUntil: form.recurrence !== 'NONE' && form.recurrenceUntil ? dayjs(form.recurrenceUntil).startOf('day').toISOString() : null,
        venue: form.venue.trim(),
        area: form.area.trim(),
        organizer: form.organizer.trim(),
        organizerKind: form.organizerKind,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contact2Name: form.contact2Name.trim(),
        contact2Phone: form.contact2Phone.trim(),
        attendees: form.attendees,
        description: form.description.trim(),
        role: form.role || null,
        prep: form.prep,
        prepDone: form.prepDone,
        prepNote: form.prepNote.trim(),
        speech: { needed: form.speechNeeded, kn: form.speechKn, en: form.speechEn },
        reply: form.reply,
        publicSchedule: form.publicSchedule,
        writeup: form.writeup.trim(),
        dateUnknown: false,
      };
      if (realMembers.length) body.rsvp = Object.fromEntries(realMembers.map((m) => [m, form.rsvp[m] ?? 'UNDECIDED']));
      if (editing && item?.draft) body.draft = false;
      if (editing) return updateEvent(item!.eventId!, body);
      return createEvent(body);
    },
    onSuccess: () => {
      enqueueSnackbar(editing ? 'Event updated' : 'Event added to calendar', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const memberTitle = (code: string) => CALENDAR_CODES.find((c) => c.code === code)?.title ?? code;
  const realSelected = CALENDAR_CODES.filter((c) => form.members.includes(c.code));
  const s = sugg.data;

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <Box sx={{ height: 5, bgcolor: meta.color }} />
      <DialogTitle sx={{ pb: 1 }}>{editing ? 'Edit event' : 'New event'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {editing && item?.isRecurring && (
            <Alert severity="info" icon={<Icon name="Autorenew" />}>This is a repeating event - changes apply to every occurrence.</Alert>
          )}
          {editing && item?.draft && (
            <Alert severity="error" variant="outlined">This was added as a Quick Event - fill in the details below to complete it.</Alert>
          )}
          {!!clashes.length && (
            <Alert severity="warning" icon={<Icon name="Warning" />}>
              <b>Clash:</b> {clashes.map((c) => `${memberTitle(c.memberCode)} is already ${c.reason === 'AWAY' ? 'away' : 'going to'} "${c.event.title}" (${dayjs(c.event.start).format('D MMM h:mm A')}).`).join(' ')}
            </Alert>
          )}

          {/* ----- what ----- */}
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" select label="Category" value={meta.group}
                onChange={(e) => set('type', CALENDAR_EVENT_TYPES.find((t) => t.group === e.target.value)?.code ?? CALENDAR_DEFAULT_TYPE)}
              >
                {CALENDAR_EVENT_GROUPS.map((g) => <MenuItem key={g.code} value={g.code}>{tCal(g.label)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth size="small" select label="Type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {CALENDAR_EVENT_TYPES.filter((t) => t.group === meta.group).map((t) => (
                  <MenuItem key={t.code} value={t.code}>
                    <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color, mr: 1.25, display: 'inline-block' }} />
                    {tCal(t.label)}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, display: { xs: 'none', sm: 'inline' } }}>{t.hint}</Typography>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                autoFocus fullWidth required label={isAway ? 'Reason' : 'Title'} value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={isAway ? 'e.g. Assembly session - Bengaluru' : 'e.g. Ganesha temple Kalashotsava'}
              />
              {isAway && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {awayPresets.map((p) => (
                    <Chip key={p} size="small" label={tCal(p)} icon={<Icon name="FlightTakeoff" sx={{ fontSize: 14 }} />} variant={form.title === p ? 'filled' : 'outlined'} onClick={() => set('title', p)} />
                  ))}
                </Stack>
              )}
            </Grid>
          </Grid>

          {/* ----- who ----- */}
          <Section icon="Groups" title="Invited">
            <CalendarsField value={form.members} onChange={setMembers} label="Calendar(s)" />
            {!isAway && !!realSelected.length && (
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Who is going?</Typography>
                {realSelected.map((c) => (
                  <Stack key={c.code} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <CalendarAvatar code={c.code} size={26} />
                    <Typography variant="body2" fontWeight={700} sx={{ color: c.color, minWidth: 80 }}>{tCal(c.title)}</Typography>
                    <ToggleButtonGroup
                      size="small" exclusive value={form.rsvp[c.code] ?? 'UNDECIDED'}
                      onChange={(_e, v) => v && set('rsvp', { ...form.rsvp, [c.code]: v })}
                      sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1.25, textTransform: 'none', fontSize: 12, fontWeight: 700 } }}
                    >
                      {RSVP_OPTS.map((o) => (
                        <ToggleButton key={o.code} value={o.code} sx={{ '&.Mui-selected': { color: '#fff', bgcolor: `${o.color} !important` } }}>{tCal(o.label)}</ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>

          {/* ----- when ----- */}
          <Section
            icon="Event" title="When"
            right={<FormControlLabel control={<Switch checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />} label="All day" sx={{ mr: 0 }} />}
          >
            <Grid container spacing={1.5} alignItems="center">
              {form.sessions.length > 0 && <Grid item xs={12}><Typography variant="caption" fontWeight={800} color="text.secondary">DAY 1</Typography></Grid>}
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" type="date" label={form.allDay || showEndDate ? 'Start date' : 'Date'} InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => moveStart(e.target.value, form.startTime)} />
              </Grid>
              {!form.allDay && (
                <>
                  <Grid item xs={6} sm={2.5}>
                    <TextField fullWidth size="small" type="time" label="Start" InputLabelProps={{ shrink: true }} value={form.startTime} onChange={(e) => moveStart(form.startDate, e.target.value)} />
                  </Grid>
                  {showEndDate && (
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} error={!rangeValid} />
                    </Grid>
                  )}
                  <Grid item xs={6} sm={2.5}>
                    <TextField
                      fullWidth size="small" type="time" label="End" InputLabelProps={{ shrink: true }} value={form.endTime} error={!rangeValid}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value, endDate: showEndDate ? f.endDate : sessionEnd(f.startDate, f.startTime, e.target.value).format('YYYY-MM-DD') }))}
                      helperText={endsNextDay ? 'ends next day' : undefined}
                      FormHelperTextProps={{ sx: { color: 'warning.main', fontWeight: 700, m: 0 } }}
                    />
                  </Grid>
                  {!isAway && (
                    <Grid item xs={6} sm={showEndDate ? 3 : 4}>
                      <TextField
                        fullWidth size="small" type="time" label="Arrive by" InputLabelProps={{ shrink: true }} value={form.arrival}
                        onChange={(e) => set('arrival', e.target.value)} helperText="When to reach the venue" FormHelperTextProps={{ sx: { m: 0 } }}
                      />
                    </Grid>
                  )}
                </>
              )}
              {form.allDay && (
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} error={!rangeValid} />
                </Grid>
              )}
              {!rangeValid && <Grid item xs={12}><Typography variant="caption" color="error">End must be after the start.</Typography></Grid>}

              {!form.allDay && form.recurrence === 'NONE' && form.sessions.map((s, i) => (
                <Grid item xs={12} key={i}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12}><Typography variant="caption" fontWeight={800} color="text.secondary">DAY {i + 2}</Typography></Grid>
                    <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={s.date} onChange={(e) => setSession(i, { date: e.target.value })} /></Grid>
                    <Grid item xs={6} sm={2.5}><TextField fullWidth size="small" type="time" label="Start" InputLabelProps={{ shrink: true }} value={s.start} onChange={(e) => setSession(i, { start: e.target.value })} /></Grid>
                    <Grid item xs={6} sm={2.5}>
                      <TextField
                        fullWidth size="small" type="time" label="End" InputLabelProps={{ shrink: true }} value={s.end} onChange={(e) => setSession(i, { end: e.target.value })}
                        helperText={s.end && s.start && s.end <= s.start ? 'ends next day' : undefined} FormHelperTextProps={{ sx: { color: 'warning.main', fontWeight: 700, m: 0 } }}
                      />
                    </Grid>
                    <Grid item xs={5} sm={3}><TextField fullWidth size="small" type="time" label="Arrive by" InputLabelProps={{ shrink: true }} value={s.arrival} onChange={(e) => setSession(i, { arrival: e.target.value })} /></Grid>
                    <Grid item xs={1}>
                      <Tooltip title="Remove this day"><IconButton size="small" onClick={() => set('sessions', form.sessions.filter((_x, idx) => idx !== i))}><Icon name="Delete" fontSize="small" /></IconButton></Tooltip>
                    </Grid>
                  </Grid>
                </Grid>
              ))}
              {!form.allDay && form.recurrence === 'NONE' && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<Icon name="Add" />} onClick={addSession}>Add another day</Button>
                    {!showEndDate && <Button size="small" color="inherit" onClick={() => setShowEndDate(true)}>Set an end date</Button>}
                  </Stack>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" select label="Repeat" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)} disabled={form.sessions.length > 0}>
                  {CALENDAR_RECURRENCE.map((r) => <MenuItem key={r.code} value={r.code}>{tCal(r.label)}</MenuItem>)}
                </TextField>
              </Grid>
              {form.recurrence !== 'NONE' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" type="date" label="Repeat until (optional)" InputLabelProps={{ shrink: true }}
                    value={form.recurrenceUntil} onChange={(e) => set('recurrenceUntil', e.target.value)}
                  />
                </Grid>
              )}
            </Grid>
          </Section>

          {/* ----- where / organiser ----- */}
          {!isAway && (
            <Section icon="Place" title="Where & organiser">
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={7}><Suggest label="Venue" value={form.venue} onChange={(v) => set('venue', v)} options={s?.venues ?? []} placeholder="e.g. Kalyana Mantapa, PJ Extension" /></Grid>
                <Grid item xs={12} sm={5}><Suggest label="Area / Ward / Village" value={form.area} onChange={(v) => set('area', v)} options={s?.areas ?? []} /></Grid>
                <Grid item xs={12} sm={8}>
                  <Autocomplete
                    freeSolo size="small" options={s?.organizers ?? []} inputValue={form.organizer}
                    onInputChange={(_e, v) => setForm((f) => ({ ...f, organizer: v, organizerKind: s?.organizerKinds?.[v] ?? f.organizerKind }))}
                    filterOptions={(opts, st) => { const q = st.inputValue.trim().toLowerCase(); return (q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts).slice(0, 12); }}
                    renderInput={(p) => <TextField {...p} label="Organiser" />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <ToggleButtonGroup fullWidth size="small" exclusive value={form.organizerKind} onChange={(_e, v) => v && set('organizerKind', v)} sx={{ height: 40 }}>
                    <ToggleButton value="IND" sx={{ textTransform: 'none', fontWeight: 700 }}><Icon name="Person" fontSize="small" sx={{ mr: 0.5 }} />Ind</ToggleButton>
                    <ToggleButton value="SANGA" sx={{ textTransform: 'none', fontWeight: 700 }}><Icon name="Groups" fontSize="small" sx={{ mr: 0.5 }} />Sanga</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={12}>
                  <ContactField n={1} name={form.contactName} phone={form.contactPhone} contacts={s?.contacts ?? []} onChange={(n, p) => setForm((f) => ({ ...f, contactName: n, contactPhone: p }))} />
                </Grid>
                <Grid item xs={12}>
                  <ContactField n={2} name={form.contact2Name} phone={form.contact2Phone} contacts={s?.contacts ?? []} onChange={(n, p) => setForm((f) => ({ ...f, contact2Name: n, contact2Phone: p }))} />
                </Grid>
                {form.organizer.trim() && (
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" fontWeight={600}>Reply to organiser</Typography>
                      <ToggleButtonGroup size="small" exclusive value={form.reply} onChange={(_e, v) => v && set('reply', v)} sx={{ '& .MuiToggleButton-root': { py: 0.25, textTransform: 'none', fontWeight: 700, fontSize: 12 } }}>
                        <ToggleButton value="PENDING">Not replied</ToggleButton>
                        <ToggleButton value="CONFIRMED" sx={{ '&.Mui-selected': { color: '#fff', bgcolor: '#2E7D32 !important' } }}>Told: coming</ToggleButton>
                        <ToggleButton value="REGRET" sx={{ '&.Mui-selected': { color: '#fff', bgcolor: '#D32F2F !important' } }}>Told: regret</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  </Grid>
                )}
              </Grid>
            </Section>
          )}

          {/* ----- role & preparation ----- */}
          {!isAway && (
            <Accordion defaultExpanded={!!(form.role || form.prep.length || form.prepNote)} disableGutters sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', boxShadow: 'none', '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<Icon name="ExpandMore" />}>
                <Typography variant="subtitle2"><Icon name="Checklist" fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />Role &amp; preparation{form.prep.length ? ` · ${form.prepDone.length}/${form.prep.length}` : ''}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <TextField fullWidth size="small" select label="Role at the event" value={form.role} onChange={(e) => set('role', e.target.value)} sx={{ maxWidth: 320 }}>
                    <MenuItem value="">—</MenuItem>
                    {CALENDAR_ROLE_AT_EVENT.map((r) => <MenuItem key={r} value={r}>{tCal(ROLE_LABEL[r] ?? r)}</MenuItem>)}
                  </TextField>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>What needs to be ready? (tap again on the details page to tick it off)</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {CALENDAR_PREP_ITEMS.map((p) => {
                        const on = form.prep.includes(p);
                        const done = form.prepDone.includes(p);
                        return (
                          <Chip
                            key={p} label={tCal(PREP_LABEL[p] ?? p)} onClick={() => togglePrep(p)}
                            color={on ? (done ? 'success' : 'primary') : 'default'} variant={on ? 'filled' : 'outlined'}
                            icon={on ? <Icon name={done ? 'TaskAlt' : 'CheckCircle'} sx={{ fontSize: 16 }} /> : undefined}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                  <TextField fullWidth size="small" multiline maxRows={4} label="Other needs" value={form.prepNote} onChange={(e) => set('prepNote', e.target.value)} placeholder="e.g. 2 extra shawls, banner with name" />
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}

          {/* ----- speech ----- */}
          {!isAway && (
            <Accordion expanded={form.speechNeeded} onChange={(_e, x) => set('speechNeeded', x)} disableGutters sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', boxShadow: 'none', '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<Switch size="small" checked={form.speechNeeded} />} sx={{ '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { transform: 'none' } }}>
                <Typography variant="subtitle2"><Icon name="Description" fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />Speech</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <SpeechEditor kn={form.speechKn} en={form.speechEn} onChange={(v) => setForm((f) => ({ ...f, speechKn: v.kn, speechEn: v.en }))} />
              </AccordionDetails>
            </Accordion>
          )}

          {/* ----- people, notes, status, social ----- */}
          <Grid container spacing={1.5}>
            {!isAway && (
              <Grid item xs={12}>
                <Autocomplete
                  multiple freeSolo options={[] as string[]} value={form.attendees}
                  onChange={(_e, v) => set('attendees', (v as string[]).map((x) => x.trim()).filter(Boolean))}
                  renderTags={(value, getTagProps) => value.map((opt, i) => <Chip size="small" label={opt} {...getTagProps({ index: i })} key={`${opt}-${i}`} />)}
                  renderInput={(params) => <TextField {...params} size="small" label="Attendees / going along" placeholder="Type a name and press Enter" />}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Notes" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Grid>
            {editing && (
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {CALENDAR_EVENT_STATUSES.map((st) => <MenuItem key={st} value={st}>{STATUS_LABEL[st]}</MenuItem>)}
                </TextField>
              </Grid>
            )}
            {!isAway && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={form.publicSchedule} onChange={(e) => set('publicSchedule', e.target.checked)} />}
                  label="Social media - show on the public schedule and post after"
                />
                {form.publicSchedule && (
                  <TextField fullWidth multiline minRows={2} size="small" label="Write-up (for the post)" value={form.writeup} onChange={(e) => set('writeup', e.target.value)} sx={{ mt: 1 }} />
                )}
              </Grid>
            )}
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={!canSave || save.isPending} startIcon={<Icon name="CheckCircle" />}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add event'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { STATUS_LABEL };
