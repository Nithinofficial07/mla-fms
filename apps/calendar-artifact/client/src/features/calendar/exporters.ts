import dayjs, { type Dayjs } from 'dayjs';
import { CALENDAR_RECURRENCE, calendarTypeMeta } from '@cal/shared';
import type { StoredEvent } from '@/data/CalendarStore';
import { timeLabel, type CalendarItem } from './calendarUtils';

/** A day's schedule as plain text, ready to paste into WhatsApp. */
export function dayScheduleText(day: Dayjs, items: CalendarItem[]): string {
  const lines = [`*MLA Schedule - ${day.format('dddd, D MMMM YYYY')}*`, ''];
  const list = items.filter((i) => i.status !== 'CANCELLED');
  if (!list.length) lines.push('No events scheduled.');
  list.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.allDay ? 'All day' : dayjs(it.start).format('h:mm A')} - ${it.title}`);
    const where = [it.venue, it.area].filter(Boolean).join(', ');
    if (where) lines.push(`   📍 ${where}`);
    if (it.contactName || it.contactPhone) lines.push(`   📞 ${[it.contactName, it.contactPhone].filter(Boolean).join(' ')}`);
  });
  return lines.join('\n');
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Occurrences in range as CSV (opens in Excel). BOM so Kannada text shows correctly. */
export function itemsToCsv(items: CalendarItem[]): string {
  const head = ['Date', 'Day', 'Time', 'Title', 'Type', 'Status', 'Venue', 'Ward / Village', 'Organiser', 'Contact', 'Phone', 'Attendees', 'Notes'];
  const rows = items.map((it) => [
    dayjs(it.start).format('DD-MM-YYYY'),
    dayjs(it.start).format('ddd'),
    timeLabel(it),
    it.title,
    calendarTypeMeta(it.type).label,
    it.status ?? '',
    it.venue ?? '',
    it.area ?? '',
    it.organizer ?? '',
    it.contactName ?? '',
    it.contactPhone ?? '',
    (it.attendees ?? []).join('; '),
    it.description ?? '',
  ]);
  return '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (iso: string) => dayjs(iso).toDate().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDay = (iso: string) => dayjs(iso).format('YYYYMMDD');
const RRULE: Record<string, string> = {
  DAILY: 'FREQ=DAILY', WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA', WEEKLY: 'FREQ=WEEKLY', MONTHLY: 'FREQ=MONTHLY', YEARLY: 'FREQ=YEARLY',
};

/** Saved events as an .ics file - imports into Google Calendar / phone calendars, repeats included. */
export function eventsToIcs(events: StoredEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MLA Office Davanagere South//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:MLA Office Calendar'];
  const stamp = icsDate(new Date().toISOString());
  for (const ev of events) {
    if (ev.status === 'CANCELLED') continue;
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@mla-office-calendar`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDay(ev.start)}`, `DTEND;VALUE=DATE:${dayjs(ev.end).add(1, 'day').format('YYYYMMDD')}`);
    } else {
      lines.push(`DTSTART:${icsDate(ev.start)}`, `DTEND:${icsDate(ev.end)}`);
    }
    if (RRULE[ev.recurrence]) {
      const until = ev.recurrenceUntil ? `;UNTIL=${dayjs(ev.recurrenceUntil).format('YYYYMMDD')}T235959Z` : '';
      lines.push(`RRULE:${RRULE[ev.recurrence]}${until}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    const where = [ev.venue, ev.area].filter(Boolean).join(', ');
    if (where) lines.push(`LOCATION:${icsEscape(where)}`);
    const desc = [
      calendarTypeMeta(ev.type).label,
      ev.organizer && `Organiser: ${ev.organizer}`,
      (ev.contactName || ev.contactPhone) && `Contact: ${[ev.contactName, ev.contactPhone].filter(Boolean).join(' ')}`,
      ev.attendees.length && `Attendees: ${ev.attendees.join(', ')}`,
      ev.description,
      ev.recurrence !== 'NONE' && CALENDAR_RECURRENCE.find((r) => r.code === ev.recurrence)?.label,
    ].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    if (ev.status === 'TENTATIVE') lines.push('STATUS:TENTATIVE');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
