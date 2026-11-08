import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import type { StoredEvent } from '@/data/CalendarStore';
import { expandToItems } from './calendarUtils';
import { dayScheduleText, eventsToIcs, itemsToCsv } from './exporters';

const base: StoredEvent = {
  id: 'e1', title: 'Jana Samparka', description: '', type: 'JANA_SAMPARKA', status: 'SCHEDULED',
  start: '2026-11-06T10:30:00.000Z', end: '2026-11-06T12:30:00.000Z', allDay: false,
  recurrence: 'WEEKLY', recurrenceUntil: null, venue: 'MLA Office', area: 'Ward 09',
  organizer: '', contactName: 'PA', contactPhone: '9876543210', attendees: [],
};

describe('expandToItems', () => {
  it('turns a weekly event into one item per week, with unique ids', () => {
    const items = expandToItems([base], dayjs('2026-11-01'), dayjs('2026-12-01'));
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
    expect(items.every((i) => i.eventId === 'e1' && i.isRecurring)).toBe(true);
  });
});

describe('exports', () => {
  it('WhatsApp text lists the day, skipping cancelled events', () => {
    const day = dayjs('2026-11-06');
    const items = expandToItems([base, { ...base, id: 'e2', title: 'Cancelled thing', recurrence: 'NONE', status: 'CANCELLED' }], day, day.add(1, 'day'));
    const text = dayScheduleText(day, items);
    expect(text).toContain('Friday, 6 November 2026');
    expect(text).toContain('Jana Samparka');
    expect(text).toContain('MLA Office, Ward 09');
    expect(text).not.toContain('Cancelled thing');
  });

  it('CSV escapes commas and quotes', () => {
    const items = expandToItems([{ ...base, recurrence: 'NONE', title: 'Meet "DC", PWD' }], dayjs('2026-11-01'), dayjs('2026-12-01'));
    const csv = itemsToCsv(items);
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"Meet ""DC"", PWD"');
  });

  it('ICS carries repeat rules and all-day dates', () => {
    const ics = eventsToIcs([base, { ...base, id: 'e3', allDay: true, recurrence: 'NONE', start: '2026-10-31T18:30:00.000Z', end: '2026-11-01T18:29:00.000Z' }]);
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('DTSTART:20261106T103000Z');
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });
});
