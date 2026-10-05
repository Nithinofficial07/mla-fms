import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ROLES } from '@mla/shared';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { GramPanchayat, Constituency } from '../src/models/location.js';
import { Principal } from '../src/models/Principal.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';

const app = createApp();

describe('requests', () => {
  let token: string;
  let priorityId: string;
  let gpId: string;
  let principalId: string;
  let roles: Record<string, any>;

  beforeEach(async () => {
    const seeded = await seedCore();
    roles = seeded.roles;
    priorityId = String(seeded.priority._id);
    principalId = String(seeded.principal._id);
    const c = await Constituency.findOne({ isPrimary: true });
    const gp = await GramPanchayat.create({ name: 'GP 1', constituencyId: c!._id });
    gpId = String(gp._id);
    token = await login(app);
  });

  const payload = () => ({
    subject: 'Broken hand pump',
    priorityId,
    principalId,
    applicant: { firstName: 'Ramesh', lastName: 'Kumar', mobile: '9876543210' },
    location: { locationType: 'RURAL', gramPanchayatId: gpId },
  });

  it('creates a draft with generated ids', async () => {
    const res = await request(app).post('/api/requests').set(auth(token)).send(payload());
    expect(res.status).toBe(201);
    expect(res.body.fileId).toMatch(/MLA-S\/\d{5}/);
    expect(res.body.requestId).toMatch(/REQ\/\d{4}\/\d{6}/);
    expect(res.body.statusCode).toBe('DRAFT');
    expect(res.body.dueDate).toBeNull();
    expect(res.body.applicant.name).toBe('Ramesh Kumar');
  });

  it('creates a request without a priority (no longer collected at intake)', async () => {
    const { priorityId: _drop, ...rest } = payload();
    const res = await request(app).post('/api/requests').set(auth(token)).send(rest);
    expect(res.status).toBe(201);
    expect(res.body.priorityId).toBeNull();
  });

  it('submits straight away when submit=true and sets a due date', async () => {
    const res = await request(app).post('/api/requests').set(auth(token)).send({ ...payload(), submit: true });
    expect(res.status).toBe(201);
    expect(res.body.statusCode).toBe('SUBMITTED');
    expect(res.body.dueDate).not.toBeNull();
  });

  it('rejects an invalid mobile number', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set(auth(token))
      .send({ ...payload(), applicant: { firstName: 'X', lastName: 'Y', mobile: '123' } });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeTruthy();
  });

  it('enforces the status transition graph', async () => {
    const created = await request(app).post('/api/requests').set(auth(token)).send({ ...payload(), submit: true });
    const id = created.body.id;
    const bad = await request(app).post(`/api/requests/${id}/status`).set(auth(token)).send({ toStatusCode: 'ASSIGNED' });
    expect(bad.status).toBe(409);
    const good = await request(app).post(`/api/requests/${id}/status`).set(auth(token)).send({ toStatusCode: 'UNDER_REVIEW' });
    expect(good.status).toBe(200);
    expect(good.body.statusCode).toBe('UNDER_REVIEW');
  });

  it('records a timeline for lifecycle events', async () => {
    const created = await request(app).post('/api/requests').set(auth(token)).send({ ...payload(), submit: true });
    const res = await request(app).get(`/api/requests/${created.body.id}/timeline`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.map((t: { action: string }) => t.action)).toContain('FILE_CREATED');
  });

  it('lists with pagination envelope', async () => {
    await request(app).post('/api/requests').set(auth(token)).send(payload());
    const res = await request(app).get('/api/requests?page=1&pageSize=10').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('totalPages');
  });

  describe('visit count (repeat-applicant tracking)', () => {
    it('counts how many requests this mobile number has filed with this principal, including the current one', async () => {
      const first = await request(app).post('/api/requests').set(auth(token)).send(payload());
      let detail = await request(app).get(`/api/requests/${first.body.id}`).set(auth(token));
      expect(detail.body.visitCount).toBe(1);

      const second = await request(app).post('/api/requests').set(auth(token)).send(payload());
      detail = await request(app).get(`/api/requests/${second.body.id}`).set(auth(token));
      expect(detail.body.visitCount).toBe(2);
      // Earlier requests reflect the running total too, not a snapshot from when they were filed.
      detail = await request(app).get(`/api/requests/${first.body.id}`).set(auth(token));
      expect(detail.body.visitCount).toBe(2);
    });

    it('does not count a visit filed with a different principal', async () => {
      const southRequest = await request(app).post('/api/requests').set(auth(token)).send(payload());

      const principalN = await Principal.create({ code: 'MLA_N', label: 'MLA – North', idPrefix: 'MLA-N' });
      await User.create({
        name: 'Admin North', username: 'adminnorth', email: 'adminnorth@test.local',
        passwordHash: await hashPassword('Admin@12345'),
        roleId: roles[ROLES.SUPER_ADMIN]._id, roleCode: ROLES.SUPER_ADMIN,
        principalIds: [principalN._id],
      });
      const tokenNorth = await login(app, 'adminnorth@test.local');

      // Same mobile number, same subject/location - but filed against the North principal.
      await request(app).post('/api/requests').set(auth(tokenNorth)).send({ ...payload(), principalId: String(principalN._id) });

      const detail = await request(app).get(`/api/requests/${southRequest.body.id}`).set(auth(token));
      expect(detail.body.visitCount).toBe(1);
    });
  });
});
