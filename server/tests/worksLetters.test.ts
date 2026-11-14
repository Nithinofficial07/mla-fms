import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { Principal } from '../src/models/Principal.js';
import { Department } from '../src/models/Department.js';
import { loadNov2026Works } from '../src/migrations/worksNov2026.js';

const app = createApp();

describe('works from the Nov 2026 sanction letters', () => {
  let token: string;
  beforeEach(async () => {
    await seedCore();
    await Principal.create({ code: 'MLA_N', label: 'MLA – North', idPrefix: 'MLA-N' });
    token = await login(app);
  });

  it('loads the 19 works once, under MLA North, with KRIDL / Nirmithi Kendra', async () => {
    const first = await loadNov2026Works();
    expect(first).toEqual({ created: 19, skipped: 0, totalLakhs: 324.02 });
    expect(await loadNov2026Works()).toMatchObject({ created: 0, skipped: 19 });
    expect(await Department.exists({ code: 'KRIDL' })).toBeTruthy();

    const res = await request(app).get('/api/works').set(auth(token)).query({ pageSize: 100 });
    expect(res.status).toBe(200);
    const rows = res.body.data ?? res.body;
    expect(rows).toHaveLength(19);
    const temple = rows.find((w: any) => w.nameOfWork.startsWith('ನಿರ್ಥಡಿ'));
    expect(temple).toMatchObject({ amountLakhs: 7.02, implementingAgency: 'KRIDL', fundingYear: '2026-27' });
    expect(rows.filter((w: any) => w.implementingAgency === 'Nirmithi Kendra')).toHaveLength(2);
    expect(rows.filter((w: any) => w.fundingYear === '2025-26').reduce((a: number, w: any) => a + w.amountLakhs, 0)).toBe(250);
    expect(rows.every((w: any) => /^WRK-\d{4}$/.test(w.workId))).toBe(true);

    const one = await request(app).get(`/api/works/${temple.id}`).set(auth(token));
    expect(one.status).toBe(200);
  });
});
