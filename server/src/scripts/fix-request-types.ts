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
import { fixRequestTypes } from '../migrations/fixes.js';

async function run() {
  await connectDb();
  const result = await fixRequestTypes();
  console.log('Request Type lookup fix:', result);
  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Request Type lookup fix failed:', err);
  process.exit(1);
});
