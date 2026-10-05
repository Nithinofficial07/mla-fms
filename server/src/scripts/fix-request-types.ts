/* eslint-disable no-console */
/**
 * One-off fix: the REQUEST_TYPE lookup group was seeded with the wrong 5
 * options ("Constituency Request", "Public / Citizen Request", etc.) before
 * the office's actual fixed list was known. seedConfigDefaults() only ever
 * $setOnInsert's lookups, so just changing DEFAULT_REQUEST_TYPES in
 * shared/src/enums.ts and redeploying does NOT fix already-seeded
 * environments - this script does, by:
 *   1. Force-setting order 0-4 for the 5 canonical names (so "Grievance",
 *      which existed under the old list too, gets its correct position).
 *   2. Soft-deleting any REQUEST_TYPE lookup row that isn't one of the 5
 *      (old junk stops showing up in the dropdown, but isn't hard-deleted).
 *
 * Idempotent - safe to re-run. Usage: npm run fix:request-types --workspace server
 */
import { connectDb, disconnectDb } from '../config/db.js';
import { DEFAULT_REQUEST_TYPES } from '@mla/shared';
import { Lookup } from '../models/config.js';

async function run() {
  await connectDb();

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

  console.log('Request Type lookup fixed:');
  console.log(`  canonical 5 upserted/reordered: ${DEFAULT_REQUEST_TYPES.join(', ')}`);
  console.log(`  stale options deactivated: ${stale.modifiedCount}`);

  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Request Type fix failed:', err);
  process.exit(1);
});
