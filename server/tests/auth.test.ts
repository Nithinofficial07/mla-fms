import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedCore } from './helpers.js';

const app = createApp();

describe('auth', () => {
  beforeEach(async () => {
    await seedCore();
  });

  it('rejects bad credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ usernameOrEmail: 'admin@test.local', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in and returns an access token + user', async () => {
    const res = await request(app).post('/api/auth/login').send({ usernameOrEmail: 'admin@test.local', password: 'Admin@12345' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.roleCode).toBe('SUPER_ADMIN');
    expect(res.body.user.permissions.length).toBeGreaterThan(0);
  });

  it('rejects /auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('accepts /auth/me with a token', async () => {
    const login = await request(app).post('/api/auth/login').send({ usernameOrEmail: 'admin@test.local', password: 'Admin@12345' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.local');
  });

  it('validates login payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ usernameOrEmail: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
