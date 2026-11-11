import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Box, ButtonBase, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_CODES, CALENDAR_DEADLINE_COLOR, calendarTypeMeta } from '@mla/shared';
import { Icon } from '@/components/Icon';
import {
  allDeclined, fmtArrival, isAllDayLike, isClosedHoliday, layoutDay, onDay, roundTo, rsvpOf, timeLabel, viewRange,
  type CalendarItem,
} from './calendarUtils';
import { CalendarAvatar } from './CalendarAvatar';
import { useCalendarReference } from './useCalendarReference';

/** Colours of the holiday layers (match the reference data's holidaySources). */
export const HOLIDAY_COLORS: Record<string, string> = {
  CENTRAL: '#E65100', KARNATAKA: '#C62828', KARNATAKA_RH: '#AD7B00', WORLD: '#00838F',
};

export const itemColor = (item: CalendarItem) =>
  item.kind === 'deadline' ? CALENDAR_DEADLINE_COLOR
    : item.kind === 'holiday' ? HOLIDAY_COLORS[item.holidaySource ?? ''] ?? '#757575'
      : calendarTypeMeta(item.type).color;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isMuted = (i: CalendarItem) => i.status === 'CANCELLED' || i.status === 'COMPLETED' || allDeclined(i);
const isStruck = (i: CalendarItem) => i.status === 'CANCELLED' || allDeclined(i);
const awayStripes = (color: string) => `repeating-linear-gradient(135deg, ${color}33 0 6px, transparent 6px 12px)`;

/** (start, end, allDay, member?) - member is set when a Day-view lane was clicked. */
type SlotHandler = (start: Dayjs, end: Dayjs, allDay: boolean, member?: string) => void;

/**
 * One small badge per invited calendar: filled = going, dashed + "?" = not
 * decided, faded + struck = not going. All three with the same decision
 * collapse to a single "SS" badge.
 */
export function MemberBadges({ item, size = 'sm' }: { item: CalendarItem; size?: 'sm' | 'md' }) {
  const members = item.members ?? [];
  if (!members.length || item.kind !== 'event') return null;
  const whole = CALENDAR_CODES.every((c) => members.includes(c.code)) && new Set(members.map((m) => rsvpOf(item, m))).size === 1;
  const list = whole
    ? [{ code: 'SS', badge: 'SS', color: '#D81B60', title: 'SS Family', status: rsvpOf(item, members[0]) }]
    : members.map((m) => {
      const c = CALENDAR_CODES.find((x) => x.code === m);
      return { code: m, badge: c?.badge ?? m, color: c?.color ?? '#757575', title: c?.title ?? m, status: rsvpOf(item, m) };
    });
  const md = size === 'md';
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: 0.3, flexShrink: 0, verticalAlign: 'middle' }}>
      {list.map((b) => {
        const going = b.status === 'GOING';
        const undecided = b.status === 'UNDECIDED';
        return (
          <Box
            key={b.code} component="span"
            title={`${b.title}: ${going ? 'going' : undecided ? 'not decided' : 'not going'}`}
            sx={{
              px: md ? 0.75 : 0.4, minWidth: md ? 22 : 15, height: md ? 20 : 14, borderRadius: 0.75,
              display: 'inline-grid', placeItems: 'center', fontSize: md ? 11 : 9, fontWeight: 800, lineHeight: 1, letterSpacing: 0.2,
              color: undecided ? b.color : '#fff',
              bgcolor: going ? b.color : undecided ? 'transparent' : alpha(b.color, 0.35),
              border: undecided ? `1.5px dashed ${b.color}` : 'none',
              textDecoration: b.status === 'NOT_GOING' ? 'line-through' : 'none',
              opacity: b.status === 'NOT_GOING' ? 0.7 : 1,
            }}
          >
            {b.badge}{undecided ? '?' : ''}
          </Box>
        );
      })}
    </Box>
  );
}

