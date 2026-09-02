/* eslint-disable no-console */
import dayjs from 'dayjs';
import { ROLES, formatId } from '@mla/shared';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';
import {
  Constituency, GramPanchayat, SubVillage, Village, Ward,
} from '../models/location.js';
import { Priority, RequestCategory, RequestStatus, SystemSettings } from '../models/config.js';
import { Department } from '../models/Department.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { RequestModel } from '../models/Request.js';
import { Letter } from '../models/Letter.js';
import { Counter } from '../models/Counter.js';
import { addTimeline } from '../modules/workflow/timeline.service.js';
import { seedConfigDefaults } from './configDefaults.js';
import {
  DEMO_DEPARTMENTS, DEMO_GPS, DEMO_USERS, DEMO_VILLAGES, DEMO_WARDS, DEMO_WARD_AREAS,
} from './demoData.js';

const CONFIG_ONLY = process.argv.includes('--config-only');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsert(model: any, filter: object, doc: object): Promise<any> {
  return model.findOneAndUpdate(filter, { $setOnInsert: doc }, { upsert: true, new: true });
}

async function run() {
  await connectDb();

  /* ---- reference-data defaults (roles, priorities, statuses, categories, lookups) ---- */
  await seedConfigDefaults();
  console.log('  reference data: roles / priorities / statuses / categories / lookups');
  const roleByCode: Record<string, any> = {};
  for (const r of await Role.find({ isSystem: true }).lean()) roleByCode[r.code] = r;

  if (CONFIG_ONLY) {
    console.log('\n--config-only: reference data ensured, no demo data written.');
    await disconnectDb();
    process.exit(0);
  }

  console.log('Seeding DEMO data...');

  /* ---- demo settings + constituency ---- */
  await SystemSettings.findByIdAndUpdate(
    'app',
    { $set: { fileIdFormat: env.FILE_ID_FORMAT, defaultSlaDays: env.DEFAULT_SLA_DAYS, timezone: env.DEFAULT_TIMEZONE }, $setOnInsert: { constituencyName: 'Demo Constituency' } },
    { upsert: true, new: true },
  );
  const constituency = await upsert(Constituency, { isPrimary: true }, { name: 'Demo Constituency', isPrimary: true });
  console.log('  priorities / statuses / categories / lookups');

  /* ---- users ---- */
  const superRole = roleByCode[ROLES.SUPER_ADMIN];
  await upsert(User, { email: env.SEED_ADMIN_EMAIL }, {
    name: 'Super Admin',
    username: 'admin',
    email: env.SEED_ADMIN_EMAIL,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    roleId: superRole._id,
    roleCode: ROLES.SUPER_ADMIN,
  });

  /* ---- 22 demo departments ---- */
  const depDocs: any[] = [];
  for (const d of DEMO_DEPARTMENTS) {
    depDocs.push(await upsert(Department, { code: d.code }, { ...d, isDemo: true }));
  }
  console.log(`  departments: ${depDocs.length} (DEMO)`);

  /* demo officer bound to first department */
  for (const u of DEMO_USERS) {
    await upsert(User, { email: u.email }, {
      name: u.name,
      username: u.username,
      email: u.email,
      passwordHash: await hashPassword(u.password),
      roleId: roleByCode[u.roleCode]._id,
      roleCode: u.roleCode,
      departmentId: u.roleCode === ROLES.DEPARTMENT_OFFICER ? depDocs[0]._id : null,
      mustChangePassword: false,
    });
  }
  console.log(`  users: 1 admin + ${DEMO_USERS.length} demo`);

  /* ---- locations ---- */
  const wardDocs: any[] = [];
  for (const w of DEMO_WARDS) {
    wardDocs.push(await upsert(Ward, { name: w.name, constituencyId: constituency._id }, { ...w, constituencyId: constituency._id, isDemo: true }));
  }
  const gpDocs: any[] = [];
  for (const g of DEMO_GPS) {
    gpDocs.push(await upsert(GramPanchayat, { name: g.name, constituencyId: constituency._id }, { ...g, constituencyId: constituency._id, isDemo: true }));
  }
  for (const v of DEMO_VILLAGES) {
    const village = await upsert(Village, { name: v.name, gramPanchayatId: gpDocs[v.gpIndex]._id }, {
      name: v.name, code: v.code, parentType: 'GRAM_PANCHAYAT', gramPanchayatId: gpDocs[v.gpIndex]._id, wardId: null, isDemo: true,
    });
    for (const s of v.subs) {
      await upsert(SubVillage, { name: s, villageId: village._id }, { name: s, villageId: village._id, isDemo: true });
    }
  }
  for (const a of DEMO_WARD_AREAS) {
    await upsert(Village, { name: a.name, wardId: wardDocs[a.wardIndex]._id }, {
      name: a.name, code: a.code, parentType: 'WARD', wardId: wardDocs[a.wardIndex]._id, gramPanchayatId: null, isDemo: true,
    });
  }
  console.log(`  wards: ${wardDocs.length}, GPs: ${gpDocs.length}, villages + sub-villages`);

  /* ---- a few demo requests so dashboards are not empty ---- */
  if ((await RequestModel.countDocuments({ isDemo: true })) === 0) {
    const admin = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
    const priorities = await Priority.find().lean();
    const statuses = await RequestStatus.find().lean();
    const cats = await RequestCategory.find().lean();
    const pick = <T>(arr: T[], i: number) => arr[i % arr.length]!;

    for (let i = 0; i < 12; i++) {
      const st = pick(statuses.filter((s) => !s.isInitial), i);
      const pr = pick(priorities, i);
      const fileSeq = await Counter.findOneAndUpdate({ _id: `fileId:${new Date().getFullYear()}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
      const reqSeq = await Counter.findOneAndUpdate({ _id: `requestId:${new Date().getFullYear()}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
      const created = dayjs().subtract(i * 3, 'day').toDate();
      const r = await RequestModel.create({
        fileId: formatId({ format: 'MLA/{YYYY}/{SEQ:6}', seq: fileSeq!.seq, date: created }),
        requestId: formatId({ format: 'REQ/{YYYY}/{SEQ:6}', seq: reqSeq!.seq, date: created }),
        date: created,
        createdAt: created,
        requestType: 'Constituency Request',
        categoryId: pick(cats, i)._id,
        priorityId: pr._id,
        subject: `Demo request ${i + 1}: ${pick(cats, i).name} issue`,
        description: 'Auto-generated demo request. Safe to delete.',
        applicant: {
          name: `Demo Applicant ${i + 1}`,
          mobile: `9${String(800000000 + i).padStart(9, '0')}`,
          address: 'Demo address',
        },
        location: {
          constituencyId: constituency._id,
          gramPanchayatId: pick(gpDocs, i)._id,
        },
        primaryDepartmentId: pick(depDocs, i)._id,
        statusId: st._id,
        statusCode: st.code,
        slaDays: pr.slaDays,
        dueDate: dayjs(created).add(pr.slaDays, 'day').toDate(),
        submittedAt: created,
        createdBy: admin!._id,
        isDemo: true,
      });
      await addTimeline({ requestId: String(r._id), action: 'FILE_CREATED', label: `File ${r.fileId} created (DEMO)`, actorName: 'seed', toStatus: st.code });
    }
    console.log('  demo requests: 12');
  }

  /* ---- a few demo MLA letters ---- */
  if ((await Letter.countDocuments({ isDemo: true })) === 0) {
    const admin = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
    const statuses2 = ['DRAFT', 'ISSUED', 'DISPATCHED', 'REPLIED'] as const;
    for (let i = 0; i < 4; i++) {
      const seq = await Counter.findOneAndUpdate({ _id: `letterNo:${new Date().getFullYear()}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
      await Letter.create({
        letterNo: formatId({ format: 'MLA-LTR/{YYYY}/{SEQ:4}', seq: seq!.seq, date: new Date() }),
        subject: `Demo letter ${i + 1}: recommendation to department`,
        description: 'Auto-generated demo letter. Safe to delete.',
        applicant: { name: `Demo Petitioner ${i + 1}`, mobile: `98${String(70000000 + i).padStart(8, '0')}`, address: 'Demo address' },
        location: { gramPanchayatId: gpDocs[i % gpDocs.length]._id },
        referredBy: 'Local body member',
        departmentId: depDocs[i % depDocs.length]._id,
        departmentLetterNo: `DEPT/${2026}/${100 + i}`,
        status: statuses2[i],
        createdBy: admin!._id,
        isDemo: true,
      });
    }
    console.log('  demo letters: 4');
  }

  console.log('\nSeed complete.');
  console.log('---------------------------------------------');
  console.log(`Super Admin : ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
  DEMO_USERS.forEach((u) => console.log(`${u.roleCode.padEnd(20)}: ${u.email} / ${u.password}`));
  console.log('---------------------------------------------');
  console.log('All DEMO rows are flagged isDemo:true. Replace them via Admin > Import.');

  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
