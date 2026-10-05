import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { Constituency } from '../src/models/location.js';

const app = createApp();

describe('locations + rbac', () => {
  let token: string;
  let constituencyId: string;

  beforeEach(async () => {
    await seedCore();
    token = await login(app);
    constituencyId = String((await Constituency.findOne({ isPrimary: true }))!._id);
  });

  it('creates ward -> village and enforces the parent hierarchy in options', async () => {
    const ward = await request(app).post('/api/wards').set(auth(token)).send({ name: 'Ward 01', constituencyId });
    expect(ward.status).toBe(201);

    const village = await request(app)
      .post('/api/villages')
      .set(auth(token))
      .send({ name: 'Area A', parentType: 'WARD', wardId: ward.body.id });
    expect(village.status).toBe(201);

    const opts = await request(app).get(`/api/location-options/villages?wardId=${ward.body.id}`).set(auth(token));
    expect(opts.status).toBe(200);
    expect(opts.body).toHaveLength(1);

    const empty = await request(app).get('/api/location-options/villages').set(auth(token));
    expect(empty.status).toBe(400); // parent id required
  });

  it('sorts villages by their own display order (Roman numeral rank), not just name', async () => {
    const gp = await request(app).post('/api/gram-panchayats').set(auth(token)).send({ name: 'GP Alpha', constituencyId });
    expect(gp.status).toBe(201);

    // Created out of order, and "Zebra" would sort first alphabetically -
    // the order field should still win.
    await request(app).post('/api/villages').set(auth(token)).send({ name: 'Zebra Village', parentType: 'GRAM_PANCHAYAT', gramPanchayatId: gp.body.id, order: 2 });
    await request(app).post('/api/villages').set(auth(token)).send({ name: 'Alpha Village', parentType: 'GRAM_PANCHAYAT', gramPanchayatId: gp.body.id, order: 1 });

    const opts = await request(app).get(`/api/location-options/villages?gramPanchayatId=${gp.body.id}`).set(auth(token));
    expect(opts.status).toBe(200);
    expect(opts.body.map((v: { name: string }) => v.name)).toEqual(['Alpha Village', 'Zebra Village']);
    expect(opts.body[0].order).toBe(1);
  });

  it('blocks a viewer from writing masters', async () => {
    const viewerToken = await login(app, 'admin@test.local'); // super admin
    // create a viewer user, then login as them
    const roleRes = await request(app).get('/api/roles').set(auth(viewerToken));
    const viewerRole = roleRes.body.data.find((r: { code: string }) => r.code === 'VIEWER');
    const createViewer = await request(app).post('/api/users').set(auth(viewerToken)).send({
      name: 'Viewer One', username: 'viewer1', email: 'v1@test.local',
      roleId: viewerRole.id, password: 'Viewer@12345',
    });
    expect(createViewer.status).toBe(201);
    const vLogin = await request(app).post('/api/auth/login').send({ usernameOrEmail: 'v1@test.local', password: 'Viewer@12345' });
    const res = await request(app).post('/api/wards').set(auth(vLogin.body.accessToken)).send({ name: 'X', constituencyId });
    expect(res.status).toBe(403);
  });

  it('soft-deletes and hides inactive rows by default', async () => {
    const ward = await request(app).post('/api/wards').set(auth(token)).send({ name: 'Ward 09', constituencyId });
    await request(app).delete(`/api/wards/${ward.body.id}`).set(auth(token)).expect(204);
    const list = await request(app).get('/api/wards').set(auth(token));
    expect(list.body.data.find((w: { id: string }) => w.id === ward.body.id)).toBeUndefined();
    const withInactive = await request(app).get('/api/wards?includeInactive=true').set(auth(token));
    expect(withInactive.body.data.find((w: { id: string }) => w.id === ward.body.id)).toBeTruthy();
  });
});