/** Small marker for attendance: icon once marked, an amber "?" when a past event still isn't marked. */
export function AttendanceMark({ item, size = 13 }: { item: CalendarItem; size?: number }) {
  if (item.kind !== 'event' || item.draft || item.type === 'UNAVAILABLE') return null;
  const marks = Object.values(item.attendance ?? {});
  if (marks.length) {
    const s = marks.some((m) => m.status === 'ATTENDED') ? 'ATTENDED' : marks.some((m) => m.status === 'REPRESENTATIVE') ? 'REPRESENTATIVE' : 'NOT_ATTENDED';
    const meta = { ATTENDED: ['CheckCircle', '#2E7D32', 'Attended'], REPRESENTATIVE: ['Group', '#ED6C02', 'Sent a representative'], NOT_ATTENDED: ['Cancel', '#D32F2F', 'Did not attend'] }[s];
    return <Icon name={meta[0]} titleAccess={meta[2]} sx={{ fontSize: size, color: meta[1], flexShrink: 0 }} />;
  }
  // Over, someone was going, nobody has said whether they went.
  if (item.status !== 'CANCELLED' && dayjs(item.end).isBefore(dayjs()) && item.members.some((m) => rsvpOf(item, m) === 'GOING')) {
    return <Icon name="FactCheck" titleAccess="Attendance not marked yet" sx={{ fontSize: size + 1, color: '#F59E0B', flexShrink: 0 }} />;
  }
  return null;
}

/** Thin coloured text row for a holiday / world day. */
function HolidayPill({ item, onClick }: { item: CalendarItem; onClick: (i: CalendarItem) => void }) {
  const color = itemColor(item);
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      title={item.title}
      sx={{
        width: '100%', justifyContent: 'flex-start', px: 0.75, borderRadius: 1, minWidth: 0,
        fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.35, color, '&:hover': { bgcolor: alpha(color, 0.1) },
      }}
    >
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</Box>
    </ButtonBase>
  );
}

/** Red dot on a Quick Event that still needs its details filled in. */
function DraftDot({ size = 9 }: { size?: number }) {
  return (
    <Box
      component="span" title="Quick event - details to be filled in"
      sx={{ position: 'absolute', top: 2, right: 2, width: size, height: size, borderRadius: '50%', bgcolor: '#E53935', boxShadow: (t) => `0 0 0 2px ${t.palette.background.paper}`, zIndex: 1, pointerEvents: 'none' }}
    />
  );
}

/* --------------------------------- pill ---------------------------------- */
function EventPill({ item, onClick, compact, badges = true }: { item: CalendarItem; onClick: (i: CalendarItem) => void; compact?: boolean; badges?: boolean }) {
  if (item.kind === 'holiday') return <HolidayPill item={item} onClick={onClick} />;
  const color = itemColor(item);
  const filled = isAllDayLike(item) || item.kind === 'deadline';
  const away = item.type === 'UNAVAILABLE';
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      sx={{
        position: 'relative', width: '100%', justifyContent: 'flex-start', textAlign: 'left',
        px: 0.75, pr: item.draft ? 1.75 : 0.75, py: compact ? 0.15 : 0.3, borderRadius: 1.25, gap: 0.6,
        outline: item.draft ? '1.5px dashed #E53935' : 'none', outlineOffset: -1.5,
        fontSize: '0.75rem', lineHeight: 1.35, minWidth: 0,
        bgcolor: filled ? alpha(color, 0.16) : 'transparent',
        backgroundImage: away ? awayStripes(color) : 'none',
        borderLeft: filled ? `3px solid ${color}` : 'none',
        color: 'text.primary',
        opacity: isMuted(item) ? 0.55 : 1,
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: alpha(color, filled ? 0.26 : 0.12) },
      }}
    >
      {item.draft && <DraftDot size={8} />}
      {badges && <MemberBadges item={item} />}
      <AttendanceMark item={item} size={12} />
      {!filled && <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
      {!filled && (
        <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {dayjs(item.start).format('h:mma').replace(':00', '')}
        </Box>
      )}
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, textDecoration: isStruck(item) ? 'line-through' : 'none' }}
      >
        {item.kind === 'deadline' && <Icon name="Flag" sx={{ fontSize: 12, mr: 0.4, verticalAlign: '-2px', color }} />}
        {away && <Icon name="FlightTakeoff" sx={{ fontSize: 12, mr: 0.4, verticalAlign: '-2px', color: 'text.secondary' }} />}
        {item.isRecurring && <Icon name="Autorenew" sx={{ fontSize: 11, mr: 0.3, verticalAlign: '-1px', color: 'text.secondary' }} />}
        {item.title}
      </Box>
    </ButtonBase>
  );
}

