import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ROLES } from '@mla/shared';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';

const app = createApp();

describe('calendar', () => {
  let token: string;
  let roles: Record<string, { _id: unknown }>;

  beforeEach(async () => {
    ({ roles } = await seedCore());
    token = await login(app);
  });

  const payload = (overrides: Record<string, unknown> = {}) => ({
    members: ['MLA_S'],
    title: 'Review meeting with PWD',
    type: 'MEETING_OFFICIAL',
    start: '2026-12-01T04:30:00.000Z',
    end: '2026-12-01T05:30:00.000Z',
    ...overrides,
  });

  it('creates an event scoped to the caller\'s own calendar', async () => {
    const res = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    expect(res.status).toBe(201);
    expect(res.body.members).toEqual(['MLA_S']);
    expect(res.body.id).toBeTruthy();
    expect(res.body.publicSchedule).toBe(false); // MEETING_OFFICIAL is private by default
  });

  it('saves per-calendar RSVP from the editor, and finds the event by venue, organiser or phone digits', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload({
      venue: 'Kalyana Mantapa', organizer: 'Vasavi Sangha', contactName: 'Ramesh', contactPhone: '98450 12345',
      rsvp: { MLA_S: 'GOING' },
    }));
    expect(created.status).toBe(201);
    expect(created.body.rsvp.MLA_S).toBe('GOING');

    for (const q of ['kalyana', 'vasavi sangha', '98450']) {
      const res = await request(app).get('/api/calendar/search').set(auth(token)).query({ q });
      expect(res.status).toBe(200);
      expect(res.body.map((e: { eventId: string }) => e.eventId)).toContain(created.body.id);
    }
    const none = await request(app).get('/api/calendar/search').set(auth(token)).query({ q: 'nothing-like-this' });
    expect(none.body).toEqual([]);

    const sugg = await request(app).get('/api/calendar/suggestions').set(auth(token));
    expect(sugg.status).toBe(200);
    expect(sugg.body.venues).toContain('Kalyana Mantapa');
    expect(sugg.body.contacts).toContainEqual({ name: 'Ramesh', phone: '98450 12345' });
  });

  it('lists a past "going" event under To check until attendance is marked, and clears a mark with null', async () => {
    const start = new Date(Date.now() - 3 * 86_400_000);
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload({
      start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString(), rsvp: { MLA_S: 'GOING' },
    }));
    const id = created.body.id;
    const ids = async () => (await request(app).get('/api/calendar/worklists').set(auth(token))).body.toCheck.map((e: { id: string }) => e.id);
    expect(await ids()).toContain(id);

    const marked = await request(app).post(`/api/calendar/events/${id}/attendance`).set(auth(token)).send({ code: 'MLA_S', status: 'ATTENDED', members: ['Suresh'], note: 'Spoke briefly' });
    expect(marked.status).toBe(200);
    expect(marked.body.attendance.MLA_S.status).toBe('ATTENDED');
    expect(await ids()).not.toContain(id);

    const cleared = await request(app).post(`/api/calendar/events/${id}/attendance`).set(auth(token)).send({ code: 'MLA_S', status: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.attendance?.MLA_S).toBeUndefined();
    expect(await ids()).toContain(id);
  });

  it('legacyId index fix: after it runs, any number of normal events can be created', async () => {
    const { fixCalendarLegacyIdIndex } = await import('../src/migrations/fixes.js');
    const { CalendarEvent } = await import('../src/models/CalendarEvent.js');
    // Recreate the old, broken state: unique sparse index + an event saved with legacyId: null.
    await CalendarEvent.collection.dropIndexes().catch(() => {});
    await CalendarEvent.collection.createIndex({ legacyId: 1 }, { unique: true, sparse: true });
    await CalendarEvent.collection.insertOne({ title: 'old', members: ['MLA_S'], start: new Date(), end: new Date(), legacyId: null, deletedAt: null });

    const result = await fixCalendarLegacyIdIndex();
    expect(result).toMatchObject({ droppedOldIndex: true, nullsRemoved: 1 });

    for (const title of ['First', 'Second']) {
      const res = await request(app).post('/api/calendar/events').set(auth(token)).send(payload({ title }));
      expect(res.status).toBe(201);
    }
    // Import ids stay unique.
    await CalendarEvent.collection.insertOne({ title: 'imp', members: ['MLA_S'], start: new Date(), end: new Date(), legacyId: 'google:x' });
    await expect(CalendarEvent.collection.insertOne({ title: 'dup', members: ['MLA_S'], start: new Date(), end: new Date(), legacyId: 'google:x' })).rejects.toThrow();
  });

  it('expands SS Family to all 3 real calendars on save', async () => {
    const res = await request(app).post('/api/calendar/events').set(auth(token)).send(payload({ members: ['SS_FAMILY'] }));
    expect(res.status).toBe(201);
    expect(res.body.members.sort()).toEqual(['MLA_N', 'MLA_S', 'MP']);
  });

  it('rejects an event with no members', async () => {
    const res = await request(app).post('/api/calendar/events').set(auth(token)).send(payload({ members: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects end before start', async () => {
    const res = await request(app).post('/api/calendar/events').set(auth(token)).send(
      payload({ start: '2026-12-01T05:30:00.000Z', end: '2026-12-01T04:30:00.000Z' }),
    );
    expect(res.status).toBe(400);
  });

  it('lists events overlapping a range, and 404s a detail fetch outside the caller\'s scope', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    const id = created.body.id;

    const list = await request(app).get('/api/calendar/events').set(auth(token)).query({
      from: '2026-11-25T00:00:00.000Z', to: '2026-12-05T00:00:00.000Z',
    });
    expect(list.status).toBe(200);
    expect(list.body.some((e: { eventId: string }) => e.eventId === id)).toBe(true);

    const detail = await request(app).get(`/api/calendar/events/${id}`).set(auth(token));
    expect(detail.status).toBe(200);
    expect(detail.body.title).toBe('Review meeting with PWD');
  });

  it('records an RSVP per calendar and reflects it back', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    const id = created.body.id;

    const res = await request(app).post(`/api/calendar/events/${id}/rsvp`).set(auth(token)).send({ code: 'MLA_S', status: 'GOING' });
    expect(res.status).toBe(200);
    expect(res.body.rsvp.MLA_S).toBe('GOING');
  });

  it('rejects an RSVP from a calendar not invited to the event', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    const id = created.body.id;
    const res = await request(app).post(`/api/calendar/events/${id}/rsvp`).set(auth(token)).send({ code: 'MP', status: 'GOING' });
    expect(res.status).toBe(400);
  });

  it('flags a clash when a calendar is already Going to an overlapping event', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    await request(app).post(`/api/calendar/events/${created.body.id}/rsvp`).set(auth(token)).send({ code: 'MLA_S', status: 'GOING' });

    const res = await request(app).post('/api/calendar/clashes').set(auth(token)).send({
      members: ['MLA_S'], start: '2026-12-01T04:45:00.000Z', end: '2026-12-01T05:15:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reason).toBe('GOING');
  });

  it('adds a Quick Event as a draft, then clears draft on a normal edit', async () => {
    const created = await request(app).post('/api/calendar/events/quick').set(auth(token)).send({
      members: ['MLA_S'], title: 'Someone to call back', dateUnknown: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.draft).toBe(true);
    expect(created.body.dateUnknown).toBe(true);

    const edited = await request(app).patch(`/api/calendar/events/${created.body.id}`).set(auth(token)).send(
      payload({ title: 'Called back, meeting set', dateUnknown: false }),
    );
    expect(edited.status).toBe(200);
    expect(edited.body.dateUnknown).toBe(false);
  });

  it('marks a calendar away for a date range as an all-day UNAVAILABLE event', async () => {
    const res = await request(app).post('/api/calendar/away').set(auth(token)).send({
      members: ['MLA_S'], start: '2026-12-10T00:00:00.000Z', end: '2026-12-12T00:00:00.000Z', reason: 'Assembly session',
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('UNAVAILABLE');
    expect(res.body.allDay).toBe(true);
  });

  it('soft-deletes an event (it no longer appears in a later list)', async () => {
    const created = await request(app).post('/api/calendar/events').set(auth(token)).send(payload());
    const del = await request(app).delete(`/api/calendar/events/${created.body.id}`).set(auth(token));
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/calendar/events').set(auth(token)).query({
      from: '2026-11-25T00:00:00.000Z', to: '2026-12-05T00:00:00.000Z',
    });
    expect(list.body.some((e: { eventId: string }) => e.eventId === created.body.id)).toBe(false);
  });

  it('blocks a viewer from creating an event, but still lets them read', async () => {
    const viewer = await User.create({
      name: 'Viewer', username: 'viewer', email: 'viewer@test.local',
      passwordHash: await hashPassword('Viewer@12345'),
      roleId: roles[ROLES.VIEWER]._id, roleCode: ROLES.VIEWER,
    });
    const viewerToken = await login(app, 'viewer@test.local', 'Viewer@12345');
    void viewer;

    const denied = await request(app).post('/api/calendar/events').set(auth(viewerToken)).send(payload());
    expect(denied.status).toBe(403);

    const list = await request(app).get('/api/calendar/events').set(auth(viewerToken)).query({
      from: '2026-11-25T00:00:00.000Z', to: '2026-12-05T00:00:00.000Z',
    });
    expect(list.status).toBe(200);
  });

  it('serves the reference data (types, holidays, Kannada labels)', async () => {
    const res = await request(app).get('/api/calendar/reference').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.calendars).toBeTruthy();
    expect(Object.keys(res.body.kannadaLabels).length).toBeGreaterThan(100);
  });

  describe('Google Calendar .ics import', () => {
    const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const icsDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

    function buildIcs() {
      const now = new Date();
      const oneOffStart = new Date(now.getTime() + 3 * 86_400_000);
      const oneOffEnd = new Date(oneOffStart.getTime() + 60 * 60_000);
      const allDayStart = new Date(now.getTime() + 5 * 86_400_000);
      const allDayEnd = new Date(allDayStart.getTime() + 86_400_000); // ICS all-day DTEND is exclusive
      const weeklyStart = new Date(now.getTime() + 86_400_000);
      const weeklyEnd = new Date(weeklyStart.getTime() + 30 * 60_000);

      return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:oneoff-1@google.com',
        `DTSTART:${icsUtc(oneOffStart)}`,
        `DTEND:${icsUtc(oneOffEnd)}`,
        'SUMMARY:Meet the ward members',
        'LOCATION:MLA Office',
        'DESCRIPTION:Discuss drainage works',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:allday-1@google.com',
        `DTSTART;VALUE=DATE:${icsDate(allDayStart)}`,
        `DTEND;VALUE=DATE:${icsDate(allDayEnd)}`,
        'SUMMARY:Assembly session',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:weekly-1@google.com',
        `DTSTART:${icsUtc(weeklyStart)}`,
        `DTEND:${icsUtc(weeklyEnd)}`,
        'SUMMARY:Weekly grievance hearing',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    }

    it('imports one-off, all-day, and weekly-recurring events onto the chosen calendar', async () => {
      const res = await request(app)
        .post('/api/calendar/import-ics')
        .set(auth(token))
        .field('members', 'MLA_S')
        .attach('file', Buffer.from(buildIcs()), 'calendar.ics');

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(6); // 1 one-off + 1 all-day + 4 weekly occurrences
      expect(res.body.skipped).toBe(0);

      const list = await request(app).get('/api/calendar/events').set(auth(token)).query({
        from: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        to: new Date(Date.now() + 40 * 86_400_000).toISOString(),
      });
      const titles = list.body.map((e: { title: string }) => e.title as string);
      expect(titles.filter((t: string) => t === 'Meet the ward members')).toHaveLength(1);
      expect(titles.filter((t: string) => t === 'Assembly session')).toHaveLength(1);
      expect(titles.filter((t: string) => t === 'Weekly grievance hearing')).toHaveLength(4);

      const allDay = list.body.find((e: { title: string }) => e.title === 'Assembly session');
      expect(allDay.allDay).toBe(true);
      const oneOff = list.body.find((e: { title: string }) => e.title === 'Meet the ward members');
      expect(oneOff.venue).toBe('MLA Office');
      expect(oneOff.description).toBe('Discuss drainage works');
      expect(oneOff.members).toEqual(['MLA_S']);
    });

    it('is idempotent - importing the same file twice does not duplicate events', async () => {
      const ics = buildIcs();
      const first = await request(app).post('/api/calendar/import-ics').set(auth(token)).field('members', 'MLA_S').attach('file', Buffer.from(ics), 'calendar.ics');
      expect(first.body.created).toBe(6);

      const second = await request(app).post('/api/calendar/import-ics').set(auth(token)).field('members', 'MLA_S').attach('file', Buffer.from(ics), 'calendar.ics');
      expect(second.body.created).toBe(0);
      expect(second.body.updated).toBe(6);
    });

    it('guesses each event type from its title, strips Google Meet boilerplate, and never exposes legacyId', async () => {
      const start = new Date(Date.now() + 2 * 86_400_000);
      const meet = [
        '-::~:~::~:~:~:~:~:~:~:~:~::~:~::-',
        'Join with Google Meet: https://meet.google.com/abc-defg-hij',
        '',
        'Learn more about Meet at: https://support.google.com/a/users/answer/9282720',
        '',
        'Please do not edit this section.',
        '-::~:~::~:~:~:~:~:~:~:~:~::~:~::-',
      ].join('\n');
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'BEGIN:VEVENT', 'UID:wed-1@google.com', `DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(new Date(start.getTime() + 3_600_000))}`,
        'SUMMARY:Wedding(Ravi weds Anusha)', `DESCRIPTION:Contact 98450 12345\n${meet}`, 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:temple-1@google.com', `DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(new Date(start.getTime() + 3_600_000))}`,
        'SUMMARY:ಶ್ರೀ ಗಂಗಾಪರಮೇಶ್ವರಿ ದೇವಸ್ಥಾನ ಉದ್ಘಾಟನಾ ಕಾರ್ಯಕ್ರಮ', 'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const res = await request(app).post('/api/calendar/import-ics').set(auth(token)).field('members', 'MLA_S').attach('file', Buffer.from(ics), 'c.ics');
      expect(res.body.created).toBe(2);

      const list = await request(app).get('/api/calendar/events').set(auth(token)).query({
        from: new Date(Date.now()).toISOString(), to: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      });
      const wedding = list.body.find((e: { title: string }) => e.title.startsWith('Wedding'));
      expect(wedding.type).toBe('EVENT_T2');
      expect(wedding.description).toBe('Contact 98450 12345');
      expect(wedding.contactPhone).toBe('98450 12345');
      expect(wedding.publicSchedule).toBe(true);
      expect(wedding).not.toHaveProperty('legacyId');
      expect(list.body.find((e: { title: string }) => e.title.includes('ದೇವಸ್ಥಾನ')).type).toBe('EVENT_T3');
    });

    it('the one-time cleanup re-types already-imported events and keeps a backup of the old values', async () => {
      const { cleanupGoogleImports } = await import('../src/migrations/fixes.js');
      const { CalendarEvent } = await import('../src/models/CalendarEvent.js');
      const base = { members: ['MLA_S'], start: new Date(), end: new Date(Date.now() + 3_600_000), deletedAt: null, publicSchedule: false, contactPhone: '' };
      await CalendarEvent.collection.insertMany([
        { ...base, legacyId: 'google:a', title: 'Reception(Manoj G weds Devika)', type: 'MEETING_OFFICIAL', description: '-::~:~::-\nJoin with Google Meet: https://meet.google.com/x\nPlease do not edit this section.\n-::~:~::-' },
        { ...base, legacyId: 'google:b', title: 'Zilla Panchayat review', type: 'MEETING_OFFICIAL', description: '' },
        { ...base, legacyId: 'google:c', title: 'Kept by hand', type: 'SITE_VISIT', description: '' },
        { ...base, legacyId: 'google:d', title: '100 Cr', type: 'MEETING_OFFICIAL', description: '' },
      ]);
      const result = await cleanupGoogleImports() as { updated: number };
      expect(result.updated).toBe(2);
      const byId = async (id: string) => CalendarEvent.collection.findOne({ legacyId: id });
      expect(await byId('google:a')).toMatchObject({ type: 'EVENT_T2', description: '', publicSchedule: true });
      expect(await byId('google:b')).toMatchObject({ type: 'MEETING_GOVERNANCE' });
      expect(await byId('google:c')).toMatchObject({ type: 'SITE_VISIT' }); // already re-sorted - untouched
      expect(await byId('google:d')).toMatchObject({ type: 'MEETING_OFFICIAL' }); // unrecognisable - untouched
      expect(await CalendarEvent.db.collection('calendar_import_backup').countDocuments()).toBe(2);
    });

    it('rejects a non-.ics file', async () => {
      const res = await request(app).post('/api/calendar/import-ics').set(auth(token)).field('members', 'MLA_S').attach('file', Buffer.from('not ics'), 'notes.txt');
      expect(res.status).toBe(400);
    });
  });
});
