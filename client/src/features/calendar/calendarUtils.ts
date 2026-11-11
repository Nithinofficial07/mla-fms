import dayjs, { type Dayjs } from 'dayjs';

export type CalendarView = 'year' | 'month' | 'week' | 'day' | 'agenda';

export interface AttendanceEntry {
  status: 'ATTENDED' | 'REPRESENTATIVE' | 'NOT_ATTENDED';
  members: string[];
  note: string;
  by?: string | null;
  at?: string | null;
}

export interface SocialEntry {
  status: 'POSTED' | 'SKIPPED';
  platforms: string[];
  caption: string;
  by?: string | null;
  at?: string | null;
}

export interface EventSession {
  start: string;
  end: string;
  arrival?: string;
}

/** One entry as returned by GET /calendar/events (an occurrence, or a request deadline). */
export interface CalendarItem {
  id: string;
  kind: 'event' | 'deadline' | 'holiday';
  /** holiday items only */
  holidaySource?: string;
  note?: string;
  eventId?: string;
  requestId?: string;
  title: string;
  description?: string;
  /** Kannada wording for posters (optional; falls back to an automatic conversion). */
  titleKn?: string;
  venueKn?: string;
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
  members: string[];
  organizer?: string;
  organizerKind?: 'IND' | 'SANGA';
  contactName?: string;
  contactPhone?: string;
  contact2Name?: string;
  contact2Phone?: string;
  attendees?: string[];
  rsvp?: Record<string, 'GOING' | 'UNDECIDED' | 'NOT_GOING'>;
  attendance?: Record<string, AttendanceEntry>;
  social?: Record<string, SocialEntry>;
  role?: string | null;
  prep?: string[];
  prepDone?: string[];
  prepNote?: string;
  arrival?: string;
  sessions?: EventSession[];
  speech?: { needed?: boolean; kn?: string; en?: string };
  reply?: 'PENDING' | 'CONFIRMED' | 'REGRET';
  publicSchedule?: boolean;
  writeup?: string;
  draft?: boolean;
  dateUnknown?: boolean;
  /** set by expandSessions on multi-day events */
  dayNo?: number;
  dayCount?: number;
  seriesArrival?: string;
}

/** Visible date range [from, to) for a view anchored on `date`. */
export function viewRange(view: CalendarView, date: Dayjs): { from: Dayjs; to: Dayjs } {
  switch (view) {
    case 'year': {
      const from = date.startOf('year');
      return { from, to: from.add(1, 'year') };
    }
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
  const unit = view === 'year' ? 'year' : view === 'month' ? 'month' : view === 'week' ? 'week' : view === 'agenda' ? 'month' : 'day';
  return date.add(dir, unit);
}

export function rangeTitle(view: CalendarView, date: Dayjs): string {
  if (view === 'year') return date.format('YYYY');
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
/** All-day, or 24 hours or longer. An overnight event (10 PM - 1 AM) stays in the time grid, split across both days. */
export function isAllDayLike(item: CalendarItem): boolean {
  return !!item.allDay || dayjs(item.end).diff(dayjs(item.start), 'minute') >= 24 * 60;
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

/* ------------------------------- holidays ------------------------------- */

export interface HolidaySource { code: string; label: string; short: string; color: string; note: string }

/** Holidays and world/national days in [from, to) as read-only calendar items. */
export function holidayItems(
  ref: { holidays?: Record<string, { date: string; name: string; note?: string }[]>; worldDaysEveryYear?: { monthDay: string; name: string }[] } | undefined,
  from: Dayjs,
  to: Dayjs,
  sources: string[],
): CalendarItem[] {
  if (!ref || !sources.length) return [];
  const out: CalendarItem[] = [];
  const f = from.format('YYYY-MM-DD');
  const t = to.format('YYYY-MM-DD');
  const push = (date: string, name: string, source: string, note?: string) => {
    if (date < f || date >= t) return;
    const d = dayjs(date);
    out.push({
      id: `hol:${source}:${date}:${name}`, kind: 'holiday', holidaySource: source, note, title: name,
      type: 'HOLIDAY', members: [], start: d.startOf('day').toISOString(), end: d.endOf('day').millisecond(0).toISOString(), allDay: true,
    });
  };
  for (const [source, list] of Object.entries(ref.holidays ?? {})) {
    if (!sources.includes(source)) continue;
    for (const h of list) push(h.date, h.name, source, h.note);
  }
  if (sources.includes('WORLD')) {
    for (let y = from.year(); y <= to.year(); y++) {
      for (const w of ref.worldDaysEveryYear ?? []) push(`${y}-${w.monthDay}`, w.name, 'WORLD');
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Government holiday that actually closes offices (not a restricted holiday, not one that falls on a Sunday). */
export const isClosedHoliday = (i: CalendarItem) =>
  i.kind === 'holiday' && (i.holidaySource === 'CENTRAL' || i.holidaySource === 'KARNATAKA') && !i.note?.startsWith('Falls on');

/** Decision for one calendar (defaults to "not decided"). */
export const rsvpOf = (i: Pick<CalendarItem, 'rsvp'>, code: string) => i.rsvp?.[code] ?? 'UNDECIDED';
export const goingMembers = (i: CalendarItem) => (i.members ?? []).filter((c) => rsvpOf(i, c) === 'GOING');
export const allDeclined = (i: CalendarItem) => !!i.members?.length && i.members.every((c) => rsvpOf(i, c) === 'NOT_GOING');

/** Expands a multi-day event (main day + sessions) into one item per day, so each shows on its own date/time. */
export function expandSessions(items: CalendarItem[]): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const it of items) {
    const sessions = it.kind === 'event' && !it.isRecurring ? it.sessions ?? [] : [];
    if (!sessions.length) { out.push(it); continue; }
    const count = sessions.length + 1;
    out.push({ ...it, dayNo: 1, dayCount: count });
    sessions.forEach((s, idx) => out.push({
      ...it, id: `${it.id}@${idx + 2}`, start: s.start, end: s.end, arrival: s.arrival ?? '', dayNo: idx + 2, dayCount: count,
      seriesStart: it.seriesStart ?? it.start, seriesEnd: it.seriesEnd ?? it.end, seriesArrival: it.arrival,
    }));
  }
  return out;
}

export const googleMapsUrl = (venue?: string, area?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue, area, 'Davanagere'].filter(Boolean).join(', '))}`;

export const fmtArrival = (hhmm?: string) => (hhmm ? dayjs(`2000-01-01T${hhmm}`).format('h:mm A') : '');
