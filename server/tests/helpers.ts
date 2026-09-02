import request from 'supertest';
import type { Express } from 'express';
import { ROLES, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLE_DESCRIPTIONS } from '@mla/shared';
import { Role } from '../src/models/Role.js';
import { User } from '../src/models/User.js';
import { Priority, RequestStatus } from '../src/models/config.js';
import { Constituency } from '../src/models/location.js';
import { hashPassword } from '../src/utils/password.js';

/** Minimal fixtures needed by most request/auth tests. */
export async function seedCore() {
  const roles: Record<string, any> = {};
  for (const code of Object.values(ROLES)) {
    roles[code] = await Role.create({
      code,
      name: code,
      description: SYSTEM_ROLE_DESCRIPTIONS[code],
      permissions: DEFAULT_ROLE_PERMISSIONS[code],
      isSystem: true,
    });
  }
  await Constituency.create({ name: 'Test Constituency', isPrimary: true });
  await RequestStatus.create({ code: 'DRAFT', name: 'Draft', isInitial: true, order: 1, transitionsTo: ['SUBMITTED'] });
  await RequestStatus.create({ code: 'SUBMITTED', name: 'Submitted', order: 2, transitionsTo: ['UNDER_REVIEW'] });
  await RequestStatus.create({ code: 'UNDER_REVIEW', name: 'Under Review', order: 3, transitionsTo: ['ASSIGNED'] });
  await RequestStatus.create({ code: 'ASSIGNED', name: 'Assigned', order: 4, transitionsTo: ['IN_PROGRESS'] });
  const priority = await Priority.create({ code: 'MEDIUM', name: 'Medium', slaDays: 15, order: 2 });

  const admin = await User.create({
    name: 'Admin', username: 'admin', email: 'admin@test.local',
    passwordHash: await hashPassword('Admin@12345'),
    roleId: roles[ROLES.SUPER_ADMIN]._id, roleCode: ROLES.SUPER_ADMIN,
  });
  return { roles, priority, admin };
}

export async function login(app: Express, usernameOrEmail = 'admin@test.local', password = 'Admin@12345') {
  const res = await request(app).post('/api/auth/login').send({ usernameOrEmail, password });
  return res.body.accessToken as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
