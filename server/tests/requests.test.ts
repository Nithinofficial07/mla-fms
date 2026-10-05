import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ROLES } from '@mla/shared';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { GramPanchayat, Constituency } from '../src/models/location.js';
import { Principal } from '../src/models/Principal.js';
import { User } from '../src/models/User.js';
import { Department } from '../src/models/Department.js';
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

  it('allows resolving to COMPLETED from any non-terminal stage, not just the "normal" end of the path', async () => {
    const { RequestStatus } = await import('../src/models/config.js');
    await RequestStatus.create({ code: 'COMPLETED', name: 'Completed', order: 10, transitionsTo: ['CLOSED'] });
    // Mirrors the real seed: ASSIGNED's graph includes COMPLETED now, not just FORWARDED/IN_PROGRESS.
    await RequestStatus.findOneAndUpdate({ code: 'ASSIGNED' }, { $addToSet: { transitionsTo: 'COMPLETED' } });

    const created = await request(app).post('/api/requests').set(auth(token)).send({ ...payload(), submit: true });
    const id = created.body.id;
    await request(app).post(`/api/requests/${id}/status`).set(auth(token)).send({ toStatusCode: 'UNDER_REVIEW' });
    const assigned = await request(app).post(`/api/requests/${id}/status`).set(auth(token)).send({ toStatusCode: 'ASSIGNED' });
    expect(assigned.status).toBe(200);

    // Jump straight to COMPLETED from ASSIGNED, skipping FORWARDED/IN_PROGRESS entirely - no remark sent.
    const solved = await request(app).post(`/api/requests/${id}/status`).set(auth(token)).send({ toStatusCode: 'COMPLETED' });
    expect(solved.status).toBe(200);
    expect(solved.body.statusCode).toBe('COMPLETED');
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

  describe('remarks carry the commenter\'s department', () => {
    it('attributes a remark to the author\'s department, for the Latest Comments card', async () => {
      const created = await request(app).post('/api/requests').set(auth(token)).send(payload());
      const dept = await Department.create({ code: 'PWD', name: 'Public Works' });
      await User.create({
        name: 'Ravi Officer', username: 'ravipwd', email: 'ravipwd@test.local',
        passwordHash: await hashPassword('Admin@12345'),
        roleId: roles[ROLES.DEPARTMENT_OFFICER]._id, roleCode: ROLES.DEPARTMENT_OFFICER,
        departmentId: dept._id, principalIds: [principalId],
      });
      const officerToken = await login(app, 'ravipwd@test.local');

      const addRemark = await request(app)
        .post(`/api/requests/${created.body.id}/remarks`)
        .set(auth(officerToken))
        .send({ body: 'Site inspected, work scheduled for next week.' });
      expect(addRemark.status).toBe(201);

      const list = await request(app).get(`/api/requests/${created.body.id}/remarks`).set(auth(token));
      expect(list.status).toBe(200);
      expect(list.body[0].authorName).toBe('Ravi Officer');
      expect(list.body[0].authorDepartmentId?.name).toBe('Public Works');
    });

    it('leaves the department blank for a remark from MLA office staff with no department', async () => {
      const created = await request(app).post('/api/requests').set(auth(token)).send(payload());
      await request(app).post(`/api/requests/${created.body.id}/remarks`).set(auth(token)).send({ body: 'Forwarded for review.' });

      const list = await request(app).get(`/api/requests/${created.body.id}/remarks`).set(auth(token));
      expect(list.body[0].authorDepartmentId).toBeNull();
    });
  });
});
