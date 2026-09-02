import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { Constituency, GramPanchayat } from '../src/models/location.js';
import { Department } from '../src/models/Department.js';

const app = createApp();

describe('MLA letters', () => {
  let token: string;
  let gpId: string;
  let deptId: string;

  beforeEach(async () => {
    await seedCore();
    const c = await Constituency.findOne({ isPrimary: true });
    gpId = String((await GramPanchayat.create({ name: 'GP 1', constituencyId: c!._id }))._id);
    deptId = String((await Department.create({ code: 'RD', name: 'Rural Dev' }))._id);
    token = await login(app);
  });

  const payload = () => ({
    subject: 'Recommendation to sanction culvert',
    referredBy: 'Ward Member',
    applicant: { name: 'Kamala Devi', mobile: '9876500011', altMobile: '9876500022', address: 'Near temple' },
    location: { gramPanchayatId: gpId },
    departmentId: deptId,
    departmentLetterNo: 'RD/2026/9',
  });

  it('creates a letter with an auto letter number (DRAFT by default)', async () => {
    const res = await request(app).post('/api/letters').set(auth(token)).send(payload());
    expect(res.status).toBe(201);
    expect(res.body.letterNo).toMatch(/MLA-LTR\/\d{4}\/\d{4}/);
    expect(res.body.status).toBe('DRAFT');
  });

  it('creates as ISSUED when issue=true', async () => {
    const res = await request(app).post('/api/letters').set(auth(token)).send({ ...payload(), issue: true });
    expect(res.body.status).toBe('ISSUED');
  });

  it('requires a ward or gram panchayat', async () => {
    const res = await request(app).post('/api/letters').set(auth(token)).send({ ...payload(), location: {} });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeTruthy();
  });

  it('validates the phone number', async () => {
    const res = await request(app)
      .post('/api/letters')
      .set(auth(token))
      .send({ ...payload(), applicant: { name: 'X', mobile: '123' } });
    expect(res.status).toBe(400);
  });

  it('returns a populated detail and supports status changes', async () => {
    const created = await request(app).post('/api/letters').set(auth(token)).send(payload());
    const id = created.body.id;

    const detail = await request(app).get(`/api/letters/${id}`).set(auth(token));
    expect(detail.status).toBe(200);
    expect(detail.body.departmentId.name).toBe('Rural Dev');
    expect(detail.body.location.gramPanchayatId.name).toBe('GP 1');
    expect(detail.body.applicant.altMobile).toBe('9876500022');

    const moved = await request(app).post(`/api/letters/${id}/status`).set(auth(token)).send({ status: 'DISPATCHED' });
    expect(moved.status).toBe(200);
    expect(moved.body.status).toBe('DISPATCHED');

    const bad = await request(app).post(`/api/letters/${id}/status`).set(auth(token)).send({ status: 'NOPE' });
    expect(bad.status).toBe(400);
  });

  it('filters by status and search, and lists with the pagination envelope', async () => {
    await request(app).post('/api/letters').set(auth(token)).send({ ...payload(), issue: true });
    await request(app).post('/api/letters').set(auth(token)).send(payload());

    const issued = await request(app).get('/api/letters?status=ISSUED').set(auth(token));
    expect(issued.body.total).toBe(1);

    const searched = await request(app).get('/api/letters?search=Kamala').set(auth(token));
    expect(searched.body.total).toBe(2);
    expect(searched.body).toHaveProperty('totalPages');
  });
});
