import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, Card, CardContent, Checkbox, FormControlLabel, Grid, IconButton, LinearProgress, ListItemIcon,
  ListItemText, Menu, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_EVENT_GROUPS, CALENDAR_EVENT_TYPES } from '@cal/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { useCalendarStore } from '@/data/CalendarStore';
import { AgendaView, MiniCalendar, MonthView, TimeGridView, itemColor } from './CalendarViews';
import { EventDialog } from './EventDialog';
import { EventDetailsDialog } from './EventDetailsDialog';
import { dayScheduleText, eventsToIcs, itemsToCsv } from './exporters';
import {
  expandToItems, onDay, rangeTitle, stepDate, timeLabel, viewRange, type CalendarItem, type CalendarView,
} from './calendarUtils';

const VIEWS: { value: CalendarView; label: string; icon: string; key: string }[] = [
  { value: 'month', label: 'Month', icon: 'ViewModule', key: 'm' },
  { value: 'week', label: 'Week', icon: 'ViewKanban', key: 'w' },
  { value: 'day', label: 'Day', icon: 'Today', key: 'd' },
  { value: 'agenda', label: 'Agenda', icon: 'ViewList', key: 'a' },
];
const ALL_TYPES = CALENDAR_EVENT_TYPES.map((t) => t.code as string);
const PREFS_KEY = 'calendar:prefs';

function readPrefs(): { hidden: string[] } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return { hidden: Array.isArray(p.hidden) ? p.hidden.filter((c: string) => ALL_TYPES.includes(c)) : [] };
  } catch {
    return { hidden: [] };
  }
}

/** The view lives in the URL hash (#month, #week, #day, #agenda) so it survives a reload. */
function readHashView(fallback: CalendarView): CalendarView {
  const h = window.location.hash.replace('#', '');
  return (VIEWS.some((v) => v.value === h) ? h : fallback) as CalendarView;
}

function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable || !!el.closest('[role="dialog"]');
}

function StatTile({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.14), color, flexShrink: 0 }}>
        <Icon name={icon} fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap component="div">{label}</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      </Box>
    </Stack>
  );
}

