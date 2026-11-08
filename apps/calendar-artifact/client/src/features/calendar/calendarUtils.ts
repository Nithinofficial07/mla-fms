import dayjs, { type Dayjs } from 'dayjs';
import { expandOccurrences } from '@cal/shared';
import type { StoredEvent } from '@/data/CalendarStore';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

/** One occurrence shown on the calendar (a repeating event yields one per date). `kind` leaves room for read-only layers later. */
export interface CalendarItem {
  id: string;
  kind: 'event' | 'deadline';
  eventId?: string;
  requestId?: string;
  title: string;
  description?: string;
  type: string;
  status?: string;
  start: string;
  end: string;
  allDay?: boolean;
  isRecurring?: boolean;
  recurrence?: string;
  recurrenceUntil?: string | null;
  seriesStart?: string;
  seriesEnd?: string;
  venue?: string;
  area?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
  organizer?: string;
  contactName?: string;
  contactPhone?: string;
  attendees?: string[];
}

/** Visible date range [from, to) for a view anchored on `date`. */
export function viewRange(view: CalendarView, date: Dayjs): { from: Dayjs; to: Dayjs } {
  switch (view) {
    case 'month': {
      const from = date.startOf('month').startOf('week');
      return { from, to: from.add(42, 'day') };
    }
    case 'week': {
      const from = date.startOf('week');
      return { from, to: from.add(7, 'day') };
    }
    case 'day':
      return { from: date.startOf('day'), to: date.startOf('day').add(1, 'day') };
    case 'agenda':
    default:
      return { from: date.startOf('day'), to: date.startOf('day').add(30, 'day') };
  }
}

export function stepDate(view: CalendarView, date: Dayjs, dir: 1 | -1): Dayjs {
  const unit = view === 'month' ? 'month' : view === 'week' ? 'week' : view === 'agenda' ? 'month' : 'day';
  return date.add(dir, unit);
}

export function rangeTitle(view: CalendarView, date: Dayjs): string {
  if (view === 'month') return date.format('MMMM YYYY');
  if (view === 'day') return date.format('dddd, D MMMM YYYY');
  const { from, to } = viewRange(view, date);
  const last = to.subtract(1, 'day');
  if (from.month() === last.month()) return `${from.format('D')} – ${last.format('D MMM YYYY')}`;
  if (from.year() === last.year()) return `${from.format('D MMM')} – ${last.format('D MMM YYYY')}`;
  return `${from.format('D MMM YYYY')} – ${last.format('D MMM YYYY')}`;
}

/** Does the item touch the given day? (all-day / multi-day aware) */
export function onDay(item: CalendarItem, day: Dayjs): boolean {
  const s = dayjs(item.start);
  const e = dayjs(item.end);
  const dayStart = day.startOf('day');
  const dayEnd = dayStart.add(1, 'day');
  if (item.allDay) return !s.startOf('day').isAfter(dayStart) && !e.startOf('day').isBefore(dayStart);
  if (e.isSame(s)) return s.isSame(dayStart, 'day');
  return s.isBefore(dayEnd) && e.isAfter(dayStart);
}

/** All-day, or spans more than one calendar day - shown in the all-day strip of week/day views. */
export function isAllDayLike(item: CalendarItem): boolean {
  return !!item.allDay || !dayjs(item.start).isSame(dayjs(item.end).subtract(1, 'minute'), 'day');
}

export function timeLabel(item: CalendarItem): string {
  if (item.allDay) return 'All day';
  const s = dayjs(item.start);
  const e = dayjs(item.end);
  if (s.isSame(e)) return s.format('h:mm A');
  if (s.isSame(e, 'day')) return `${s.format('h:mm')} – ${e.format('h:mm A')}`;
  return `${s.format('D MMM h:mm A')} – ${e.format('D MMM h:mm A')}`;
}

export interface PositionedItem {
  item: CalendarItem;
  /** minutes from the day's start */
  top: number;
  height: number;
  col: number;
  cols: number;
}

/**
 * Lays out the timed items of one day as side-by-side columns where they
 * overlap (the usual calendar "cluster" layout).
 */
export function layoutDay(items: CalendarItem[], day: Dayjs, minHeightMin = 20): PositionedItem[] {
  const dayStart = day.startOf('day');
  const spans = items
    .map((item) => {
      const s = Math.max(0, dayjs(item.start).diff(dayStart, 'minute'));
      const e = Math.min(24 * 60, dayjs(item.end).diff(dayStart, 'minute'));
      return { item, s, e: Math.max(e, s + minHeightMin) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: PositionedItem[] = [];
  let cluster: { item: CalendarItem; s: number; e: number; col: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) out.push({ item: c.item, top: c.s, height: c.e - c.s, col: c.col, cols });
    cluster = [];
  };

  for (const span of spans) {
    if (span.s >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.e > span.s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...span, col });
    clusterEnd = Math.max(clusterEnd, span.e);
  }
  if (cluster.length) flush();
  return out;
}

/** Rounds a Dayjs to the nearest `step` minutes. */
export function roundTo(d: Dayjs, step = 30): Dayjs {
  const m = d.minute();
  return d.minute(Math.round(m / step) * step).second(0).millisecond(0);
}

/** Expands saved events (repeats included) into the occurrences that overlap [from, to). */
export function expandToItems(events: StoredEvent[], from: Dayjs, to: Dayjs): CalendarItem[] {
  const out: CalendarItem[] = [];
  const f = from.toDate();
  const t = to.toDate();
  for (const ev of events) {
    const duration = Date.parse(ev.end) - Date.parse(ev.start);
    const recurring = !!ev.recurrence && ev.recurrence !== 'NONE';
    for (const occ of expandOccurrences(ev, f, t)) {
      out.push({
        ...ev,
        kind: 'event',
        eventId: ev.id,
        id: recurring ? `${ev.id}:${occ.toISOString()}` : ev.id,
        isRecurring: recurring,
        seriesStart: ev.start,
        seriesEnd: ev.end,
        start: occ.toISOString(),
        end: new Date(occ.getTime() + Math.max(0, duration)).toISOString(),
      });
    }
  }
  // All-day first, then by start time.
  return out.sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || Date.parse(a.start) - Date.parse(b.start));
}
