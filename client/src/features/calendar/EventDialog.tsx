import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_GROUPS, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPES, CALENDAR_ORGANISER_KINDS,
  CALENDAR_ORGANISER_REPLY_STATUSES, CALENDAR_PREP_ITEMS, CALENDAR_RECURRENCE, CALENDAR_ROLE_AT_EVENT, calendarTypeMeta,
} from '@mla/shared';
import { errorMessage } from '@/api/client';
import { Icon } from '@/components/Icon';
import { checkClashes, createEvent, updateEvent } from './calendarApi';
import { CalendarsField, useDefaultCalendars } from './CalendarsField';
import { useCalendarReference } from './useCalendarReference';
import type { CalendarItem } from './calendarUtils';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled', TENTATIVE: 'Tentative', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
const ORGANISER_KIND_LABEL: Record<string, string> = { IND: 'Individual', SANGA: 'Organisation / Sangha' };
const REPLY_LABEL: Record<string, string> = { PENDING: 'Awaiting reply', CONFIRMED: 'Confirmed', REGRET: 'Regret / declined' };

interface FormState {
  members: string[];
  title: string;
  type: string;
  status: string;
  allDay: boolean;
  startDate: string; startTime: string;
  endDate: string; endTime: string;
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

function fromItem(item: CalendarItem): FormState {
  // Editing an occurrence edits the whole series, so use the series' own dates.
  const s = dayjs(item.seriesStart ?? item.start);
  const e = dayjs(item.seriesEnd ?? item.end);
  return {
    members: item.members ?? [],
    title: item.title,
    type: calendarTypeMeta(item.type).code === 'UNKNOWN' ? CALENDAR_DEFAULT_TYPE : calendarTypeMeta(item.type).code,
    status: item.status ?? 'SCHEDULED',
    allDay: !!item.allDay,
    startDate: s.format('YYYY-MM-DD'), startTime: s.format('HH:mm'),
    endDate: e.format('YYYY-MM-DD'), endTime: e.format('HH:mm'),
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
    members, title: '', type: CALENDAR_DEFAULT_TYPE, status: 'SCHEDULED', allDay,
    startDate: start.format('YYYY-MM-DD'), startTime: start.format('HH:mm'),
    endDate: end.format('YYYY-MM-DD'), endTime: end.format('HH:mm'),
    recurrence: 'NONE', recurrenceUntil: '',
    venue: '', area: '', organizer: '', organizerKind: 'IND',
    contactName: '', contactPhone: '', contact2Name: '', contact2Phone: '',
    attendees: [], description: '',
    role: '', prep: [], prepDone: [], prepNote: '',
    speechNeeded: false, speechKn: '', speechEn: '',
    reply: 'PENDING', publicSchedule: true, writeup: '',
  };
}

export interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing event to edit; omit to create. */
  item?: CalendarItem | null;
  /** Pre-filled slot for a new event. */
  defaults?: { start: Dayjs; end: Dayjs; allDay?: boolean } | null;
}

