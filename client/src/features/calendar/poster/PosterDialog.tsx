import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, Checkbox, Chip, CircularProgress, FormControlLabel, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  Stack, TextField, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_REAL_CODES, PERMISSIONS, needsKannada, toKannada } from '@mla/shared';
import '@fontsource/baloo-tamma-2/700.css';
import '@fontsource/baloo-tamma-2/800.css';
import '@fontsource/noto-sans-kannada/500.css';
import '@fontsource/noto-sans-kannada/600.css';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { updateEvent } from '../calendarApi';
import { Icon } from '@/components/Icon';
import { expandSessions, rsvpOf, type CalendarItem } from '../calendarUtils';
import {
  POSTER_TEMPLATES, defaultTemplateFor, kannadaDateLine, kannadaTimeLabel, renderPoster, templateThumbUrl, type PosterLine,
} from './posterRender';

/** The posters are the MLA's own ("ಶ್ರೀ ಸಮರ್ಥ್ ಶಾಮನೂರು ಮಲ್ಲಿಕಾರ್ಜುನ್ - ಶಾಸಕರು"), so they list the MLA South calendar. */
const POSTER_CALENDAR = 'MLA_S';

interface Row extends PosterLine {
  key: string; include: boolean; start: string; extra?: boolean; private?: boolean;
  /** The event this line came from, and the Kannada wording saved on it (to know what to save back). */
  eventId?: string; savedTitleKn?: string; savedVenueKn?: string;
  /** Converted automatically from English and not checked yet. */
  auto?: boolean;
  /** Changed by hand in this dialog. */
  edited?: boolean;
}
interface Saved { template?: number; quote?: string; author?: string; rows?: Row[] }

/** Venues on the posters end with a full stop ("..., ದಾವಣಗೆರೆ."). */
const withFullStop = (s: string) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);

const storeKey = (d: Dayjs) => `calendar:poster:${d.format('YYYY-MM-DD')}`;
const LAST_TEMPLATE = 'calendar:poster:lastTemplate';
const readSaved = (d: Dayjs): Saved => { try { return JSON.parse(localStorage.getItem(storeKey(d)) ?? '{}'); } catch { return {}; } };
const writeSaved = (d: Dayjs, s: Saved) => { try { localStorage.setItem(storeKey(d), JSON.stringify(s)); } catch { /* storage unavailable */ } };

/** Turns the day's events into poster lines: MLA South's, not declined, not drafts / away / cancelled. */
function toRows(items: CalendarItem[], day: Dayjs): Row[] {
  return expandSessions(items)
    .filter((i) => i.kind === 'event' && i.members.includes(POSTER_CALENDAR) && !i.draft && i.status !== 'CANCELLED'
      && i.type !== 'UNAVAILABLE' && rsvpOf(i, POSTER_CALENDAR) !== 'NOT_GOING' && dayjs(i.start).isSame(day, 'day'))
    .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || dayjs(a.start).diff(dayjs(b.start)))
    .map((i) => {
      const place = [i.venue, i.area].map((v) => (v ?? '').trim()).filter(Boolean).join(', ');
      // Kannada saved on the event wins; otherwise English is converted automatically (and flagged to check).
      const title = i.titleKn?.trim() || (needsKannada(i.title) ? toKannada(i.title) : i.title);
      const venue = i.venueKn?.trim() || withFullStop(needsKannada(place) ? toKannada(place) : place);
      return {
        key: i.id,
        eventId: i.eventId,
        start: i.start,
        include: i.publicSchedule !== false,
        private: i.publicSchedule === false,
        time: kannadaTimeLabel(dayjs(i.start), !!i.allDay),
        title,
        venue,
        savedTitleKn: i.titleKn ?? '',
        savedVenueKn: i.venueKn ?? '',
        auto: (!i.titleKn?.trim() && needsKannada(i.title)) || (!i.venueKn?.trim() && needsKannada(place)),
      };
    });
}

