import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge, Box, Button, ButtonBase, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, FormControlLabel, GlobalStyles, Grid,
  IconButton, LinearProgress, ListSubheader, Menu, MenuItem, Stack, Switch, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip,
  Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CALENDAR_DEADLINE_COLOR, CALENDAR_EVENT_GROUPS, CALENDAR_EVENT_TYPES, CALENDAR_REAL_CODES, PERMISSIONS,
} from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { downloadViaApi } from '@/lib/download';
import { RequestDetailDialog } from '../requests/RequestDetailDialog';
import { AgendaView, MemberBadges, MiniCalendar, MonthView, TimeGridView, YearView, itemColor } from './CalendarViews';
import { EventDialog } from './EventDialog';
import { EventDetailsDialog } from './EventDetailsDialog';
import {
  AdminCalendarDialog, AwayDialog, ImportGoogleCalendarDialog, QuickEventDialog, WorkListsDialog,
} from './CalendarExtras';
import { ReportsPanel, SearchDialog, SocialMediaPanel } from './CalendarPanels';
import { CalendarsField } from './CalendarsField';
import { fetchWorkLists, type WorkLists } from './calendarApi';
import { useCalendarReference } from './useCalendarReference';
import {
  allDeclined, expandSessions, holidayItems, onDay, rangeTitle, stepDate, timeLabel, viewRange, type CalendarItem, type CalendarView,
} from './calendarUtils';

const VIEWS: { value: CalendarView; label: string; icon: string; key: string }[] = [
  { value: 'year', label: 'Year', icon: 'CalendarMonth', key: 'y' },
  { value: 'month', label: 'Month', icon: 'ViewModule', key: 'm' },
  { value: 'week', label: 'Week', icon: 'ViewWeek', key: 'w' },
  { value: 'day', label: 'Day', icon: 'ViewDay', key: 'd' },
  { value: 'agenda', label: 'Agenda', icon: 'ViewList', key: 'a' },
];
const ALL_TYPES = CALENDAR_EVENT_TYPES.map((t) => t.code as string);
const PREFS_KEY = 'calendar:prefs';
const DEFAULT_HOLIDAYS = ['CENTRAL', 'KARNATAKA'];
type PageTab = 'calendar' | 'social' | 'reports';

interface Prefs { hidden: string[]; deadlines: boolean; calendars: string[]; holidays: string[]; hideNotGoing: boolean; sideBySide: boolean }

function readPrefs(): Prefs {
  const fallback: Prefs = { hidden: [], deadlines: true, calendars: [...CALENDAR_REAL_CODES], holidays: DEFAULT_HOLIDAYS, hideNotGoing: false, sideBySide: true };
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      hidden: Array.isArray(p.hidden) ? p.hidden.filter((c: string) => ALL_TYPES.includes(c)) : [],
      deadlines: p.deadlines !== false,
      calendars: Array.isArray(p.calendars) && p.calendars.length ? p.calendars.filter((c: string) => (CALENDAR_REAL_CODES as readonly string[]).includes(c)) : [...CALENDAR_REAL_CODES],
      holidays: Array.isArray(p.holidays) ? p.holidays.filter((c: unknown) => typeof c === 'string') : DEFAULT_HOLIDAYS,
      hideNotGoing: p.hideNotGoing === true,
      sideBySide: p.sideBySide !== false,
    };
  } catch {
    return fallback;
  }
}

function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable || !!el.closest('[role="dialog"]');
}

/**
 * Fetches every occurrence (and optionally request deadlines) overlapping [from, to).
 * Long ranges (the Year view) are split into ≤ 92-day chunks - the server caps one request at 120 days.
 */
