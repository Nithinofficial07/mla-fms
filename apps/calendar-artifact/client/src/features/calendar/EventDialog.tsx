import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Grid, MenuItem, Stack, Switch, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CALENDAR_DEFAULT_TYPE, CALENDAR_EVENT_GROUPS, CALENDAR_EVENT_STATUSES, CALENDAR_EVENT_TYPES, CALENDAR_RECURRENCE, calendarTypeMeta,
} from '@cal/shared';
import { useCalendarStore } from '@/data/CalendarStore';
import { Icon } from '@/components/Icon';
import type { CalendarItem } from './calendarUtils';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled', TENTATIVE: 'Tentative', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

interface FormState {
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
  contactName: string;
  contactPhone: string;
  attendees: string[];
  description: string;
}

function fromItem(item: CalendarItem): FormState {
  // Editing an occurrence edits the whole series, so use the series' own dates.
  const s = dayjs(item.seriesStart ?? item.start);
  const e = dayjs(item.seriesEnd ?? item.end);
  return {
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
    contactName: item.contactName ?? '',
    contactPhone: item.contactPhone ?? '',
    attendees: item.attendees ?? [],
    description: item.description ?? '',
  };
}

function blank(start: Dayjs, end: Dayjs, allDay: boolean): FormState {
  return {
    title: '', type: CALENDAR_DEFAULT_TYPE, status: 'SCHEDULED', allDay,
    startDate: start.format('YYYY-MM-DD'), startTime: start.format('HH:mm'),
    endDate: end.format('YYYY-MM-DD'), endTime: end.format('HH:mm'),
    recurrence: 'NONE', recurrenceUntil: '',
    venue: '', area: '',
    organizer: '', contactName: '', contactPhone: '', attendees: [], description: '',
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
  const { enqueueSnackbar } = useSnackbar();
  const store = useCalendarStore();
  const [saving, setSaving] = useState(false);
  const editing = !!item?.eventId;
  const [form, setForm] = useState<FormState>(() => blank(dayjs(), dayjs().add(1, 'hour'), false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) setForm(fromItem(item));
    else {
      const s = defaults?.start ?? dayjs().add(1, 'hour').startOf('hour');
      const e = defaults?.end ?? s.add(1, 'hour');
      setForm(blank(s, e, !!defaults?.allDay));
    }
  }, [open, item, defaults]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const startAt = form.allDay ? dayjs(form.startDate).startOf('day') : dayjs(`${form.startDate}T${form.startTime}`);
  const endAt = form.allDay ? dayjs(form.endDate).endOf('day').millisecond(0) : dayjs(`${form.endDate}T${form.endTime}`);
  const rangeValid = startAt.isValid() && endAt.isValid() && !endAt.isBefore(startAt);
  const canSave = form.title.trim().length > 0 && rangeValid;

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

  const areaOptions = [...new Set(store.events.map((e) => e.area).filter(Boolean))].sort();
  const venueOptions = [...new Set(store.events.map((e) => e.venue).filter(Boolean))].sort();

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await store.save(editing ? item!.eventId! : null, {
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
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        attendees: form.attendees,
        description: form.description.trim(),
      });
      enqueueSnackbar(editing ? 'Event updated' : 'Event added to calendar', { variant: 'success' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>{editing ? 'Edit event' : 'New event'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {editing && item?.isRecurring && (
            <Alert severity="info" icon={<Icon name="Autorenew" />}>This is a repeating event - changes apply to every occurrence.</Alert>
          )}

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
                    {g.label}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {CALENDAR_EVENT_TYPES.filter((t) => t.group === g.code).map((t) => {
                      const selected = form.type === t.code;
                      return (
                        <Chip
                          key={t.code}
                          label={t.label}
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {(() => { const m = calendarTypeMeta(form.type); return `${m.colorName} · ${m.hint}`; })()}
            </Typography>
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
                  {CALENDAR_RECURRENCE.map((r) => <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>)}
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
            <Grid item xs={12} sm={7}>
              <Autocomplete
                freeSolo options={venueOptions} value={form.venue}
                onInputChange={(_e, v) => set('venue', v)}
                renderInput={(params) => <TextField {...params} size="small" label="Venue" placeholder="e.g. MLA Office, Davanagere" />}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <Autocomplete
                freeSolo options={areaOptions} value={form.area}
                onInputChange={(_e, v) => set('area', v)}
                renderInput={(params) => <TextField {...params} size="small" label="Ward / Village" placeholder="e.g. Ward 09, Battlakatte" />}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Organiser" value={form.organizer} onChange={(e) => set('organizer', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Contact person" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Contact phone" value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value.replace(/[^\d+ ]/g, '').slice(0, 15))}
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={doSave} disabled={!canSave || saving} startIcon={<Icon name="CheckCircle" />}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add event'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { STATUS_LABEL };