export function CalendarPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const store = useCalendarStore();
  const canManage = store.canEdit;

  const [view, setView] = useState<CalendarView>(() => readHashView(isMobile ? 'agenda' : 'month'));
  const [date, setDate] = useState<Dayjs>(() => dayjs().startOf('day'));
  useEffect(() => {
    const onHash = () => setView((v) => readHashView(v));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setNav = (next: { view?: CalendarView; date?: Dayjs }) => {
    if (next.date) setDate(next.date.startOf('day'));
    if (next.view && next.view !== view) {
      setView(next.view);
      try { history.replaceState(null, '', `#${next.view}`); } catch { /* sandboxed */ }
    }
  };

  const [prefs, setPrefs] = useState(readPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);
  const visibleEvents = useMemo(
    () => store.events.filter((e) => !prefs.hidden.includes(e.type) || !ALL_TYPES.includes(e.type)),
    [store.events, prefs.hidden],
  );

  const { from, to } = viewRange(view, date);
  const items = useMemo(() => expandToItems(visibleEvents, from, to), [visibleEvents, from.valueOf(), to.valueOf()]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sidebar's "coming up" list and the stat tiles always look at today -> +7 days.
  const todayStart = dayjs().startOf('day');
  const upcomingItems = useMemo(() => expandToItems(visibleEvents, todayStart, todayStart.add(7, 'day')), [visibleEvents, todayStart.valueOf()]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayCount = upcomingItems.filter((i) => onDay(i, todayStart)).length;
  const weekCount = upcomingItems.length;
  const nextUp = upcomingItems
    .filter((i) => i.status !== 'CANCELLED' && dayjs(i.end).isAfter(dayjs()))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 6);
  const loaded = store.status === 'ready' || store.events.length > 0;

  // Mini calendar dots for its visible month.
  const [miniMonth, setMiniMonth] = useState(date.startOf('month'));
  useEffect(() => { setMiniMonth(date.startOf('month')); }, [date]);
  const markedDays = useMemo(() => {
    const r = viewRange('month', miniMonth);
    const set = new Set<string>();
    for (const it of expandToItems(visibleEvents, r.from, r.to)) {
      let d = dayjs(it.start).startOf('day');
      const end = dayjs(it.end);
      for (let g = 0; g < 45 && !d.isAfter(end); g++) { set.add(d.format('YYYY-MM-DD')); d = d.add(1, 'day'); }
    }
    return set;
  }, [visibleEvents, miniMonth]);

  // Export menu
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const copyDay = async () => {
    const today = dayjs();
    const day = view === 'day' || !(today.isAfter(from) && today.isBefore(to)) ? date : today;
    const text = dayScheduleText(day, expandToItems(visibleEvents, day.startOf('day'), day.startOf('day').add(1, 'day')));
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(`Schedule for ${day.format('D MMM')} copied - paste it in WhatsApp`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Copy was blocked by the browser. Try again from the button.', { variant: 'warning' });
    }
  };
  const download = async (kind: 'csv' | 'ics') => {
    setExportAnchor(null);
    if (!store.downloads) return;
    try {
      if (kind === 'csv') {
        await store.downloads.save({
          filename: `MLA-schedule-${from.format('YYYY-MM-DD')}-to-${to.subtract(1, 'day').format('YYYY-MM-DD')}.csv`,
          data: new Blob([itemsToCsv([...items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)))], { type: 'text/csv;charset=utf-8' }),
        });
      } else {
        await store.downloads.save({ filename: 'MLA-office-calendar.ics', data: new Blob([eventsToIcs(store.events)], { type: 'text/calendar' }) });
      }
    } catch { /* viewer declined */ }
  };

  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [editor, setEditor] = useState<{ item?: CalendarItem | null; defaults?: { start: Dayjs; end: Dayjs; allDay?: boolean } | null } | null>(null);

  const onSlot = canManage
    ? (start: Dayjs, end: Dayjs, allDay: boolean) => setEditor({ defaults: { start, end, allDay } })
    : undefined;
  const newEvent = () => {
    const base = date.isSame(dayjs(), 'day') ? dayjs().add(1, 'hour').startOf('hour') : date.hour(10);
    setEditor({ defaults: { start: base, end: base.add(1, 'hour') } });
  };

  // Keyboard: T today, ←/→ step, M/W/D/A views, N new event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 't') setNav({ date: dayjs() });
      else if (e.key === 'ArrowLeft') setNav({ date: stepDate(view, date, -1) });
      else if (e.key === 'ArrowRight') setNav({ date: stepDate(view, date, 1) });
      else if (k === 'n' && canManage) { e.preventDefault(); newEvent(); }
      else {
        const v = VIEWS.find((x) => x.key === k);
        if (v) setNav({ view: v.value });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleType = (code: string) =>
    setPrefs((p) => ({ ...p, hidden: p.hidden.includes(code) ? p.hidden.filter((c) => c !== code) : [...p.hidden, code] }));

  const showDay = (d: Dayjs) => setNav({ view: 'day', date: d });

  return (
    <Box>
      <PageHeader
        title="MLA Office Calendar"
        subtitle="Davanagere South - meetings, events, site visits and Jana Samparka"
        action={(
          <Stack direction="row" spacing={1}>
            <Tooltip title="Copy the day's schedule as text (for WhatsApp)">
              {isMobile ? (
                <IconButton onClick={copyDay} aria-label="Copy day schedule" sx={{ border: 1, borderColor: 'divider' }}><Icon name="ContentCopy" /></IconButton>
              ) : (
                <Button variant="outlined" startIcon={<Icon name="ContentCopy" />} onClick={copyDay}>Copy day</Button>
              )}
            </Tooltip>
            {store.downloads && (
              <>
                {isMobile ? (
                  <IconButton onClick={(e) => setExportAnchor(e.currentTarget)} aria-label="Export" sx={{ border: 1, borderColor: 'divider' }}><Icon name="Download" /></IconButton>
                ) : (
                  <Button variant="outlined" startIcon={<Icon name="Download" />} onClick={(e) => setExportAnchor(e.currentTarget)}>Export</Button>
                )}
                <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
                  <MenuItem onClick={() => download('csv')}>
                    <ListItemIcon><Icon name="TableView" /></ListItemIcon>
                    <ListItemText primary="Excel (CSV) - this view" secondary={rangeTitle(view, date)} />
                  </MenuItem>
                  <MenuItem onClick={() => download('ics')}>
                    <ListItemIcon><Icon name="Event" /></ListItemIcon>
                    <ListItemText primary="Phone / Google Calendar (.ics)" secondary="All events, with repeats" />
                  </MenuItem>
                </Menu>
              </>
            )}
            {canManage && (
              <Button variant="contained" startIcon={<Icon name="Add" />} onClick={newEvent}>New Event</Button>
            )}
          </Stack>
        )}
      />

      {store.status === 'offline' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The calendar's saved events can't be reached here. Open it on claude.ai while signed in to see and add events.
        </Alert>
      )}
      {store.status === 'slow' && (
        <Alert severity="info" sx={{ mb: 2 }}>Still connecting to the calendar - events will appear as soon as it answers.</Alert>
      )}
      {store.status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>Lost connection to the calendar. Reopen the page to reconnect.</Alert>
      )}
      {!canManage && store.status === 'ready' && (
        <Alert severity="info" icon={<Icon name="Visibility" />} sx={{ mb: 2 }}>
          You can view this calendar. To add or change events, ask the owner to give you Contributor access.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* ------------------------------ sidebar ------------------------------ */}
        {!isNarrow && (
          <Grid item md={3}>
            <Stack spacing={2} sx={{ position: 'sticky', top: 88 }}>
              <Card sx={{ '&:hover': { transform: 'none' } }}>
                <CardContent>
                  <MiniCalendar
                    value={date}
                    onChange={(d) => setNav({ date: d })}
                    markedDays={markedDays}
                    onMonthChange={setMiniMonth}
                  />
                </CardContent>
              </Card>

              <Card sx={{ '&:hover': { transform: 'none' } }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2">Show</Typography>
                    <Button
                      size="small" sx={{ minWidth: 0, px: 1, py: 0 }}
                      onClick={() => setPrefs((p) => ({ ...p, hidden: p.hidden.length ? [] : [...ALL_TYPES] }))}
                    >
                      {prefs.hidden.length ? 'All' : 'None'}
                    </Button>
                  </Stack>
                  <Stack spacing={0.75}>
                    {CALENDAR_EVENT_GROUPS.map((g) => (
                      <Box key={g.code}>
                        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', fontSize: 10.5 }}>
                          {g.label}
                        </Typography>
                        <Stack>
                          {CALENDAR_EVENT_TYPES.filter((t) => t.group === g.code).map((t) => (
                            <Tooltip key={t.code} title={`${t.colorName} · ${t.hint}`} placement="right">
                              <FormControlLabel
                                sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 500 } }}
                                control={(
                                  <Checkbox
                                    size="small" checked={!prefs.hidden.includes(t.code)} onChange={() => toggleType(t.code)}
                                    sx={{ py: 0.3, color: t.color, '&.Mui-checked': { color: t.color } }}
                                  />
                                )}
                                label={t.label}
                              />
                            </Tooltip>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ '&:hover': { transform: 'none' } }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Coming up</Typography>
                  {nextUp.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Nothing in the next 7 days.</Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {nextUp.map((it) => (
                        <ButtonBase
                          key={it.id} onClick={() => setSelected(it)}
                          sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1.25, p: 0.75, mx: -0.75, borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: itemColor(it), flexShrink: 0 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{it.title}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap component="div">
                              {dayjs(it.start).isSame(dayjs(), 'day') ? 'Today' : dayjs(it.start).isSame(dayjs().add(1, 'day'), 'day') ? 'Tomorrow' : dayjs(it.start).format('ddd D MMM')}
                              {' · '}{timeLabel(it)}
                            </Typography>
                          </Box>
                        </ButtonBase>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        )}

        {/* ------------------------------- main -------------------------------- */}
        <Grid item xs={12} md={isNarrow ? 12 : 9}>
          <Stack direction="row" spacing={{ xs: 2, sm: 4 }} sx={{ mb: 2, px: 0.5, overflowX: 'auto' }}>
            <StatTile label="Today" value={loaded ? todayCount : '—'} icon="Today" color={theme.palette.secondary.main} />
            <StatTile label={isMobile ? '7 days' : 'Next 7 days'} value={loaded ? weekCount : '—'} icon="Event" color={theme.palette.info.main} />
            <StatTile label={isMobile ? 'Total' : 'Events saved'} value={loaded ? store.events.length : '—'} icon="FolderCopy" color={theme.palette.success.main} />
          </Stack>

          <Card sx={{ overflow: 'hidden', '&:hover': { transform: 'none' } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between"
              sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Button variant="outlined" size="small" onClick={() => setNav({ date: dayjs() })}>Today</Button>
                <Tooltip title="Previous (←)">
                  <IconButton size="small" onClick={() => setNav({ date: stepDate(view, date, -1) })} aria-label="Previous"><Icon name="ChevronLeft" /></IconButton>
                </Tooltip>
                <Tooltip title="Next (→)">
                  <IconButton size="small" onClick={() => setNav({ date: stepDate(view, date, 1) })} aria-label="Next"><Icon name="ChevronRight" /></IconButton>
                </Tooltip>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700, ml: 0.5 }}>{rangeTitle(view, date)}</Typography>
              </Stack>
              {isMobile ? (
                <TextField select size="small" value={view} onChange={(e) => setNav({ view: e.target.value as CalendarView })}>
                  {VIEWS.map((v) => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
                </TextField>
              ) : (
                <ToggleButtonGroup
                  size="small" exclusive value={view} onChange={(_e, v) => v && setNav({ view: v })}
                  sx={{ '& .MuiToggleButton-root': { px: 1.5, textTransform: 'none', fontWeight: 600, gap: 0.75 } }}
                >
                  {VIEWS.map((v) => (
                    <ToggleButton key={v.value} value={v.value}>
                      <Icon name={v.icon} fontSize="small" />{v.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </Stack>
            <Box sx={{ height: 3 }}>{store.status === 'connecting' && <LinearProgress color="secondary" sx={{ height: 3 }} />}</Box>

            {view === 'month' && <MonthView date={date} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} />}
            {view === 'week' && <TimeGridView date={date} days={7} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} />}
            {view === 'day' && <TimeGridView date={date} days={1} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} />}
            {view === 'agenda' && <AgendaView date={date} items={items} onSelect={setSelected} />}
          </Card>

          {isNarrow && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {CALENDAR_EVENT_TYPES.map((t) => {
                const on = !prefs.hidden.includes(t.code);
                return (
                  <ButtonBase
                    key={t.code} onClick={() => toggleType(t.code)}
                    sx={{ gap: 0.75, px: 1, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, opacity: on ? 1 : 0.45, border: 1, borderColor: 'divider' }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color }} />{t.label}
                  </ButtonBase>
                );
              })}
            </Stack>
          )}
        </Grid>
      </Grid>

      <EventDetailsDialog
        item={selected}
        canManage={canManage}
        onClose={() => setSelected(null)}
        onEdit={(it) => { setSelected(null); setEditor({ item: it }); }}
      />
      <EventDialog
        open={!!editor}
        item={editor?.item}
        defaults={editor?.defaults}
        onClose={() => setEditor(null)}
      />
    </Box>
  );
}