function useCalendarItems(from: Dayjs, to: Dayjs, types: string[], calendars: string[], deadlines: boolean, enabled = true) {
  const allTypes = types.length === ALL_TYPES.length;
  const chunks: [Dayjs, Dayjs][] = [];
  for (let a = from; a.isBefore(to); a = a.add(92, 'day')) {
    const b = a.add(92, 'day');
    chunks.push([a, b.isAfter(to) ? to : b]);
  }
  const results = useQueries({
    queries: chunks.map(([a, b]) => {
      const params = {
        from: a.toISOString(),
        to: b.toISOString(),
        types: allTypes ? undefined : types.join(',') || 'NONE',
        members: calendars.join(',') || 'NONE',
        includeDeadlines: deadlines ? 'true' : 'false',
      };
      return {
        queryKey: ['calendar', 'events', params],
        queryFn: () => api.get('/calendar/events', { params }).then((r) => r.data as CalendarItem[]),
        placeholderData: keepPreviousData,
        enabled,
      };
    }),
  });
  const ready = results.every((r) => r.data);
  const data = useMemo(() => {
    if (!ready) return undefined;
    const seen = new Set<string>();
    return results.flatMap((r) => r.data ?? []).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [ready, ...results.map((r) => r.dataUpdatedAt)]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, isFetching: results.some((r) => r.isFetching) };
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

/** Holiday / world-day popup (holidays aren't events, so they get their own small card). */
function HolidayDialog({ item, sources, onClose }: { item: CalendarItem | null; sources: { code: string; label: string; color: string; note: string }[]; onClose: () => void }) {
  if (!item) return null;
  const src = sources.find((s) => s.code === item.holidaySource);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <Box sx={{ height: 6, bgcolor: itemColor(item) }} />
      <DialogContent>
        <Typography variant="overline" sx={{ color: itemColor(item), fontWeight: 800 }}>{src?.label ?? 'Holiday'}</Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.3 }}>{item.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{dayjs(item.start).format('dddd, D MMMM YYYY')}</Typography>
        {(item.note || src?.note) && <Typography variant="body2" sx={{ mt: 1.5 }}>{item.note || src?.note}</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

/** Blurs the calendar while the tab is in the background; printing is blocked. */
function useConfidentialLock() {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const onVis = () => { if (document.hidden) setLocked(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return { locked, unlock: () => setLocked(false) };
}

export function CalendarPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.CALENDAR_MANAGE);
  const canAdmin = can(PERMISSIONS.CALENDAR_ADMIN);
  const canSeeRequests = can(PERMISSIONS.REQUEST_VIEW);
  const ref = useCalendarReference();
  const { tCal } = ref;
  const holidaySources = ref.data?.holidaySources ?? [];
  const [sp, setSp] = useSearchParams();
  const { locked, unlock } = useConfidentialLock();

  const tab = (['calendar', 'social', 'reports'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'calendar') as PageTab;
  const view = (VIEWS.some((v) => v.value === sp.get('view')) ? sp.get('view') : isMobile ? 'agenda' : 'month') as CalendarView;
  const date = useMemo(() => {
    const d = dayjs(sp.get('date') ?? undefined);
    return d.isValid() ? d.startOf('day') : dayjs().startOf('day');
  }, [sp]);

  const setNav = (next: { view?: CalendarView; date?: Dayjs; tab?: PageTab }) => {
    const p = new URLSearchParams(sp);
    p.set('view', next.view ?? view);
    p.set('date', (next.date ?? date).format('YYYY-MM-DD'));
    const t = next.tab ?? tab;
    if (t === 'calendar') p.delete('tab'); else p.set('tab', t);
    setSp(p, { replace: true });
  };

  const [prefs, setPrefs] = useState(readPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);
  const visibleTypes = ALL_TYPES.filter((t) => !prefs.hidden.includes(t));
  const showDeadlines = prefs.deadlines && canSeeRequests;

  // Applied to every fetched list: multi-day sessions split per day, "not going" hidden if asked.
  const prepare = (list: CalendarItem[] | undefined) =>
    expandSessions(list ?? []).filter((i) => !(prefs.hideNotGoing && i.kind === 'event' && allDeclined(i)));

  const { from, to } = viewRange(view, date);
  const events = useCalendarItems(from, to, visibleTypes, prefs.calendars, showDeadlines, tab === 'calendar');
  const items = useMemo(
    () => [...prepare(events.data), ...holidayItems(ref.data, from, to, prefs.holidays)]
      .sort((a, b) => Number(b.kind === 'holiday') - Number(a.kind === 'holiday') || Number(!!b.allDay) - Number(!!a.allDay) || dayjs(a.start).diff(dayjs(b.start))),
    [events.data, ref.data, prefs.holidays, prefs.hideNotGoing, from.valueOf(), to.valueOf()], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The sidebar's "coming up" list and the stat tiles always look at today -> +7 days.
  const todayStart = dayjs().startOf('day');
  const upcoming = useCalendarItems(todayStart, todayStart.add(7, 'day'), visibleTypes, prefs.calendars, showDeadlines);
  const upcomingItems = prepare(upcoming.data);
  const todayCount = upcomingItems.filter((i) => onDay(i, todayStart) && i.kind === 'event').length;
  const weekCount = upcomingItems.filter((i) => i.kind === 'event').length;
  const deadlineCount = upcomingItems.filter((i) => i.kind === 'deadline').length;
  const nextUp = upcomingItems
    .filter((i) => i.kind === 'event' && i.status !== 'CANCELLED' && dayjs(i.end).isAfter(dayjs()))
    .slice(0, 6);

  // Work-list counts for the header buttons.
  const work = useQuery({ queryKey: ['calendar', 'worklists'], queryFn: fetchWorkLists, staleTime: 60_000 });

  // Mini calendar dots for its visible month.
  const [miniMonth, setMiniMonth] = useState(date.startOf('month'));
  useEffect(() => { setMiniMonth(date.startOf('month')); }, [date]);
  const miniRange = viewRange('month', miniMonth);
  const miniItems = useCalendarItems(miniRange.from, miniRange.to, visibleTypes, prefs.calendars, showDeadlines, !isNarrow);
  const markedDays = useMemo(() => {
    const s = new Set<string>();
    for (const it of miniItems.data ?? []) {
      let d = dayjs(it.start).startOf('day');
      const end = dayjs(it.end);
      for (let g = 0; g < 45 && !d.isAfter(end); g++) { s.add(d.format('YYYY-MM-DD')); d = d.add(1, 'day'); }
    }
    return s;
  }, [miniItems.data]);

  const [selected, setSelectedRaw] = useState<CalendarItem | null>(null);
  const [holiday, setHoliday] = useState<CalendarItem | null>(null);
  const setSelected = (i: CalendarItem | null) => (i?.kind === 'holiday' ? setHoliday(i) : setSelectedRaw(i));
  const [editor, setEditor] = useState<{ item?: CalendarItem | null; defaults?: { start: Dayjs; end: Dayjs; allDay?: boolean; members?: string[] } | null } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [awayOpen, setAwayOpen] = useState(false);
  const [worklists, setWorklists] = useState<{ initial?: keyof WorkLists } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [importGoogleOpen, setImportGoogleOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const exportFilters = useMemo(
    () => ({ types: visibleTypes.length === ALL_TYPES.length ? undefined : visibleTypes.join(','), members: prefs.calendars.join(',') || undefined }),
    [visibleTypes, prefs.calendars],
  );

  const onSlot = canManage
    ? (start: Dayjs, end: Dayjs, allDay: boolean, member?: string) => setEditor({ defaults: { start, end, allDay, members: member ? [member] : undefined } })
    : undefined;
  const newEvent = () => {
    const base = date.isSame(dayjs(), 'day') ? dayjs().add(1, 'hour').startOf('hour') : date.hour(10);
    setEditor({ defaults: { start: base, end: base.add(1, 'hour') } });
  };

  const exportRange = (span: 'day' | 'week', format: 'csv' | 'ics') => {
    setExportAnchor(null);
    const a = span === 'day' ? date.startOf('day') : date.startOf('week');
    const b = a.add(1, span);
    const params = { format, from: a.toISOString(), to: b.toISOString(), ...(exportFilters.types ? { types: exportFilters.types } : {}), ...(exportFilters.members ? { members: exportFilters.members } : {}) };
    downloadViaApi('/calendar/export', params, `calendar-${a.format('YYYY-MM-DD')}-${span}.${format}`).catch(() => {});
  };

  // Keyboard: T today, ←/→ step, Y/M/W/D/A views, N new event, / search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target) || tab !== 'calendar') return;
      const k = e.key.toLowerCase();
      if (k === 't') setNav({ date: dayjs() });
      else if (e.key === 'ArrowLeft') setNav({ date: stepDate(view, date, -1) });
      else if (e.key === 'ArrowRight') setNav({ date: stepDate(view, date, 1) });
      else if (k === 'n' && canManage) { e.preventDefault(); newEvent(); }
      else if (k === '/' || k === 's') { e.preventDefault(); setSearchOpen(true); }
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
  const toggleHoliday = (code: string) =>
    setPrefs((p) => ({ ...p, holidays: p.holidays.includes(code) ? p.holidays.filter((c) => c !== code) : [...p.holidays, code] }));
  const setCalendars = (codes: string[]) => setPrefs((p) => ({ ...p, calendars: codes }));

  const showDay = (d: Dayjs) => setNav({ view: 'day', date: d, tab: 'calendar' });
  const lanes = view === 'day' && prefs.sideBySide && prefs.calendars.length > 1 && !isMobile
    ? CALENDAR_REAL_CODES.filter((c) => prefs.calendars.includes(c)) : undefined;

  const workBtn = (key: keyof WorkLists, label: string, icon: string, color: 'warning' | 'info' | 'error') => {
    const n = work.data?.[key].length ?? 0;
    return (
      <Tooltip key={key} title={label}>
        <Button
          size="small" variant={n ? 'outlined' : 'text'} color={n ? color : 'inherit'}
          onClick={() => setWorklists({ initial: key })}
          startIcon={<Badge badgeContent={n} color={color} max={99}><Icon name={icon} fontSize="small" /></Badge>}
          sx={{ textTransform: 'none', fontWeight: 700, minWidth: 0, px: { xs: 1, md: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, lg: 1 } } }}
        >
          <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>{label}</Box>
        </Button>
      </Tooltip>
    );
  };

  const holidayToggles = !!holidaySources.length && (
    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', fontSize: 10.5 }}>
        {tCal('Holidays')}
      </Typography>
      <Stack>
        {holidaySources.map((h) => (
          <Tooltip key={h.code} title={h.note} placement="right">
            <FormControlLabel
              sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 500 } }}
              control={<Checkbox size="small" checked={prefs.holidays.includes(h.code)} onChange={() => toggleHoliday(h.code)} sx={{ py: 0.3, color: h.color, '&.Mui-checked': { color: h.color } }} />}
              label={tCal(h.label)}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box>
      {/* Confidential: no printing from the calendar. */}
      <GlobalStyles styles={{ '@media print': { body: { display: 'none !important' } } }} />
      {locked && (
        <Box
          onClick={unlock}
          sx={{ position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 10, display: 'grid', placeItems: 'center', cursor: 'pointer', backdropFilter: 'blur(18px)', bgcolor: alpha(theme.palette.background.default, 0.75) }}
        >
          <Stack alignItems="center" spacing={1.5}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}><Icon name="Lock" sx={{ fontSize: 32 }} /></Box>
            <Typography variant="h6" fontWeight={800}>Calendar hidden</Typography>
            <Typography variant="body2" color="text.secondary">Confidential - click anywhere to show it again.</Typography>
          </Stack>
        </Box>
      )}

      <PageHeader
        title={tCal('Calendar')}
        subtitle="MLA South, MLA North and MP - who is going where, holidays and request deadlines"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Calendar' }]}
        action={(
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="flex-end">
            {workBtn('toDecide', 'To decide', 'HelpOutline', 'warning')}
            {workBtn('toCheck', 'To check', 'FactCheck', 'info')}
            {workBtn('toFill', 'To fill', 'EditNote', 'error')}
            <Tooltip title="Search (/)">
              <IconButton onClick={() => setSearchOpen(true)} aria-label="Search events"><Icon name="Search" /></IconButton>
            </Tooltip>
            {canManage && !isMobile && <Button variant="outlined" startIcon={<Icon name="FlightTakeoff" />} onClick={() => setAwayOpen(true)}>Away</Button>}
            {canManage && !isMobile && <Button variant="outlined" startIcon={<Icon name="PhotoCamera" />} onClick={() => setQuickOpen(true)}>Quick</Button>}
            {canManage && <Button variant="contained" startIcon={<Icon name="Add" />} onClick={newEvent}>New Event</Button>}
            <Tooltip title="More">
              <IconButton onClick={(e) => setMoreAnchor(e.currentTarget)} aria-label="More calendar actions"><Icon name="MoreVert" /></IconButton>
            </Tooltip>
            <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
              {canManage && isMobile && (
                <MenuItem onClick={() => { setMoreAnchor(null); setQuickOpen(true); }}><Icon name="PhotoCamera" sx={{ mr: 1.5 }} />Quick event</MenuItem>
              )}
              {canManage && isMobile && (
                <MenuItem onClick={() => { setMoreAnchor(null); setAwayOpen(true); }}><Icon name="FlightTakeoff" sx={{ mr: 1.5 }} />Mark away</MenuItem>
              )}
              {canManage && (
                <MenuItem onClick={() => { setMoreAnchor(null); setImportGoogleOpen(true); }}><Icon name="UploadFile" sx={{ mr: 1.5 }} />Import from Google Calendar</MenuItem>
              )}
              <MenuItem onClick={() => { setMoreAnchor(null); setWorklists({}); }}><Icon name="ListAlt" sx={{ mr: 1.5 }} />All work lists</MenuItem>
              {canAdmin && (
                <MenuItem onClick={() => { setMoreAnchor(null); setAdminOpen(true); }}><Icon name="AdminPanelSettings" sx={{ mr: 1.5 }} />Calendar admin</MenuItem>
              )}
            </Menu>
          </Stack>
        )}
      />

      <Tabs value={tab} onChange={(_e, v) => setNav({ tab: v })} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="calendar" icon={<Icon name="CalendarMonth" fontSize="small" />} iconPosition="start" label={tCal('Calendar')} sx={{ minHeight: 48 }} />
        <Tab value="social" icon={<Icon name="Share" fontSize="small" />} iconPosition="start" label={tCal('Social media')} sx={{ minHeight: 48 }} />
        <Tab value="reports" icon={<Icon name="BarChart" fontSize="small" />} iconPosition="start" label={tCal('Reports')} sx={{ minHeight: 48 }} />
      </Tabs>

      {tab === 'social' && <SocialMediaPanel onSelect={setSelected} />}
      {tab === 'reports' && <ReportsPanel filters={exportFilters} />}

      {tab === 'calendar' && (
        <Grid container spacing={2}>
          {/* ------------------------------ sidebar ------------------------------ */}
          {!isNarrow && (
            <Grid item md={3}>
              <Stack spacing={2} sx={{ position: 'sticky', top: 88 }}>
                <Card sx={{ '&:hover': { transform: 'none' } }}>
                  <CardContent>
                    <MiniCalendar value={date} onChange={(d) => setNav({ date: d })} markedDays={markedDays} onMonthChange={setMiniMonth} />
                  </CardContent>
                </Card>

                <Card sx={{ '&:hover': { transform: 'none' } }}>
                  <CardContent>
                    <CalendarsField value={prefs.calendars} onChange={setCalendars} label="Calendars" size="small" />
                    <FormControlLabel
                      sx={{ mt: 1, mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                      control={<Switch size="small" checked={prefs.hideNotGoing} onChange={(e) => setPrefs((p) => ({ ...p, hideNotGoing: e.target.checked }))} />}
                      label={tCal("Hide events we're not going to")}
                    />
                  </CardContent>
                </Card>

                <Card sx={{ '&:hover': { transform: 'none' } }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="subtitle2">{tCal('Show')}</Typography>
                      <Button size="small" sx={{ minWidth: 0, px: 1, py: 0 }} onClick={() => setPrefs((p) => ({ ...p, hidden: p.hidden.length ? [] : [...ALL_TYPES] }))}>
                        {prefs.hidden.length ? 'All' : 'None'}
                      </Button>
                    </Stack>
                    <Stack spacing={0.75}>
                      {CALENDAR_EVENT_GROUPS.map((g) => (
                        <Box key={g.code}>
                          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', fontSize: 10.5 }}>
                            {tCal(g.label)}
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
                                  label={tCal(t.label)}
                                />
                              </Tooltip>
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                    {holidayToggles}
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
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{tCal('Coming up')}</Typography>
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
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                <MemberBadges item={it} />
                                <Typography variant="body2" fontWeight={600} noWrap>{it.title}</Typography>
                              </Stack>
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
                <Stack direction="row" spacing={1} alignItems="center">
                  {view === 'day' && prefs.calendars.length > 1 && !isMobile && (
                    <FormControlLabel
                      sx={{ mr: 0.5, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', fontWeight: 600 } }}
                      control={<Switch size="small" checked={prefs.sideBySide} onChange={(e) => setPrefs((p) => ({ ...p, sideBySide: e.target.checked }))} />}
                      label={tCal('Side by side')}
                    />
                  )}
                  <Tooltip title="Export">
                    <IconButton size="small" onClick={(e) => setExportAnchor(e.currentTarget)} aria-label="Export"><Icon name="Download" fontSize="small" /></IconButton>
                  </Tooltip>
                  <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
                    <ListSubheader sx={{ lineHeight: '32px' }}>This day · {date.format('D MMM')}</ListSubheader>
                    <MenuItem onClick={() => exportRange('day', 'csv')}>CSV (Excel)</MenuItem>
                    <MenuItem onClick={() => exportRange('day', 'ics')}>.ics (Google / Outlook)</MenuItem>
                    <ListSubheader sx={{ lineHeight: '32px' }}>This week · from {date.startOf('week').format('D MMM')}</ListSubheader>
                    <MenuItem onClick={() => exportRange('week', 'csv')}>CSV (Excel)</MenuItem>
                    <MenuItem onClick={() => exportRange('week', 'ics')}>.ics (Google / Outlook)</MenuItem>
                  </Menu>
                  {isMobile ? (
                    <TextField select size="small" value={view} onChange={(e) => setNav({ view: e.target.value as CalendarView })}>
                      {VIEWS.map((v) => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
                    </TextField>
                  ) : (
                    <ToggleButtonGroup
                      size="small" exclusive value={view} onChange={(_e, v) => v && setNav({ view: v })}
                      sx={{ '& .MuiToggleButton-root': { px: 1.25, textTransform: 'none', fontWeight: 600, gap: 0.75 } }}
                    >
                      {VIEWS.map((v) => (
                        <Tooltip key={v.value} title={`${v.label} (${v.key.toUpperCase()})`}>
                          <ToggleButton value={v.value}><Icon name={v.icon} fontSize="small" /><Box component="span" sx={{ display: { sm: 'none', lg: 'inline' } }}>{v.label}</Box></ToggleButton>
                        </Tooltip>
                      ))}
                    </ToggleButtonGroup>
                  )}
                </Stack>
              </Stack>
              <Box sx={{ height: 3 }}>{events.isFetching && <LinearProgress color="secondary" sx={{ height: 3 }} />}</Box>

              {view === 'year' && <YearView date={date} items={items} onShowDay={showDay} />}
              {view === 'month' && <MonthView date={date} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} />}
              {view === 'week' && <TimeGridView date={date} days={7} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} />}
              {view === 'day' && <TimeGridView date={date} days={1} items={items} onSelect={setSelected} onSlot={onSlot} onShowDay={showDay} lanes={lanes} />}
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
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color }} />{tCal(t.label)}
                    </ButtonBase>
                  );
                })}
                {holidaySources.map((h) => (
                  <ButtonBase
                    key={h.code} onClick={() => toggleHoliday(h.code)}
                    sx={{ gap: 0.75, px: 1, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, opacity: prefs.holidays.includes(h.code) ? 1 : 0.45, border: 1, borderColor: 'divider' }}
                  >
                    <Icon name="Flag" sx={{ fontSize: 13, color: h.color }} />{tCal(h.short || h.label)}
                  </ButtonBase>
                ))}
                <ButtonBase
                  onClick={() => setPrefs((p) => ({ ...p, hideNotGoing: !p.hideNotGoing }))}
                  sx={{ gap: 0.75, px: 1, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, opacity: prefs.hideNotGoing ? 1 : 0.45, border: 1, borderColor: 'divider' }}
                >
                  <Icon name="VisibilityOff" sx={{ fontSize: 13 }} />Hide not going
                </ButtonBase>
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
      )}

      <EventDetailsDialog
        item={selected}
        canManage={canManage}
        onClose={() => setSelectedRaw(null)}
        onEdit={(it) => { setSelectedRaw(null); setEditor({ item: it }); }}
        onOpenRequest={(id) => { setSelectedRaw(null); if (isMobile) navigate(`/requests/${id}`); else setRequestId(id); }}
      />
      <HolidayDialog item={holiday} sources={holidaySources} onClose={() => setHoliday(null)} />
      <EventDialog open={!!editor} item={editor?.item} defaults={editor?.defaults} onClose={() => setEditor(null)} />
      <RequestDetailDialog id={requestId} onClose={() => setRequestId(null)} />
      <QuickEventDialog open={quickOpen} onClose={() => setQuickOpen(false)} />
      <AwayDialog open={awayOpen} onClose={() => setAwayOpen(false)} />
      <ImportGoogleCalendarDialog open={importGoogleOpen} onClose={() => setImportGoogleOpen(false)} />
      <WorkListsDialog open={!!worklists} initial={worklists?.initial} onClose={() => setWorklists(null)} onSelect={setSelected} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={setSelected} />
      {canAdmin && <AdminCalendarDialog open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </Box>
  );
}
