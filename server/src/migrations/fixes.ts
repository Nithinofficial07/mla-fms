import { DEFAULT_REQUEST_TYPES } from '@mla/shared';
import { seedConfigDefaults } from '../seed/configDefaults.js';
import { Principal } from '../models/Principal.js';
import { RequestModel } from '../models/Request.js';
import { Letter } from '../models/Letter.js';
import { FundingRequest } from '../models/FundingRequest.js';
import { User } from '../models/User.js';
import { Lookup, RequestStatus } from '../models/config.js';

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
