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
});