/** Keeps edits made earlier for this date, adds events created since, drops ones that were deleted. */
function merge(fresh: Row[], saved?: Row[]): Row[] {
  if (!saved?.length) return fresh;
  const byKey = new Map(saved.map((r) => [r.key, r]));
  const freshKeys = new Set(fresh.map((r) => r.key));
  const kept = saved.filter((r) => r.extra || freshKeys.has(r.key));
  const added = fresh.filter((r) => !byKey.has(r.key));
  return [...kept, ...added].sort((a, b) => (a.start && b.start ? dayjs(a.start).diff(dayjs(b.start)) : 0));
}

export function PosterDialog({ open, onClose, date: initialDate }: { open: boolean; onClose: () => void; date: Dayjs }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [date, setDate] = useState(initialDate.startOf('day'));
  const [template, setTemplate] = useState(1);
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fit, setFit] = useState<{ fits: boolean; scale: number } | null>(null);
  const qc = useQueryClient();
  const { can } = useAuth();
  const canSave = can(PERMISSIONS.CALENDAR_MANAGE);
  const [saveToEvents, setSaveToEvents] = useState(() => { try { return localStorage.getItem('calendar:poster:saveKn') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('calendar:poster:saveKn', String(saveToEvents)); } catch { /* ignore */ } }, [saveToEvents]);

  useEffect(() => { if (open) setDate(initialDate.startOf('day')); }, [open, initialDate]);

  const events = useQuery({
    queryKey: ['calendar', 'poster', date.format('YYYY-MM-DD')],
    queryFn: () => api.get('/calendar/events', {
      params: { from: date.toISOString(), to: date.add(1, 'day').toISOString(), members: CALENDAR_REAL_CODES.join(','), includeDeadlines: 'false' },
    }).then((r) => r.data as CalendarItem[]),
    enabled: open,
  });

  // Load (or rebuild) this date's poster whenever the date or its events change.
  useEffect(() => {
    if (!open || !events.data) return;
    const saved = readSaved(date);
    let last = 0;
    try { last = Number(localStorage.getItem(LAST_TEMPLATE)) || 0; } catch { /* ignore */ }
    setTemplate(saved.template ?? (last || defaultTemplateFor(date)));
    setQuote(saved.quote ?? '');
    setAuthor(saved.author ?? '');
    setRows(merge(toRows(events.data, date), saved.rows));
    setReady(true);
  }, [open, events.data, date]);

  // Remember edits for this date.
  useEffect(() => {
    if (!ready) return;
    writeSaved(date, { template, quote, author, rows });
    try { localStorage.setItem(LAST_TEMPLATE, String(template)); } catch { /* ignore */ }
  }, [ready, date, template, quote, author, rows]);

  const lines = useMemo(() => rows.filter((r) => r.include), [rows]);

  // Redraw the preview (debounced while typing).
  useEffect(() => {
    if (!open || !ready || !canvasRef.current) return;
    const t = setTimeout(() => {
      setDrawing(true);
      renderPoster(canvasRef.current!, template, { date, quote, author, lines })
        .then(setFit)
        .catch((e) => enqueueSnackbar(String(e.message ?? e), { variant: 'error' }))
        .finally(() => setDrawing(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, ready, template, date, quote, author, lines, enqueueSnackbar]);

  const changeDate = (d: Dayjs) => { setReady(false); setDate(d.startOf('day')); };
  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Typing in a line marks it as checked by a person.
  const editRow = (key: string, patch: Partial<Row>) => setRow(key, { ...patch, edited: true, auto: false });

  /** Saves corrected Kannada wording onto the events, so the next poster starts from it. */
  const saveWording = async () => {
    if (!saveToEvents || !canSave) return;
    const changed = rows.filter((r) => r.include && r.edited && r.eventId
      && (r.title.trim() !== (r.savedTitleKn ?? '') || r.venue.trim() !== (r.savedVenueKn ?? '')));
    if (!changed.length) return;
    const results = await Promise.allSettled(changed.map((r) => updateEvent(r.eventId!, { titleKn: r.title.trim(), venueKn: r.venue.trim() })));
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    setRows((rs) => rs.map((r) => (changed.some((c) => c.key === r.key) ? { ...r, savedTitleKn: r.title.trim(), savedVenueKn: r.venue.trim(), edited: false } : r)));
    if (ok) {
      enqueueSnackbar(`Kannada wording saved on ${ok} event${ok > 1 ? 's' : ''}`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    }
  };
  const move = (key: string, dir: -1 | 1) => setRows((rs) => {
    const i = rs.findIndex((r) => r.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addRow = () => setRows((rs) => [...rs, { key: `extra:${Date.now()}`, start: '', include: true, extra: true, time: 'ಸಂಜೆ : 06:00 PM', title: '', venue: '' }]);
  const resetDay = () => {
    try { localStorage.removeItem(storeKey(date)); } catch { /* ignore */ }
    if (events.data) setRows(toRows(events.data, date));
    setQuote(''); setAuthor('');
  };

  const fileName = `karyakrama-${date.format('YYYY-MM-DD')}.png`;
  const toBlob = () => new Promise<Blob>((resolve, reject) => canvasRef.current?.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'));
  const download = async () => {
    void saveWording();
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;
  const share = async () => {
    void saveWording();
    try {
      const file = new File([await toBlob()], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: kannadaDateLine(date) });
      else await download();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') enqueueSnackbar('Could not share - downloaded instead', { variant: 'info' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon name="PhotoLibrary" />
          <Box sx={{ flex: 1 }}>Daily programme poster</Box>
          <IconButton onClick={onClose} aria-label="Close"><Icon name="Close" /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ '& .MuiInputBase-input': { fontFamily: '"Noto Sans Kannada", Inter, sans-serif' } }}>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' } }}>
          {/* ------------------------------ controls ------------------------------ */}
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => changeDate(date.subtract(1, 'day'))} aria-label="Previous day"><Icon name="ChevronLeft" /></IconButton>
              <TextField type="date" size="small" value={date.format('YYYY-MM-DD')} onChange={(e) => e.target.value && changeDate(dayjs(e.target.value))} />
              <IconButton onClick={() => changeDate(date.add(1, 'day'))} aria-label="Next day"><Icon name="ChevronRight" /></IconButton>
              <Button size="small" onClick={() => changeDate(dayjs())}>Today</Button>
              <Button size="small" onClick={() => changeDate(dayjs().add(1, 'day'))}>Tomorrow</Button>
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>Design</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, overflowX: 'auto', pb: 0.5 }}>
                {POSTER_TEMPLATES.map((t) => (
                  <ButtonBase
                    key={t.id} onClick={() => setTemplate(t.id)} aria-label={`Design ${t.id}`}
                    sx={{ flexShrink: 0, borderRadius: 1.5, overflow: 'hidden', outline: template === t.id ? `3px solid ${theme.palette.primary.main}` : '1px solid', outlineColor: template === t.id ? 'primary.main' : 'divider', outlineOffset: template === t.id ? 1 : 0 }}
                  >
                    <Box component="img" src={templateThumbUrl(t.id)} alt="" sx={{ width: 64, height: 80, display: 'block' }} />
                  </ButtonBase>
                ))}
              </Stack>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField size="small" fullWidth label="ದಿನದ ಚಿಂತನೆ (quote of the day)" value={quote} onChange={(e) => setQuote(e.target.value)} multiline maxRows={3} />
              <TextField size="small" label="By (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} sx={{ minWidth: { sm: 170 } }} />
            </Stack>

            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Programmes ({lines.length} on the poster)</Typography>
              <Stack direction="row" spacing={0.5}>
                <Button size="small" startIcon={<Icon name="Add" />} onClick={addRow}>Add line</Button>
                <Tooltip title="Forget edits for this date and reload from the calendar"><Button size="small" color="inherit" onClick={resetDay}>Reset</Button></Tooltip>
              </Stack>
            </Stack>
            {events.isLoading && <CircularProgress size={22} />}
            {events.isSuccess && !rows.length && (
              <Alert severity="info">No MLA South programmes on {date.format('ddd D MMM')}. Use "Add line" to type them in.</Alert>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              English titles are converted to Kannada automatically - check names, they are spelt as written in English. Edit any line here.
            </Typography>
            {canSave && (
              <FormControlLabel
                sx={{ mt: -1, '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}
                control={<Checkbox size="small" checked={saveToEvents} onChange={(e) => setSaveToEvents(e.target.checked)} />}
                label="When I download, save my corrected Kannada wording on the events (used next time)"
              />
            )}
            <Stack spacing={1.25}>
              {rows.map((r, idx) => (
                <Box key={r.key} sx={{ p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider', opacity: r.include ? 1 : 0.55 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Checkbox size="small" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} sx={{ p: 0.5 }} />
                    <TextField size="small" label="Time" value={r.time} onChange={(e) => editRow(r.key, { time: e.target.value })} sx={{ width: 210 }} />
                    {r.auto && <Tooltip title="Converted from English automatically - check the spelling of names"><Chip size="small" color="warning" variant="outlined" label="Auto-converted - check" /></Tooltip>}
                    {r.private && <Tooltip title="Marked private in the calendar - left off unless you tick it"><Icon name="Lock" fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>}
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" disabled={idx === 0} onClick={() => move(r.key, -1)} aria-label="Move up"><Icon name="ArrowUpward" fontSize="small" /></IconButton>
                    <IconButton size="small" disabled={idx === rows.length - 1} onClick={() => move(r.key, 1)} aria-label="Move down"><Icon name="ArrowDownward" fontSize="small" /></IconButton>
                    {r.extra && <IconButton size="small" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove"><Icon name="Delete" fontSize="small" /></IconButton>}
                  </Stack>
                  <TextField
                    size="small" fullWidth label="Programme" value={r.title} onChange={(e) => editRow(r.key, { title: e.target.value })} multiline maxRows={3} sx={{ mb: 1 }}
                    InputProps={{ endAdornment: needsKannada(r.title) ? <Button size="small" sx={{ minWidth: 0 }} onClick={() => editRow(r.key, { title: toKannada(r.title) })}>ಕನ್ನಡ</Button> : undefined }}
                  />
                  <TextField
                    size="small" fullWidth label="Venue" value={r.venue} onChange={(e) => editRow(r.key, { venue: e.target.value })} multiline maxRows={2}
                    InputProps={{ endAdornment: needsKannada(r.venue) ? <Button size="small" sx={{ minWidth: 0 }} onClick={() => editRow(r.key, { venue: withFullStop(toKannada(r.venue)) })}>ಕನ್ನಡ</Button> : undefined }}
                  />
                </Box>
              ))}
            </Stack>
          </Stack>

          {/* ------------------------------ preview ------------------------------- */}
          <Box sx={{ position: { md: 'sticky' }, top: 0, alignSelf: 'start' }}>
            {fit && !fit.fits && (
              <Alert severity="warning" sx={{ mb: 1 }}>Too many programmes for one poster - untick some or shorten the text.</Alert>
            )}
            <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', boxShadow: 3, bgcolor: 'action.hover', aspectRatio: '1122 / 1402' }}>
              <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
              {(drawing || !ready) && (
                <Box sx={{ position: 'absolute', top: 10, right: 10 }}><CircularProgress size={20} /></Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              1122 × 1402 PNG · same size as the designer's posters{fit && fit.scale < 1 ? ' · text shrunk to fit' : ''}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
        {canShare && <Button variant="outlined" startIcon={<Icon name="Share" />} onClick={share} disabled={!ready}>Share</Button>}
        <Button variant="contained" startIcon={<Icon name="Download" />} onClick={download} disabled={!ready}>Download PNG</Button>
      </DialogActions>
    </Dialog>
  );
}

export default PosterDialog;
