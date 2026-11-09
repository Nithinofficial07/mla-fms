import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Box, ButtonBase, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_DEADLINE_COLOR, calendarTypeMeta } from '@mla/shared';
import { Icon } from '@/components/Icon';
import {
  isAllDayLike, layoutDay, onDay, roundTo, timeLabel, viewRange, type CalendarItem,
} from './calendarUtils';

export const itemColor = (item: CalendarItem) =>
  item.kind === 'deadline' ? CALENDAR_DEADLINE_COLOR : calendarTypeMeta(item.type).color;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SlotHandler = (start: Dayjs, end: Dayjs, allDay: boolean) => void;

/* --------------------------------- pill ---------------------------------- */
function EventPill({ item, onClick, compact }: { item: CalendarItem; onClick: (i: CalendarItem) => void; compact?: boolean }) {
  const color = itemColor(item);
  const filled = isAllDayLike(item) || item.kind === 'deadline';
  const muted = item.status === 'CANCELLED' || item.status === 'COMPLETED';
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      sx={{
        width: '100%', justifyContent: 'flex-start', textAlign: 'left',
        px: 0.75, py: compact ? 0.15 : 0.3, borderRadius: 1.25, gap: 0.6,
        fontSize: '0.75rem', lineHeight: 1.35, minWidth: 0,
        bgcolor: filled ? alpha(color, 0.16) : 'transparent',
        borderLeft: filled ? `3px solid ${color}` : 'none',
        color: 'text.primary',
        opacity: muted ? 0.55 : 1,
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: alpha(color, filled ? 0.26 : 0.12) },
      }}
    >
      {!filled && <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
      {!filled && (
        <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {dayjs(item.start).format('h:mma').replace(':00', '')}
        </Box>
      )}
      <Box
        component="span"
        sx={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600,
          textDecoration: item.status === 'CANCELLED' ? 'line-through' : 'none',
        }}
      >
        {item.kind === 'deadline' && <Icon name="Flag" sx={{ fontSize: 12, mr: 0.4, verticalAlign: '-2px', color }} />}
        {item.isRecurring && <Icon name="Autorenew" sx={{ fontSize: 11, mr: 0.3, verticalAlign: '-1px', color: 'text.secondary' }} />}
        {item.title}
      </Box>
    </ButtonBase>
  );
}

