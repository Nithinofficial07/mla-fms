import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { GramPanchayat, Constituency } from '../src/models/location.js';

const app = createApp();

describe('public tracking', () => {
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

  const createSubmitted = async () => {
    const res = await request(app)
      .post('/api/requests')
      .set(auth(token))
      .send({
        subject: 'Broken hand pump',
        priorityId,
        applicant: { name: 'Ramesh Kumar', mobile: '9876543210' },
        location: { gramPanchayatId: gpId },
        submit: true,
      });
    return res.body as { fileId: string };
  };

  it('finds a request by fileId + matching mobile, without auth', async () => {
    const { fileId } = await createSubmitted();
    const res = await request(app).post('/api/public/track').send({ fileId, mobile: '9876543210' });
    expect(res.status).toBe(200);
    expect(res.body.fileId).toBe(fileId);
    expect(res.body.statusCode).toBe('SUBMITTED');
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(res.body.timeline.length).toBeGreaterThan(0);
  });

  it('never leaks remarks, applicant details, or internal actor names', async () => {
    const { fileId } = await createSubmitted();
    const res = await request(app).post('/api/public/track').send({ fileId, mobile: '9876543210' });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('Admin'); // actor name of whoever created it
    expect(res.body.applicant).toBeUndefined();
    expect(res.body.timeline.every((t: Record<string, unknown>) => !('remark' in t) && !('actorName' in t))).toBe(true);
  });

  it('rejects a mismatched mobile with a generic 404 (no enumeration hint)', async () => {
    const { fileId } = await createSubmitted();
    const res = await request(app).post('/api/public/track').send({ fileId, mobile: '9999999999' });
    expect(res.status).toBe(404);
  });

  it('rejects an unknown fileId with the same generic 404', async () => {
    const res = await request(app).post('/api/public/track').send({ fileId: 'MLA/2026/999999', mobile: '9876543210' });
    expect(res.status).toBe(404);
  });

  it('validates the mobile number shape before hitting the database', async () => {
    const res = await request(app).post('/api/public/track').send({ fileId: 'MLA/2026/000001', mobile: '123' });
    expect(res.status).toBe(400);
  });
});
