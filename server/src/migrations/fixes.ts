import { CALENDAR_LEGACY_TYPE_MAP, DEFAULT_REQUEST_TYPES, PERMISSIONS, ROLES } from '@mla/shared';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { seedConfigDefaults } from '../seed/configDefaults.js';
import { Principal } from '../models/Principal.js';
import { RequestModel } from '../models/Request.js';
import { Letter } from '../models/Letter.js';
import { FundingRequest } from '../models/FundingRequest.js';
import { User } from '../models/User.js';
import { Lookup, RequestStatus } from '../models/config.js';
import { Role } from '../models/Role.js';

/**
 * The data fixes behind the one-off scripts in src/scripts/, as plain
 * functions so they can also run automatically at startup (see
 * runStartupMigrations) on hosts with no shell access. Every one is
 * idempotent - safe to re-run.
 */

/**
 * Multi-principal backfill: assigns every pre-existing Request / Letter /
 * FundingRequest / User with no principal to MLA_S ("MLA – South", this
 * office's one real principal before the feature existed). Without it, that
 * data fails principal-scoping and stays hidden from everyone but Super Admin.
 */
export async function backfillPrincipal() {
  // Ensures the 3 Principal rows exist even if this runs before any other seed step.
  await seedConfigDefaults();
  const principal = await Principal.findOne({ code: 'MLA_S' });
  if (!principal) throw new Error('MLA_S principal missing after seedConfigDefaults.');

  const [reqRes, letterRes, fundingRes, userRes] = await Promise.all([
    RequestModel.updateMany({ principalId: { $exists: false } }, { $set: { principalId: principal._id } }),
    Letter.updateMany({ principalId: { $exists: false } }, { $set: { principalId: principal._id } }),
    FundingRequest.updateMany({ principalId: { $exists: false } }, { $set: { principalId: principal._id } }),
    User.updateMany(
      { $or: [{ principalIds: { $exists: false } }, { principalIds: { $size: 0 } }] },
      { $set: { principalIds: [principal._id] } },
    ),
  ]);
  return {
    requests: reqRes.modifiedCount,
    letters: letterRes.modifiedCount,
    funding: fundingRes.modifiedCount,
    users: userRes.modifiedCount,
  };
}

/**
 * REQUEST_TYPE lookup was seeded with the wrong 5 options before the
 * office's fixed list was known, and seedConfigDefaults() only
 * $setOnInsert's lookups. Force-sets order for the canonical names and
 * soft-deletes any other REQUEST_TYPE row.
 */
export async function fixRequestTypes() {
  for (let i = 0; i < DEFAULT_REQUEST_TYPES.length; i++) {
    await Lookup.findOneAndUpdate(
      { group: 'REQUEST_TYPE', name: DEFAULT_REQUEST_TYPES[i] },
      { $set: { order: i, isActive: true, deletedAt: null } },
      { upsert: true },
    );
  }
  const stale = await Lookup.updateMany(
    { group: 'REQUEST_TYPE', name: { $nin: DEFAULT_REQUEST_TYPES }, isActive: true },
    { $set: { isActive: false, deletedAt: new Date() } },
  );
  return { canonical: DEFAULT_REQUEST_TYPES.length, staleDeactivated: stale.modifiedCount };
}

/**
 * Lets every non-terminal status resolve straight to COMPLETED. $addToSet,
 * so custom transitions configured on the Statuses admin page are kept.
 */
export async function fixStatusTransitions() {
  const res = await RequestStatus.updateMany(
    { isTerminal: false, code: { $ne: 'COMPLETED' } },
    { $addToSet: { transitionsTo: 'COMPLETED' } },
  );
  return { updated: res.modifiedCount, matched: res.matchedCount };
}

/**
 * Lets implementing-agency users add works (New Work menu). Targeted
 * $addToSet rather than seedConfigDefaults, so other roles' permissions
 * customised in the admin panel are left alone.
 */
export async function grantAgencyWorkCreate() {
  const res = await Role.updateOne(
    { code: ROLES.IMPLEMENTING_AGENCY },
    { $addToSet: { permissions: PERMISSIONS.WORK_CREATE } },
  );
  return { updated: res.modifiedCount, matched: res.matchedCount };
}

/**
 * Agency logins moved from one agency (implementingAgency) to a list
 * (implementingAgencies). Copies the old value across and drops the old field.
 */
export async function migrateUserAgencies() {
  const res = await User.collection.updateMany(
    { implementingAgency: { $type: 'string', $ne: '' } },
    [{ $set: { implementingAgencies: ['$implementingAgency'] } }, { $unset: 'implementingAgency' }],
  );
  return { updated: res.modifiedCount, matched: res.matchedCount };
}

/** Lets department officers add and update works (New Work menu), without resetting other roles. */
export async function grantOfficerWorkCreate() {
  const res = await Role.updateOne(
    { code: ROLES.DEPARTMENT_OFFICER },
    { $addToSet: { permissions: { $each: [PERMISSIONS.WORK_CREATE, PERMISSIONS.WORK_EDIT] } } },
  );
  return { updated: res.modifiedCount, matched: res.matchedCount };
}

/**
 * Calendar module: grants the calendar permissions to the system roles that
 * get them by default. Targeted $addToSet so permissions customised in the
 * Roles admin page are kept.
 */
export async function grantCalendarPermissions() {
  const grants: [string, string[]][] = [
    [ROLES.ADMIN, [PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.CALENDAR_MANAGE]],
    [ROLES.MLA, [PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.CALENDAR_MANAGE]],
    [ROLES.DATA_ENTRY_OPERATOR, [PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.CALENDAR_MANAGE]],
    [ROLES.VIEWER, [PERMISSIONS.CALENDAR_VIEW]],
  ];
  let updated = 0;
  for (const [code, perms] of grants) {
    const res = await Role.updateOne({ code }, { $addToSet: { permissions: { $each: perms } } });
    updated += res.modifiedCount;
  }
  return { updated };
}

/** Calendar event types were replaced by the office's own colour scheme - remap any event saved with an old code. */
export async function remapCalendarTypes() {
  let updated = 0;
  for (const [oldCode, newCode] of Object.entries(CALENDAR_LEGACY_TYPE_MAP)) {
    const res = await CalendarEvent.collection.updateMany({ type: oldCode }, { $set: { type: newCode } });
    updated += res.modifiedCount;
  }
  return { updated };
}

/**
 * Calendar rebuild: events used to belong to a single principal (principalId);
 * the module now supports several calendars per event (members[]). Backfills
 * every pre-rebuild event to members:[that principal's code], defaulting to
 * MLA_S if the principal can't be resolved, and drops the old field.
 */
export async function migrateCalendarMembers() {
  const principals = await Principal.find({}).select('code').lean();
  const codeById = new Map(principals.map((p) => [String(p._id), p.code]));

  const legacy = await CalendarEvent.collection.find({ members: { $exists: false } }).toArray();
  let updated = 0;
  for (const doc of legacy) {
    const code = (doc.principalId && codeById.get(String(doc.principalId))) || 'MLA_S';
    await CalendarEvent.collection.updateOne(
      { _id: doc._id },
      { $set: { members: [code] }, $unset: { principalId: '' } },
    );
    updated += 1;
  }
  return { updated };
}

/** Grants the new "calendar admin" tier (photos, backup, import) to the roles that get it by default. */
export async function grantCalendarAdminPermission() {
  const res = await Role.updateMany(
    { code: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MLA] } },
    { $addToSet: { permissions: PERMISSIONS.CALENDAR_ADMIN } },
  );
  return { updated: res.modifiedCount, matched: res.matchedCount };
}