/* --------------------------------- month --------------------------------- */
export function MonthView({
  date, items, onSelect, onSlot, onShowDay, badges = true,
}: {
  date: Dayjs; items: CalendarItem[]; onSelect: (i: CalendarItem) => void; onSlot?: SlotHandler; onShowDay: (d: Dayjs) => void; badges?: boolean;
}) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { from } = viewRange('month', date);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => from.add(i, 'day')), [from]);
  const maxShown = isSmall ? 2 : 3;
  const today = dayjs();

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: 1, borderColor: 'divider' }}>
        {WEEKDAYS.map((w, i) => (
          <Typography
            key={w} variant="caption"
            sx={{ py: 1.25, textAlign: 'center', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: i === 0 ? 'error.main' : 'text.secondary' }}
          >
            {isSmall ? w[0] : w}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: { xs: 'minmax(76px, auto)', sm: 'minmax(118px, auto)' } }}>
        {days.map((d, idx) => {
          const inMonth = d.month() === date.month();
          const isToday = d.isSame(today, 'day');
          const all = items.filter((it) => onDay(it, d));
          const holidays = all.filter((it) => it.kind === 'holiday');
          const dayItems = all.filter((it) => it.kind !== 'holiday');
          const closed = holidays.some(isClosedHoliday);
          const extra = dayItems.length - maxShown;
          return (
            <Box
              key={d.toString()}
              onClick={() => (isSmall ? onShowDay(d) : onSlot?.(d.hour(10).minute(0), d.hour(11).minute(0), false))}
              sx={{
                borderRight: (idx + 1) % 7 ? 1 : 0, borderBottom: idx < 35 ? 1 : 0, borderColor: 'divider',
                p: { xs: 0.4, sm: 0.75 }, minWidth: 0,
                cursor: onSlot ? 'pointer' : 'default',
                bgcolor: !inMonth ? alpha(theme.palette.text.primary, 0.025)
                  : closed ? alpha('#C62828', 0.06)
                    : d.day() === 0 ? alpha(theme.palette.error.main, 0.025) : 'transparent',
                transition: 'background-color .15s ease',
                '&:hover': onSlot ? { bgcolor: alpha(theme.palette.primary.main, 0.04) } : undefined,
              }}
            >
              <Stack direction="row" justifyContent={{ xs: 'center', sm: 'space-between' }} alignItems="center" sx={{ mb: 0.5 }}>
                <ButtonBase
                  onClick={(e) => { e.stopPropagation(); onShowDay(d); }}
                  sx={{
                    minWidth: 28, height: 28, px: d.date() === 1 && !isSmall && !isToday ? 1 : 0, borderRadius: 14, whiteSpace: 'nowrap',
                    fontSize: '0.8rem', fontWeight: isToday ? 800 : 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: isToday ? theme.palette.secondary.contrastText : inMonth ? 'text.primary' : 'text.disabled',
                    bgcolor: isToday ? 'secondary.main' : 'transparent',
                    boxShadow: isToday ? `0 2px 8px ${alpha(theme.palette.secondary.main, 0.45)}` : 'none',
                    '&:hover': { bgcolor: isToday ? 'secondary.main' : 'action.hover' },
                  }}
                >
                  {d.date() === 1 && !isSmall && !isToday ? d.format('D MMM') : d.date()}
                </ButtonBase>
              </Stack>
              {!isSmall && !!holidays.length && (
                <Stack sx={{ mb: 0.25, mt: -0.25 }}>
                  {holidays.slice(0, 2).map((h) => <HolidayPill key={h.id} item={h} onClick={onSelect} />)}
                  {holidays.length > 2 && (
                    <Typography variant="caption" sx={{ px: 0.75, fontSize: 10, color: 'text.secondary' }}>+{holidays.length - 2} more days</Typography>
                  )}
                </Stack>
              )}
              {isSmall ? (
                <Stack direction="row" spacing={0.4} justifyContent="center" flexWrap="wrap" useFlexGap>
                  {closed && <Box sx={{ width: '100%', height: 2, borderRadius: 1, bgcolor: '#C62828', opacity: 0.6, mb: 0.25 }} />}
                  {dayItems.slice(0, 4).map((it) => (
                    <Box key={it.id} onClick={(e) => { e.stopPropagation(); onSelect(it); }} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: itemColor(it) }} />
                  ))}
                  {dayItems.length > 4 && <Typography variant="caption" sx={{ fontSize: 10, lineHeight: '7px' }}>+</Typography>}
                </Stack>
              ) : (
                <Stack spacing={0.35}>
                  {dayItems.slice(0, maxShown).map((it) => <EventPill key={it.id} item={it} onClick={onSelect} compact badges={badges} />)}
                  {extra > 0 && (
                    <ButtonBase
                      onClick={(e) => { e.stopPropagation(); onShowDay(d); }}
                      sx={{ justifyContent: 'flex-start', px: 0.75, fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', borderRadius: 1, '&:hover': { color: 'text.primary' } }}
                    >
                      +{extra} more
                    </ButtonBase>
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ------------------------------ week / day ------------------------------- */
const HOUR_PX = 52;

interface Column { key: string; day: Dayjs; member?: string; match: (i: CalendarItem) => boolean }

export function TimeGridView({
  date, days: dayCount, items, onSelect, onSlot, onShowDay, lanes, badges = true,
}: {
  date: Dayjs; days: 1 | 7; items: CalendarItem[]; onSelect: (i: CalendarItem) => void; onSlot?: SlotHandler; onShowDay: (d: Dayjs) => void;
  /** Day view only: one column per calendar ("side by side"). */
  lanes?: string[];
  badges?: boolean;
}) {
  const theme = useTheme();
  const { tCal } = useCalendarReference();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(dayjs());
  const { from } = viewRange(dayCount === 7 ? 'week' : 'day', date);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => from.add(i, 'day')), [from, dayCount]);

  // One column per day, or (day view, side by side) one column per calendar.
  const columns: Column[] = useMemo(() => (
    dayCount === 1 && lanes && lanes.length > 1
      ? lanes.map((m) => ({ key: m, day: days[0], member: m, match: (i: CalendarItem) => i.kind === 'holiday' || (i.members ?? []).includes(m) }))
      : days.map((d) => ({ key: d.toString(), day: d, match: () => true }))
  ), [dayCount, lanes, days]);
  const laneMode = !!columns[0]?.member;

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_PX * 7.5;
  }, [dayCount]);

  const allDay = items.filter(isAllDayLike);
  const timed = items.filter((i) => !isAllDayLike(i));
  const cols = `56px repeat(${columns.length}, minmax(0, 1fr))`;
  const gridLine = theme.palette.divider;

  const slotClick = (d: Dayjs, e: MouseEvent<HTMLDivElement>, member?: string) => {
    if (!onSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const start = roundTo(d.startOf('day').add(Math.floor(mins / 30) * 30, 'minute'), 30);
    onSlot(start, start.add(1, 'hour'), false, member);
  };

  return (
    <Box>
      {/* header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: cols, borderBottom: 1, borderColor: 'divider' }}>
        <Box />
        {columns.map(({ key, day: d, member }) => {
          if (member) {
            const c = CALENDAR_CODES.find((x) => x.code === member)!;
            return (
              <Stack
                key={key} direction="row" spacing={1} alignItems="center" justifyContent="center"
                sx={{ py: 1, px: 1, borderLeft: 1, borderColor: 'divider', borderTop: `3px solid ${c.color}`, minWidth: 0 }}
              >
                <CalendarAvatar code={c.code} size={34} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: c.color, lineHeight: 1.2 }} noWrap>{tCal(c.title)}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ display: { xs: 'none', md: 'block' } }}>{tCal(c.label)}</Typography>
                </Box>
              </Stack>
            );
          }
          const isToday = d.isSame(now, 'day');
          return (
            <ButtonBase key={key} onClick={() => onShowDay(d)} sx={{ py: 1, flexDirection: 'column', borderLeft: 1, borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isToday ? 'secondary.main' : d.day() === 0 ? 'error.main' : 'text.secondary' }}>
                {d.format('ddd')}
              </Typography>
              <Box
                sx={{
                  mt: 0.25, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums',
                  bgcolor: isToday ? 'secondary.main' : 'transparent',
                  color: isToday ? theme.palette.secondary.contrastText : 'text.primary',
                }}
              >
                {d.date()}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      {/* all-day strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: cols, borderBottom: 1, borderColor: 'divider', minHeight: 34 }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', textAlign: 'right', pr: 1, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
          All day
        </Typography>
        {columns.map(({ key, day: d, member, match }) => (
          <Stack
            key={key} spacing={0.35}
            onClick={() => onSlot?.(d.startOf('day'), d.startOf('day'), true, member)}
            sx={{ p: 0.4, borderLeft: 1, borderColor: 'divider', cursor: onSlot ? 'pointer' : 'default', minWidth: 0 }}
          >
            {allDay.filter((it) => onDay(it, d) && match(it)).map((it) => <EventPill key={it.id} item={it} onClick={onSelect} compact badges={badges && !laneMode} />)}
          </Stack>
        ))}
      </Box>

      {/* hours */}
      <Box ref={scrollRef} sx={{ height: { xs: 'calc(100vh - 330px)', md: 'calc(100vh - 360px)' }, minHeight: 420, overflowY: 'auto', position: 'relative' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: cols, position: 'relative', height: HOUR_PX * 24 }}>
          <Box sx={{ position: 'relative' }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <Typography
                key={h} variant="caption" color="text.secondary"
                sx={{ position: 'absolute', top: h * HOUR_PX - 8, right: 8, lineHeight: '16px', fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                {dayjs().hour(h).format('h A')}
              </Typography>
            ))}
          </Box>
          {columns.map(({ key, day: d, member, match }) => {
            const isToday = d.isSame(now, 'day');
            const positioned = layoutDay(timed.filter((it) => onDay(it, d) && match(it)), d);
            return (
              <Box
                key={key}
                onClick={(e) => slotClick(d, e, member)}
                sx={{
                  position: 'relative', borderLeft: 1, borderColor: 'divider', cursor: onSlot ? 'pointer' : 'default',
                  backgroundImage: `repeating-linear-gradient(to bottom, ${gridLine} 0, ${gridLine} 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                  bgcolor: isToday ? alpha(theme.palette.secondary.main, 0.04) : 'transparent',
                }}
              >
                {positioned.map(({ item, top, height, col, cols: n }) => {
                  const color = itemColor(item);
                  const short = height < 40;
                  const laneStatus = member ? rsvpOf(item, member) : null;
                  const muted = item.status === 'CANCELLED' || item.status === 'COMPLETED' || (member ? laneStatus === 'NOT_GOING' : allDeclined(item));
                  const struck = item.status === 'CANCELLED' || (member ? laneStatus === 'NOT_GOING' : allDeclined(item));
                  return (
                    <ButtonBase
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                      sx={{
                        position: 'absolute',
                        top: (top / 60) * HOUR_PX + 1,
                        height: Math.max(18, (height / 60) * HOUR_PX - 2),
                        left: `calc(${(col / n) * 100}% + 2px)`,
                        width: `calc(${100 / n}% - 4px)`,
                        flexDirection: short ? 'row' : 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: short ? 0.5 : 0,
                        px: 0.75, pr: item.draft ? 2 : 0.75, py: 0.4, borderRadius: 1.5, overflow: 'hidden', textAlign: 'left',
                        outline: item.draft ? '1.5px dashed #E53935' : 'none', outlineOffset: -1.5,
                        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.16),
                        backgroundImage: item.type === 'UNAVAILABLE' ? awayStripes(color) : 'none',
                        borderLeft: `3px solid ${color}`,
                        opacity: muted ? 0.55 : 1,
                        boxShadow: `0 1px 2px ${alpha('#000', 0.08)}`,
                        transition: 'transform .12s ease, box-shadow .12s ease',
                        '&:hover': { zIndex: 2, boxShadow: `0 6px 16px ${alpha(color, 0.35)}` },
                      }}
                    >
                      {item.draft && <DraftDot />}
                      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: short ? 'nowrap' : 'normal', textDecoration: struck ? 'line-through' : 'none' }}>
                        {badges && !laneMode && <><MemberBadges item={item} />{' '}</>}
                        {laneStatus === 'UNDECIDED' && (
                          <Box component="span" title="Not decided yet" sx={{ px: 0.5, mr: 0.4, borderRadius: 0.75, border: '1.5px dashed #F59E0B', color: '#B45309', fontSize: 9, fontWeight: 900 }}>?</Box>
                        )}
                        <Box component="span" sx={{ display: 'inline-flex', verticalAlign: '-2px', mr: 0.4 }}><AttendanceMark item={item} size={12} /></Box>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                        {timeLabel(item)}{item.arrival && !item.allDay ? ` · arrive ${fmtArrival(item.arrival)}` : ''}{!short && item.venue ? ` · ${item.venue}` : ''}
                      </Typography>
                    </ButtonBase>
                  );
                })}
                {isToday && (
                  <Box sx={{ position: 'absolute', left: 0, right: 0, top: (now.diff(d.startOf('day'), 'minute') / 60) * HOUR_PX, height: 2, bgcolor: 'error.main', zIndex: 3, pointerEvents: 'none' }}>
                    <Box sx={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/* --------------------------------- agenda -------------------------------- */
export function AgendaView({ date, items, onSelect, badges = true }: { date: Dayjs; items: CalendarItem[]; onSelect: (i: CalendarItem) => void; badges?: boolean }) {
  const { tCal } = useCalendarReference();
  const { from } = viewRange('agenda', date);
  const groups = useMemo(() => {
    const out: { day: Dayjs; items: CalendarItem[] }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = from.add(i, 'day');
      const list = items.filter((it) => onDay(it, d));
      if (list.length) out.push({ day: d, items: list });
    }
    return out;
  }, [from, items]);
  const today = dayjs();

  if (!groups.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <Icon name="Event" sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography variant="subtitle1" sx={{ mt: 1 }}>{tCal('Nothing scheduled in the next 30 days')}</Typography>
      </Box>
    );
  }

  return (
    <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
      {groups.map(({ day, items: list }) => {
        const isToday = day.isSame(today, 'day');
        return (
          <Stack key={day.toString()} direction="row" spacing={2} sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 } }}>
            <Box sx={{ width: 56, flexShrink: 0, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isToday ? 'secondary.main' : 'text.secondary' }}>
                {day.format('ddd')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1, color: isToday ? 'secondary.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                {day.date()}
              </Typography>
              <Typography variant="caption" color="text.secondary">{day.format('MMM')}</Typography>
            </Box>
            <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
              {list.map((it) => {
                const color = itemColor(it);
                if (it.kind === 'holiday') {
                  return (
                    <ButtonBase
                      key={it.id} onClick={() => onSelect(it)}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: alpha(color, 0.08), '&:hover': { bgcolor: alpha(color, 0.14) } }}
                    >
                      <Icon name="Flag" sx={{ fontSize: 14, color }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color }} noWrap>{it.title}</Typography>
                    </ButtonBase>
                  );
                }
                return (
                  <ButtonBase
                    key={it.id} onClick={() => onSelect(it)}
                    sx={{
                      position: 'relative', justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, p: 1.25, borderRadius: 2,
                      border: 1, borderColor: 'divider', opacity: isMuted(it) ? 0.6 : 1,
                      '&:hover': { borderColor: color, bgcolor: alpha(color, 0.06) },
                    }}
                  >
                    {it.draft && <DraftDot size={10} />}
                    <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: color, flexShrink: 0 }} />
                    <Box sx={{ width: { xs: 70, sm: 128 }, flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}>
                        {it.kind === 'deadline' ? 'Due' : timeLabel(it)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', display: { xs: 'block', sm: 'none' } }}>
                        {it.kind === 'deadline' ? 'Due' : it.allDay ? 'All day' : dayjs(it.start).format('h:mm A')}
                      </Typography>
                      {(it.arrival || it.dayCount) && !it.allDay && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {[it.arrival && `arrive ${fmtArrival(it.arrival)}`, it.dayCount && `Day ${it.dayNo} of ${it.dayCount}`].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        {badges && <MemberBadges item={it} size="md" />}
                        <AttendanceMark item={it} size={16} />
                        <Typography variant="body2" sx={{ fontWeight: 700, textDecoration: isStruck(it) ? 'line-through' : 'none' }} noWrap>
                          {it.title}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {[it.kind === 'deadline' ? 'Request deadline' : tCal(calendarTypeMeta(it.type).label), it.venue, it.area].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    {it.isRecurring && <Tooltip title="Repeating event"><Icon name="Autorenew" fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>}
                  </ButtonBase>
                );
              })}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

/* ---------------------------------- year --------------------------------- */
export function YearView({ date, items, onShowDay }: { date: Dayjs; items: CalendarItem[]; onShowDay: (d: Dayjs) => void }) {
  const theme = useTheme();
  const today = dayjs();
  const yearStart = date.startOf('year');
  const byDay = useMemo(() => {
    const m = new Map<string, { n: number; color: string; closed: boolean }>();
    for (let d = yearStart; d.isBefore(yearStart.add(1, 'year')); d = d.add(1, 'day')) {
      const list = items.filter((it) => onDay(it, d));
      if (!list.length) continue;
      const events = list.filter((it) => it.kind !== 'holiday');
      m.set(d.format('YYYY-MM-DD'), { n: events.length, color: events[0] ? itemColor(events[0]) : '', closed: list.some(isClosedHoliday) });
    }
    return m;
  }, [items, yearStart.valueOf()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, display: 'grid', gap: { xs: 2, sm: 3 }, gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' } }}>
      {Array.from({ length: 12 }, (_, i) => yearStart.add(i, 'month')).map((month) => {
        const start = month.startOf('week');
        const thisMonth = month.isSame(today, 'month');
        return (
          <Box key={month.month()}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75, color: thisMonth ? 'secondary.main' : 'text.primary' }}>{month.format('MMMM')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.25 }}>
              {WEEKDAYS.map((w, i) => (
                <Typography key={w} variant="caption" sx={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i === 0 ? 'error.main' : 'text.secondary' }}>{w[0]}</Typography>
              ))}
              {Array.from({ length: 42 }, (_, i) => start.add(i, 'day')).map((d) => {
                if (d.month() !== month.month()) return <Box key={d.toString()} sx={{ height: 26 }} />;
                const info = byDay.get(d.format('YYYY-MM-DD'));
                const n = info?.n ?? 0;
                const isToday = d.isSame(today, 'day');
                return (
                  <Tooltip key={d.toString()} title={n ? `${d.format('ddd D MMM')} · ${n}` : ''} disableInteractive>
                    <ButtonBase
                      onClick={() => onShowDay(d)}
                      sx={{
                        mx: 'auto', width: 26, height: 26, borderRadius: '50%', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums',
                        fontWeight: n || isToday ? 800 : 500,
                        color: isToday ? theme.palette.secondary.contrastText : info?.closed || d.day() === 0 ? 'error.main' : 'text.primary',
                        bgcolor: isToday ? 'secondary.main' : n ? alpha(info!.color || theme.palette.primary.main, Math.min(0.14 + n * 0.1, 0.5)) : 'transparent',
                        '&:hover': { bgcolor: isToday ? 'secondary.main' : 'action.hover' },
                      }}
                    >
                      {d.date()}
                    </ButtonBase>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/* ------------------------------ mini calendar ---------------------------- */
export function MiniCalendar({
  value, onChange, markedDays, onMonthChange,
}: { value: Dayjs; onChange: (d: Dayjs) => void; markedDays: Set<string>; onMonthChange?: (m: Dayjs) => void }) {
  const theme = useTheme();
  const [month, setMonthState] = useState(value.startOf('month'));
  const setMonth = (fn: (m: Dayjs) => Dayjs) => setMonthState((m) => { const n = fn(m); onMonthChange?.(n); return n; });
  useEffect(() => { setMonthState(value.startOf('month')); }, [value]);
  const start = month.startOf('week');
  const today = dayjs();

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{month.format('MMMM YYYY')}</Typography>
        <Stack direction="row">
          <IconButton size="small" onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="Previous month"><Icon name="ChevronLeft" fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="Next month"><Icon name="ChevronRight" fontSize="small" /></IconButton>
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.25 }}>
        {WEEKDAYS.map((w) => (
          <Typography key={w} variant="caption" sx={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'text.secondary' }}>{w[0]}</Typography>
        ))}
        {Array.from({ length: 42 }, (_, i) => start.add(i, 'day')).map((d) => {
          const selected = d.isSame(value, 'day');
          const isToday = d.isSame(today, 'day');
          const inMonth = d.month() === month.month();
          const marked = markedDays.has(d.format('YYYY-MM-DD'));
          return (
            <ButtonBase
              key={d.toString()} onClick={() => onChange(d)}
              sx={{
                mx: 'auto', width: 30, height: 30, borderRadius: '50%', position: 'relative',
                fontSize: '0.75rem', fontWeight: selected || isToday ? 800 : 500, fontVariantNumeric: 'tabular-nums',
                color: selected ? theme.palette.primary.contrastText : isToday ? 'secondary.main' : inMonth ? 'text.primary' : 'text.disabled',
                bgcolor: selected ? 'primary.main' : 'transparent',
                border: isToday && !selected ? `1.5px solid ${theme.palette.secondary.main}` : 'none',
                '&:hover': { bgcolor: selected ? 'primary.main' : 'action.hover' },
              }}
            >
              {d.date()}
              {marked && !selected && (
                <Box sx={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', bgcolor: 'secondary.main' }} />
              )}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
