import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ROLES } from '@mla/shared';
import { createApp } from '../src/app.js';
import { auth, login, seedCore } from './helpers.js';
import { User } from '../src/models/User.js';
import { Principal } from '../src/models/Principal.js';
import { Notification } from '../src/models/workflow.js';
import { hashPassword } from '../src/utils/password.js';
import { runTimeTriggers, today, addDays } from '../src/modules/tasks/tasks.engine.js';

const app = createApp();

describe('office tasks (Office Teams)', () => {
  let token: string;
  let roles: Record<string, { _id: unknown }>;
  let admin: { _id: unknown };
  let team: Record<string, string>;

  const addMember = async (body: Record<string, unknown>) => {
    const r = await request(app).post('/api/tasks/team').set(auth(token)).send(body);
    expect(r.status).toBe(201);
    return r.body.id as string;
  };
  const workspace = async (tk = token) => (await request(app).get('/api/tasks/workspace').set(auth(tk))).body;
  const patch = (id: string, body: Record<string, unknown>) => request(app).patch(`/api/tasks/${id}`).set(auth(token)).send(body);

  beforeEach(async () => {
    ({ roles, admin } = await seedCore());
    token = await login(app);
    team = {
      pa1: await addMember({ name: 'Ravi PA', team: 'MLA_S', role: 'PA-T1', phone: '9845012345', userId: String(admin._id) }),
      pa2: await addMember({ name: 'Suma', team: 'MLA_S', role: 'PA-T2' }),
      designer: await addMember({ name: 'Kiran', team: 'SOCIAL', role: 'Graphic Designer' }),
      creator: await addMember({ name: 'Anil', team: 'SOCIAL', role: 'Social Media Creator' }),
    };
  });

  it('rejects a role that does not belong to the team', async () => {
    const r = await request(app).post('/api/tasks/team').set(auth(token)).send({ name: 'X', team: 'SOCIAL', role: 'Driver' });
    expect(r.status).toBe(400);
  });

  it('a workflow picks people by role, then steps, approval and done move the status', async () => {
    const created = await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Rajyotsava poster', forWhom: 'MLA_S', workflowId: 'b:social' });
    expect(created.status).toBe(201);
    const t = created.body;
    expect(t.steps.map((s: any) => s.assignee)).toEqual([team.pa1, team.designer, team.creator, team.creator]);
    expect(t.approval).toMatchObject({ required: true, approver: team.pa1, state: '' });
    expect(t.category).toBe('Social media');
    expect(t.due).toBe(addDays(today(), 1));
    expect(t.updates[0].text).toBe('Task created');

    // first step -> Working, "your turn" for the designer
    const s1 = await patch(t.id, { steps: t.steps.map((s: any, i: number) => ({ ...s, done: i === 0 })) });
    expect(s1.body.status).toBe('WORKING');
    expect(s1.body.updates.some((u: any) => u.text.startsWith('Your turn: Design'))).toBe(true);

    // all steps -> waiting for approval (not done yet)
    const s2 = await patch(t.id, { steps: s1.body.steps.map((s: any) => ({ ...s, done: true })) });
    expect(s2.body.status).toBe('APPROVAL');

    // trying to mark done while approval is pending keeps it waiting
    expect((await patch(t.id, { status: 'DONE' })).body.status).toBe('APPROVAL');

    const approved = await patch(t.id, { approval: { state: 'APPROVED' } });
    expect(approved.body.status).toBe('DONE');
    expect(approved.body.doneAt).toBeTruthy();
  });

  it('runs automations on change, and the hourly due-date rules once per due date', async () => {
    await request(app).post('/api/tasks/automations').set(auth(token)).send({
      name: 'Stuck → alert the PA', trigger: { type: 'status_to', value: 'STUCK' }, actions: [{ type: 'set_priority', value: 'HIGH' }, { type: 'notify', value: 'role:PA-T1' }],
    });
    await request(app).post('/api/tasks/automations').set(auth(token)).send({
      name: 'Overdue → critical', trigger: { type: 'overdue' }, actions: [{ type: 'set_priority', value: 'CRITICAL' }],
    });
    const t = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Call AEE', forWhom: 'MLA_S', due: addDays(today(), -2) })).body;

    const stuck = await patch(t.id, { status: 'STUCK' });
    expect(stuck.body.priority).toBe('HIGH');
    expect(stuck.body.updates.some((u: any) => u.kind === 'auto' && u.text.includes('Stuck → alert the PA'))).toBe(true);

    expect(await runTimeTriggers()).toEqual({ fired: 1 });
    expect(await runTimeTriggers()).toEqual({ fired: 0 }); // once per due date
    const ws = await workspace();
    expect(ws.tasks.find((x: any) => x.id === t.id).priority).toBe('CRITICAL');
  });

  it('a repeating task makes its next one when done; finishing a blocker unblocks the waiting task', async () => {
    const due = today();
    const rep = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Weekly ward report', forWhom: 'MLA_S', due, repeat: 'weekly' })).body;
    const waiting = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Send report to MLA', forWhom: 'MLA_S', dependsOn: [rep.id], assignees: [team.pa2] })).body;

    await patch(rep.id, { status: 'DONE' });
    const ws = await workspace();
    const next = ws.tasks.filter((x: any) => x.title === 'Weekly ward report' && x.status === 'NOT_STARTED');
    expect(next).toHaveLength(1);
    expect(next[0].due).toBe(addDays(due, 7));
    const done = ws.tasks.find((x: any) => x.id === rep.id);
    expect(done.updates.some((u: any) => u.text.includes('Unblocked: “Send report to MLA”'))).toBe(true);
    void waiting;
  });

  it('an @mention in an update notifies that person (when linked to a login)', async () => {
    const t = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Typing', forWhom: 'MLA_S' })).body;
    const before = await Notification.countDocuments();
    const other = await User.create({
      name: 'Suma', username: 'suma', email: 'suma@test.local', passwordHash: await hashPassword('Suma@12345'),
      roleId: roles[ROLES.DATA_ENTRY_OPERATOR]._id, roleCode: ROLES.DATA_ENTRY_OPERATOR,
    });
    await request(app).patch(`/api/tasks/team/${team.pa2}`).set(auth(token)).send({ name: 'Suma', team: 'MLA_S', role: 'PA-T2', userId: String(other._id) });
    const r = await request(app).post(`/api/tasks/${t.id}/comment`).set(auth(token)).send({ text: 'Please type this today @Suma' });
    expect(r.status).toBe(200);
    expect(r.body.updates.at(-1)).toMatchObject({ kind: 'comment', text: 'Please type this today @Suma', notify: [team.pa2] });
    const n = await Notification.findOne({ userId: other._id, type: 'TASK_COMMENT' }).lean();
    expect(n?.link).toBe(`/tasks?open=${t.id}`);
    expect(await Notification.countDocuments()).toBe(before + 1);
  });

  it('scopes tasks to the office being viewed, and keeps viewers read-only', async () => {
    const north = await Principal.create({ code: 'MLA_N', label: 'MLA – North', idPrefix: 'MLA-N' });
    await request(app).post('/api/tasks').set(auth(token)).send({ title: 'South task', forWhom: 'MLA_S' });
    await request(app).post('/api/tasks').set(auth(token)).send({ title: 'North task', forWhom: 'MLA_N' });
    await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Office task', forWhom: '' });
    await User.create({
      name: 'North viewer', username: 'nview', email: 'nview@test.local', passwordHash: await hashPassword('Viewer@12345'),
      roleId: roles[ROLES.VIEWER]._id, roleCode: ROLES.VIEWER, principalIds: [north._id],
    });
    const vt = await login(app, 'nview@test.local', 'Viewer@12345');
    const titles = (await workspace(vt)).tasks.map((x: any) => x.title).sort();
    expect(titles).toEqual(['North task', 'Office task']);
    const denied = await request(app).post('/api/tasks').set(auth(vt)).send({ title: 'Nope' });
    expect(denied.status).toBe(403);
  });
});
