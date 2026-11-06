import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, ButtonBase, Card, CardContent, Checkbox, FormControlLabel, Grid, IconButton, LinearProgress, MenuItem,
  Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_DEADLINE_COLOR, CALENDAR_EVENT_TYPES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { RequestDetailDialog } from '../requests/RequestDetailDialog';
import { AgendaView, MiniCalendar, MonthView, TimeGridView, itemColor } from './CalendarViews';
import { EventDialog } from './EventDialog';
import { EventDetailsDialog } from './EventDetailsDialog';
import { onDay, rangeTitle, stepDate, timeLabel, viewRange, type CalendarItem, type CalendarView } from './calendarUtils';

const VIEWS: { value: CalendarView; label: string; icon: string; key: string }[] = [
  { value: 'month', label: 'Month', icon: 'ViewModule', key: 'm' },
  { value: 'week', label: 'Week', icon: 'ViewKanban', key: 'w' },
  { value: 'day', label: 'Day', icon: 'Today', key: 'd' },
  { value: 'agenda', label: 'Agenda', icon: 'ViewList', key: 'a' },
];
const ALL_TYPES = CALENDAR_EVENT_TYPES.map((t) => t.code as string);
const PREFS_KEY = 'calendar:prefs';

function readPrefs(): { hidden: string[]; deadlines: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return { hidden: Array.isArray(p.hidden) ? p.hidden : [], deadlines: p.deadlines !== false };
  } catch {
    return { hidden: [], deadlines: true };
  }
}

function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable || !!el.closest('[role="dialog"]');
}

