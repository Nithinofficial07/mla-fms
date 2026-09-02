import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { GramPanchayat, Constituency } from '../src/models/location.js';

const app = createApp();

describe('requests', () => {
  let token: string;
  let priorityId: string;
  let gpId: string;

  beforeEach(async () => {
    const { priority } = await seedCore();
    priorityId = String(priority._id);
    const c = await Constituency.findOne({ isPrimary: true });
    const gp = await GramPanchayat.create({ name: 'GP 1', constituencyId: c!._id });
    gpId = String(gp._id);
    token = await login(app);
  });

  const payload = () => ({
    subject: 'Broken hand pump',
    priorityId,
    applicant: { name: 'Ramesh Kumar', mobile: '9876543210' },
    location: { gramPanchayatId: gpId },
  });

  it('creates a draft with generated ids', async () => {
    const res = await request(app).post('/api/requests').set(auth(token)).send(payload());
    expect(res.status).toBe(201);
    expect(res.body.fileId).toMatch(/MLA\/\d{4}\/\d{6}/);
    expect(res.body.requestId).toMatch(/REQ\/\d{4}\/\d{6}/);
    expect(res.body.statusCode).toBe('DRAFT');
    expect(res.body.dueDate).toBeNull();
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
      .send({ ...payload(), applicant: { name: 'X', mobile: '123' } });
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
});
