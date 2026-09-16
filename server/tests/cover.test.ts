import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { GramPanchayat, Constituency } from '../src/models/location.js';

const app = createApp();

describe('request cover sheet PDF', () => {
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

  it('renders a PDF with no documents and no timeline events beyond creation', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set(auth(token))
      .send({
        subject: 'Broken hand pump',
        priorityId,
        applicant: { name: 'Ramesh Kumar', mobile: '9876543210' },
        location: { gramPanchayatId: gpId },
        submit: true,
      });
    const id = created.body.id;

    const res = await request(app).get(`/api/requests/${id}/cover.pdf`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a PDF with a very long subject without throwing (layout math holds up)', async () => {
    const longSubject = 'A very long subject line describing a complicated multi-department grievance '.repeat(3);
    const created = await request(app)
      .post('/api/requests')
      .set(auth(token))
      .send({
        subject: longSubject,
        priorityId,
        applicant: { name: 'Ramesh Kumar', mobile: '9876543210' },
        location: { gramPanchayatId: gpId },
        submit: true,
      });
    const id = created.body.id;

    const res = await request(app).get(`/api/requests/${id}/cover.pdf`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('404s for an unknown request id', async () => {
    const res = await request(app).get('/api/requests/000000000000000000000000/cover.pdf').set(auth(token));
    expect(res.status).toBe(404);
  });
});