/** Fetches every occurrence (and optionally request deadlines) overlapping [from, to). */
function useCalendarItems(from: Dayjs, to: Dayjs, types: string[], deadlines: boolean, enabled = true) {
  const allTypes = types.length === ALL_TYPES.length;
  const params = {
    from: from.toISOString(),
    to: to.toISOString(),
    types: allTypes ? undefined : types.join(',') || 'NONE',
    includeDeadlines: deadlines ? 'true' : 'false',
  };
  return useQuery({
    queryKey: ['calendar', 'events', params],
    queryFn: () => api.get('/calendar/events', { params }).then((r) => r.data as CalendarItem[]),
    placeholderData: keepPreviousData,
    enabled,
  });
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
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.CALENDAR_MANAGE);
  const canSeeRequests = can(PERMISSIONS.REQUEST_VIEW);
  const [sp, setSp] = useSearchParams();

  const view = (VIEWS.some((v) => v.value === sp.get('view')) ? sp.get('view') : isMobile ? 'agenda' : 'month') as CalendarView;
  const date = useMemo(() => {
    const d = dayjs(sp.get('date') ?? undefined);
    return d.isValid() ? d.startOf('day') : dayjs().startOf('day');
  }, [sp]);

  const setNav = (next: { view?: CalendarView; date?: Dayjs }) => {
    const p = new URLSearchParams(sp);
    p.set('view', next.view ?? view);
    p.set('date', (next.date ?? date).format('YYYY-MM-DD'));
    setSp(p, { replace: true });
  };

  const [prefs, setPrefs] = useState(readPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);
  const visibleTypes = ALL_TYPES.filter((t) => !prefs.hidden.includes(t));
  const showDeadlines = prefs.deadlines && canSeeRequests;

  const { from, to } = viewRange(view, date);
  const events = useCalendarItems(from, to, visibleTypes, showDeadlines);
  // All-day first, then by start time - the views render in this order.
  const items = useMemo(
    () => [...(events.data ?? [])].sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || dayjs(a.start).diff(dayjs(b.start))),
    [events.data],
  );

  // The sidebar's "coming up" list and the stat tiles always look at today -> +7 days.
  const todayStart = dayjs().startOf('day');
  const upcoming = useCalendarItems(todayStart, todayStart.add(7, 'day'), visibleTypes, showDeadlines);
  const upcomingItems = upcoming.data ?? [];
  const todayCount = upcomingItems.filter((i) => onDay(i, todayStart) && i.kind === 'event').length;
  const weekCount = upcomingItems.filter((i) => i.kind === 'event').length;
  const deadlineCount = upcomingItems.filter((i) => i.kind === 'deadline').length;
  const nextUp = upcomingItems
    .filter((i) => i.kind === 'event' && i.status !== 'CANCELLED' && dayjs(i.end).isAfter(dayjs()))
    .slice(0, 6);

  // Mini calendar dots for its visible month.
  const [miniMonth, setMiniMonth] = useState(date.startOf('month'));
  useEffect(() => { setMiniMonth(date.startOf('month')); }, [date]);
  const miniRange = viewRange('month', miniMonth);
  const miniItems = useCalendarItems(miniRange.from, miniRange.to, visibleTypes, showDeadlines, !isNarrow);
  const markedDays = useMemo(() => {
    const s = new Set<string>();
    for (const it of miniItems.data ?? []) {
      let d = dayjs(it.start).startOf('day');
      const end = dayjs(it.end);
      for (let g = 0; g < 45 && !d.isAfter(end); g++) { s.add(d.format('YYYY-MM-DD')); d = d.add(1, 'day'); }
    }
    return s;
  }, [miniItems.data]);

  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [editor, setEditor] = useState<{ item?: CalendarItem | null; defaults?: { start: Dayjs; end: Dayjs; allDay?: boolean } | null } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

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
        title="Calendar"
        subtitle="MLA schedule - meetings, site visits, public events and request deadlines"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Calendar' }]}
        action={canManage && (
          <Button variant="contained" startIcon={<Icon name="Add" />} onClick={newEvent}>New Event</Button>
        )}
      />

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
                  <Stack>
                    {CALENDAR_EVENT_TYPES.map((t) => (
                      <FormControlLabel
                        key={t.code}
                        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 500 } }}
                        control={(
                          <Checkbox
                            size="small" checked={!prefs.hidden.includes(t.code)} onChange={() => toggleType(t.code)}
                            sx={{ py: 0.4, color: t.color, '&.Mui-checked': { color: t.color } }}
                          />
                        )}
                        label={t.label}
                      />
                    ))}
                  </Stack>
                  {canSeeRequests && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <FormControlLabel
                        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                        control={(
                          <Switch
                            size="small" checked={prefs.deadlines}
                            onChange={(e) => setPrefs((p) => ({ ...p, deadlines: e.target.checked }))}
                            sx={{ '& .Mui-checked .MuiSwitch-thumb': { color: CALENDAR_DEADLINE_COLOR }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${CALENDAR_DEADLINE_COLOR} !important` } }}
                          />
                        )}
                        label="Request deadlines"
                      />
                    </Box>
                  )}
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
            <StatTile label="Today" value={upcoming.data ? todayCount : '—'} icon="Today" color={theme.palette.secondary.main} />
            <StatTile label={isMobile ? '7 days' : 'Next 7 days'} value={upcoming.data ? weekCount : '—'} icon="Event" color={theme.palette.info.main} />
            {showDeadlines && <StatTile label={isMobile ? 'Due' : 'Requests due (7 days)'} value={upcoming.data ? deadlineCount : '—'} icon="Flag" color={CALENDAR_DEADLINE_COLOR} />}
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
            <Box sx={{ height: 3 }}>{events.isFetching && <LinearProgress color="secondary" sx={{ height: 3 }} />}</Box>

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
              {canSeeRequests && (
                <ButtonBase
                  onClick={() => setPrefs((p) => ({ ...p, deadlines: !p.deadlines }))}
                  sx={{ gap: 0.75, px: 1, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, opacity: prefs.deadlines ? 1 : 0.45, border: 1, borderColor: 'divider' }}
                >
                  <Icon name="Flag" sx={{ fontSize: 13, color: CALENDAR_DEADLINE_COLOR }} />Request deadlines
                </ButtonBase>
              )}
            </Stack>
          )}
        </Grid>
      </Grid>

      <EventDetailsDialog
        item={selected}
        canManage={canManage}
        onClose={() => setSelected(null)}
        onEdit={(it) => { setSelected(null); setEditor({ item: it }); }}
        onOpenRequest={(id) => { setSelected(null); if (isMobile) navigate(`/requests/${id}`); else setRequestId(id); }}
      />
      <EventDialog
        open={!!editor}
        item={editor?.item}
        defaults={editor?.defaults}
        onClose={() => setEditor(null)}
      />
      <RequestDetailDialog id={requestId} onClose={() => setRequestId(null)} />
    </Box>
  );
}