export function EventDialog({ open, onClose, item, defaults }: EventDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { tCal } = useCalendarReference();
  const defaultCalendars = useDefaultCalendars();
  const editing = !!item?.eventId;
  const [form, setForm] = useState<FormState>(() => blank(dayjs(), dayjs().add(1, 'hour'), false, []));
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      const f = fromItem(item);
      setForm(f);
      setMoreOpen(!!(f.role || f.prep.length || f.prepNote || f.speechNeeded));
      setSocialOpen(!!(f.writeup || f.reply !== 'PENDING' || !f.publicSchedule));
    } else {
      const s = defaults?.start ?? dayjs().add(1, 'hour').startOf('hour');
      const e = defaults?.end ?? s.add(1, 'hour');
      setForm(blank(s, e, !!defaults?.allDay, defaultCalendars));
      setMoreOpen(false);
      setSocialOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, defaults]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const startAt = form.allDay ? dayjs(form.startDate).startOf('day') : dayjs(`${form.startDate}T${form.startTime}`);
  const endAt = form.allDay ? dayjs(form.endDate).endOf('day').millisecond(0) : dayjs(`${form.endDate}T${form.endTime}`);
  const rangeValid = startAt.isValid() && endAt.isValid() && !endAt.isBefore(startAt);
  const canSave = form.title.trim().length > 0 && rangeValid && form.members.length > 0;

  // Keep the end after the start when the start moves.
  const moveStart = (date: string, time: string) => {
    const oldS = form.allDay ? dayjs(form.startDate) : dayjs(`${form.startDate}T${form.startTime}`);
    const oldE = form.allDay ? dayjs(form.endDate) : dayjs(`${form.endDate}T${form.endTime}`);
    const dur = oldE.isValid() && oldS.isValid() ? Math.max(0, oldE.diff(oldS, 'minute')) : 60;
    const ns = dayjs(`${date}T${time || '00:00'}`);
    if (!ns.isValid()) { setForm((f) => ({ ...f, startDate: date, startTime: time })); return; }
    const ne = ns.add(dur, 'minute');
    setForm((f) => ({ ...f, startDate: date, startTime: time, endDate: ne.format('YYYY-MM-DD'), endTime: ne.format('HH:mm') }));
  };

  const togglePrep = (code: string) => {
    const has = form.prep.includes(code);
    setForm((f) => ({
      ...f,
      prep: has ? f.prep.filter((c) => c !== code) : [...f.prep, code],
      prepDone: has ? f.prepDone.filter((c) => c !== code) : f.prepDone,
    }));
  };
  const toggleDone = (code: string) =>
    setForm((f) => ({ ...f, prepDone: f.prepDone.includes(code) ? f.prepDone.filter((c) => c !== code) : [...f.prepDone, code] }));

  // Non-blocking "someone's already committed elsewhere" warning.
  const clashQuery = useQuery({
    queryKey: ['calendar', 'clashes', form.members, startAt.toISOString(), endAt.toISOString(), item?.eventId],
    queryFn: () => checkClashes({
      members: form.members, start: startAt.toISOString(), end: endAt.toISOString(), excludeId: item?.eventId,
    }),
    enabled: rangeValid && form.members.length > 0,
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        members: form.members,
        title: form.title.trim(),
        type: form.type,
        status: form.status,
        allDay: form.allDay,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
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

  const clashes = useMemo(() => clashQuery.data ?? [], [clashQuery.data]);

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>{editing ? 'Edit event' : 'New event'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {editing && item?.isRecurring && (
            <Alert severity="info" icon={<Icon name="Autorenew" />}>This is a repeating event - changes apply to every occurrence.</Alert>
          )}
          {editing && item?.draft && (
            <Alert severity="info">This was added as a Quick Event - fill in the details below to complete it.</Alert>
          )}
          {!!clashes.length && (
            <Alert severity="warning">
              {clashes.map((c) => `${c.memberCode} is already ${c.reason === 'AWAY' ? 'marked away' : 'going to'} "${c.event.title}" at this time.`).join(' ')}
            </Alert>
          )}

          <CalendarsField value={form.members} onChange={(v) => set('members', v)} label="Calendar(s)" />

          <TextField
            autoFocus fullWidth required label="Title" value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Review meeting with PWD engineers"
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Event type</Typography>
            <Stack spacing={1}>
              {CALENDAR_EVENT_GROUPS.map((g) => (
                <Stack key={g.code} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ sm: 'center' }}>
                  <Typography variant="caption" sx={{ width: 84, flexShrink: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                    {tCal(g.label)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {CALENDAR_EVENT_TYPES.filter((t) => t.group === g.code).map((t) => {
                      const selected = form.type === t.code;
                      return (
                        <Chip
                          key={t.code}
                          label={tCal(t.label)}
                          onClick={() => set('type', t.code)}
                          icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color, ml: '8px !important' }} />}
                          variant={selected ? 'filled' : 'outlined'}
                          sx={{
                            bgcolor: selected ? `${t.color}29` : 'transparent',
                            borderColor: selected ? t.color : 'divider',
                            color: selected ? 'text.primary' : 'text.secondary',
                            fontWeight: selected ? 700 : 600,
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2"><Icon name="Event" fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />When</Typography>
              <FormControlLabel
                control={<Switch checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />}
                label="All day"
              />
            </Stack>
            <Grid container spacing={1.5}>
              <Grid item xs={form.allDay ? 6 : 7} sm={form.allDay ? 6 : 3}>
                <TextField
                  fullWidth size="small" type="date" label="Start date" InputLabelProps={{ shrink: true }}
                  value={form.startDate} onChange={(e) => moveStart(e.target.value, form.startTime)}
                />
              </Grid>
              {!form.allDay && (
                <Grid item xs={5} sm={3}>
                  <TextField
                    fullWidth size="small" type="time" label="Start" InputLabelProps={{ shrink: true }}
                    value={form.startTime} onChange={(e) => moveStart(form.startDate, e.target.value)}
                  />
                </Grid>
              )}
              <Grid item xs={form.allDay ? 6 : 7} sm={form.allDay ? 6 : 3}>
                <TextField
                  fullWidth size="small" type="date" label="End date" InputLabelProps={{ shrink: true }}
                  value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
                  error={!rangeValid}
                />
              </Grid>
              {!form.allDay && (
                <Grid item xs={5} sm={3}>
                  <TextField
                    fullWidth size="small" type="time" label="End" InputLabelProps={{ shrink: true }}
                    value={form.endTime} onChange={(e) => set('endTime', e.target.value)}
                    error={!rangeValid}
                  />
                </Grid>
              )}
              {!rangeValid && (
                <Grid item xs={12}><Typography variant="caption" color="error">End must be after the start.</Typography></Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" select label="Repeat" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
                  {CALENDAR_RECURRENCE.map((r) => <MenuItem key={r.code} value={r.code}>{tCal(r.label)}</MenuItem>)}
                </TextField>
              </Grid>
              {form.recurrence !== 'NONE' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" type="date" label="Repeat until (optional)" InputLabelProps={{ shrink: true }}
                    value={form.recurrenceUntil} onChange={(e) => set('recurrenceUntil', e.target.value)}
                    helperText="Leave empty to repeat with no end"
                  />
                </Grid>
              )}
            </Grid>
          </Box>

          <Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Venue" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. MLA Office, Davanagere" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Area / Ward / Village" value={form.area} onChange={(e) => set('area', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" select label="Organiser type" value={form.organizerKind} onChange={(e) => set('organizerKind', e.target.value)}>
                  {CALENDAR_ORGANISER_KINDS.map((k) => <MenuItem key={k} value={k}>{ORGANISER_KIND_LABEL[k]}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth size="small" label="Organiser" value={form.organizer} onChange={(e) => set('organizer', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Contact person" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="Contact phone" value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value.replace(/[^\d+ ]/g, '').slice(0, 15))}
                  inputProps={{ inputMode: 'tel' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="2nd contact person (optional)" value={form.contact2Name} onChange={(e) => set('contact2Name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="2nd contact phone" value={form.contact2Phone}
                  onChange={(e) => set('contact2Phone', e.target.value.replace(/[^\d+ ]/g, '').slice(0, 15))}
                  inputProps={{ inputMode: 'tel' }}
                />
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  multiple freeSolo options={[] as string[]} value={form.attendees}
                  onChange={(_e, v) => set('attendees', (v as string[]).map((s) => s.trim()).filter(Boolean))}
                  renderTags={(value, getTagProps) => value.map((opt, i) => <Chip size="small" label={opt} {...getTagProps({ index: i })} key={`${opt}-${i}`} />)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Attendees" placeholder="Type a name and press Enter" />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline minRows={3} label="Notes / agenda" value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Grid>
              {editing && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {CALENDAR_EVENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
                  </TextField>
                </Grid>
              )}
            </Grid>
          </Box>

          <Accordion expanded={moreOpen} onChange={(_e, exp) => setMoreOpen(exp)} disableGutters sx={{ bgcolor: 'transparent', '&::before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<Icon name="ExpandMore" />} sx={{ px: 0 }}>
              <Typography variant="subtitle2">Role &amp; preparation</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Stack spacing={1.5}>
                <TextField fullWidth size="small" select label="Our role at this event" value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {CALENDAR_ROLE_AT_EVENT.map((r) => <MenuItem key={r} value={r}>{tCal(r.replace(/_/g, ' '))}</MenuItem>)}
                </TextField>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Preparation checklist</Typography>
                  <Grid container spacing={0.5}>
                    {CALENDAR_PREP_ITEMS.map((p) => (
                      <Grid item xs={6} sm={4} key={p}>
                        <Stack direction="row" alignItems="center" spacing={0.25}>
                          <FormControlLabel
                            sx={{ mr: 0.5, flex: 1, '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}
                            control={<Checkbox size="small" checked={form.prep.includes(p)} onChange={() => togglePrep(p)} />}
                            label={tCal(p.replace(/_/g, ' '))}
                          />
                          {form.prep.includes(p) && (
                            <Checkbox size="small" checked={form.prepDone.includes(p)} onChange={() => toggleDone(p)} icon={<Icon name="RadioButtonUnchecked" fontSize="small" />} checkedIcon={<Icon name="TaskAlt" fontSize="small" color="success" />} />
                          )}
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                <TextField fullWidth size="small" label="Preparation note" value={form.prepNote} onChange={(e) => set('prepNote', e.target.value)} />
                <FormControlLabel
                  control={<Switch checked={form.speechNeeded} onChange={(e) => set('speechNeeded', e.target.checked)} />}
                  label="Speech needed"
                />
                {form.speechNeeded && (
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth multiline minRows={3} label="Speech (Kannada)" value={form.speechKn} onChange={(e) => set('speechKn', e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth multiline minRows={3} label="Speech (English)" value={form.speechEn} onChange={(e) => set('speechEn', e.target.value)} />
                    </Grid>
                  </Grid>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion expanded={socialOpen} onChange={(_e, exp) => setSocialOpen(exp)} disableGutters sx={{ bgcolor: 'transparent', '&::before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<Icon name="ExpandMore" />} sx={{ px: 0 }}>
              <Typography variant="subtitle2">Organiser reply &amp; publicity</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Stack spacing={1.5}>
                <TextField fullWidth size="small" select label="Organiser's reply" value={form.reply} onChange={(e) => set('reply', e.target.value)}>
                  {CALENDAR_ORGANISER_REPLY_STATUSES.map((r) => <MenuItem key={r} value={r}>{REPLY_LABEL[r]}</MenuItem>)}
                </TextField>
                <FormControlLabel
                  control={<Switch checked={form.publicSchedule} onChange={(e) => set('publicSchedule', e.target.checked)} />}
                  label="Show on today's public schedule / social media"
                />
                <TextField fullWidth multiline minRows={2} label="Write-up (for social media)" value={form.writeup} onChange={(e) => set('writeup', e.target.value)} />
              </Stack>
            </AccordionDetails>
          </Accordion>
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