/* --------------------------------- month --------------------------------- */
export function MonthView({
  date, items, onSelect, onSlot, onShowDay,
}: {
  date: Dayjs; items: CalendarItem[]; onSelect: (i: CalendarItem) => void; onSlot?: SlotHandler; onShowDay: (d: Dayjs) => void;
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
          const dayItems = items.filter((it) => onDay(it, d));
          const extra = dayItems.length - maxShown;
          return (
            <Box
              key={d.toString()}
              onClick={() => (isSmall ? onShowDay(d) : onSlot?.(d.hour(10).minute(0), d.hour(11).minute(0), false))}
              sx={{
                borderRight: (idx + 1) % 7 ? 1 : 0, borderBottom: idx < 35 ? 1 : 0, borderColor: 'divider',
                p: { xs: 0.4, sm: 0.75 }, minWidth: 0,
                cursor: onSlot ? 'pointer' : 'default',
                bgcolor: !inMonth ? alpha(theme.palette.text.primary, 0.025) : d.day() === 0 ? alpha(theme.palette.error.main, 0.025) : 'transparent',
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
              {isSmall ? (
                <Stack direction="row" spacing={0.4} justifyContent="center" flexWrap="wrap" useFlexGap>
                  {dayItems.slice(0, 4).map((it) => (
                    <Box key={it.id} onClick={(e) => { e.stopPropagation(); onSelect(it); }} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: itemColor(it) }} />
                  ))}
                  {dayItems.length > 4 && <Typography variant="caption" sx={{ fontSize: 10, lineHeight: '7px' }}>+</Typography>}
                </Stack>
              ) : (
                <Stack spacing={0.35}>
                  {dayItems.slice(0, maxShown).map((it) => <EventPill key={it.id} item={it} onClick={onSelect} compact />)}
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

export function TimeGridView({
  date, days: dayCount, items, onSelect, onSlot, onShowDay,
}: {
  date: Dayjs; days: 1 | 7; items: CalendarItem[]; onSelect: (i: CalendarItem) => void; onSlot?: SlotHandler; onShowDay: (d: Dayjs) => void;
}) {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(dayjs());
  const { from } = viewRange(dayCount === 7 ? 'week' : 'day', date);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => from.add(i, 'day')), [from, dayCount]);

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_PX * 7.5;
  }, [dayCount]);

  const allDay = items.filter(isAllDayLike);
  const timed = items.filter((i) => !isAllDayLike(i));
  const cols = `56px repeat(${dayCount}, minmax(0, 1fr))`;
  const gridLine = theme.palette.divider;

  const slotClick = (d: Dayjs, e: MouseEvent<HTMLDivElement>) => {
    if (!onSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const start = roundTo(d.startOf('day').add(Math.floor(mins / 30) * 30, 'minute'), 30);
    onSlot(start, start.add(1, 'hour'), false);
  };

  return (
    <Box>
      {/* header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: cols, borderBottom: 1, borderColor: 'divider' }}>
        <Box />
        {days.map((d) => {
          const isToday = d.isSame(now, 'day');
          return (
            <ButtonBase key={d.toString()} onClick={() => onShowDay(d)} sx={{ py: 1, flexDirection: 'column', borderLeft: 1, borderColor: 'divider' }}>
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
        {days.map((d) => (
          <Stack
            key={d.toString()} spacing={0.35}
            onClick={() => onSlot?.(d.startOf('day'), d.startOf('day'), true)}
            sx={{ p: 0.4, borderLeft: 1, borderColor: 'divider', cursor: onSlot ? 'pointer' : 'default', minWidth: 0 }}
          >
            {allDay.filter((it) => onDay(it, d)).map((it) => <EventPill key={it.id} item={it} onClick={onSelect} compact />)}
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
          {days.map((d) => {
            const isToday = d.isSame(now, 'day');
            const positioned = layoutDay(timed.filter((it) => onDay(it, d)), d);
            return (
              <Box
                key={d.toString()}
                onClick={(e) => slotClick(d, e)}
                sx={{
                  position: 'relative', borderLeft: 1, borderColor: 'divider', cursor: onSlot ? 'pointer' : 'default',
                  backgroundImage: `repeating-linear-gradient(to bottom, ${gridLine} 0, ${gridLine} 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                  bgcolor: isToday ? alpha(theme.palette.secondary.main, 0.04) : 'transparent',
                }}
              >
                {positioned.map(({ item, top, height, col, cols: n }) => {
                  const color = itemColor(item);
                  const short = height < 40;
                  const muted = item.status === 'CANCELLED' || item.status === 'COMPLETED';
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
                        px: 0.75, py: 0.4, borderRadius: 1.5, overflow: 'hidden', textAlign: 'left',
                        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.16),
                        borderLeft: `3px solid ${color}`,
                        opacity: muted ? 0.55 : 1,
                        boxShadow: `0 1px 2px ${alpha('#000', 0.08)}`,
                        transition: 'transform .12s ease, box-shadow .12s ease',
                        '&:hover': { zIndex: 2, boxShadow: `0 6px 16px ${alpha(color, 0.35)}` },
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: short ? 'nowrap' : 'normal', textDecoration: item.status === 'CANCELLED' ? 'line-through' : 'none' }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                        {timeLabel(item)}{!short && item.venue ? ` · ${item.venue}` : ''}
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
export function AgendaView({ date, items, onSelect }: { date: Dayjs; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
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
        <Typography variant="subtitle1" sx={{ mt: 1 }}>Nothing scheduled in the next 30 days</Typography>
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
                return (
                  <ButtonBase
                    key={it.id} onClick={() => onSelect(it)}
                    sx={{
                      justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, p: 1.25, borderRadius: 2,
                      border: 1, borderColor: 'divider', opacity: it.status === 'CANCELLED' || it.status === 'COMPLETED' ? 0.6 : 1,
                      '&:hover': { borderColor: color, bgcolor: alpha(color, 0.06) },
                    }}
                  >
                    <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: color, flexShrink: 0 }} />
                    <Box sx={{ width: { xs: 62, sm: 128 }, flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}>
                        {it.kind === 'deadline' ? 'Due' : timeLabel(it)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: { xs: 'block', sm: 'none' } }}>
                        {it.kind === 'deadline' ? 'Due' : it.allDay ? 'All day' : dayjs(it.start).format('h:mm A')}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, textDecoration: it.status === 'CANCELLED' ? 'line-through' : 'none' }} noWrap>
                        {it.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {[it.kind === 'deadline' ? 'Request deadline' : calendarTypeMeta(it.type).label, it.venue, it.area].filter(Boolean).join(' · ')}
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
