import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { Department } from '../src/models/Department.js';

const app = createApp();

describe('funding requests', () => {
  let token: string;
  let departmentId: string;

  beforeEach(async () => {
    await seedCore();
    token = await login(app);
    const dept = await Department.create({ code: 'AGRI', name: 'Agriculture Department', ministryName: 'Minister for Agriculture, Government of Karnataka' });
    departmentId = String(dept._id);
  });

  it('creates a funding request with a generated id, addressed to the department', async () => {
    const res = await request(app)
      .post('/api/funding')
      .set(auth(token))
      .send({ departmentId, subject: 'Bridge repair funding', address: 'Near bus stand, Davanagere' });
    expect(res.status).toBe(201);
    expect(res.body.fundingRequestId).toMatch(/FUND\/\d{4}\/\d{4}/);
    expect(res.body.departmentId).toBe(departmentId);
    expect(res.body.status).toBe('SUBMITTED');
  });

  it('rejects a missing department, subject, or address', async () => {
    const res = await request(app).post('/api/funding').set(auth(token)).send({ departmentId, subject: 'ab', address: '' });
    expect(res.status).toBe(400);
  });

  it('lists funding requests with the department populated, and supports filtering by department', async () => {
    await request(app).post('/api/funding').set(auth(token)).send({ departmentId, subject: 'Bridge repair funding', address: 'Near bus stand' });
    const res = await request(app).get('/api/funding').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].departmentId.name).toBe('Agriculture Department');

    const filtered = await request(app).get(`/api/funding?departmentId=${departmentId}`).set(auth(token));
    expect(filtered.body.total).toBe(1);
  });

  it('accepts a photo attached to a funding request via the shared document owner', async () => {
    const created = await request(app)
      .post('/api/funding')
      .set(auth(token))
      .send({ departmentId, subject: 'Bridge repair funding', address: 'Near bus stand' });
    const id = created.body.id;

    const upload = await request(app)
      .post(`/api/documents/funding/${id}`)
      .set(auth(token))
      .field('documentType', 'Site Photo')
      .attach('files', Buffer.from('fake-image-bytes'), 'site.jpg');
    expect(upload.status).toBe(201);

    const list = await request(app).get(`/api/documents/funding/${id}`).set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].documentType).toBe('Site Photo');
  });

  it('404s for an unknown funding request id', async () => {
    const res = await request(app).get('/api/funding/000000000000000000000000').set(auth(token));
    expect(res.status).toBe(404);
  });
});
