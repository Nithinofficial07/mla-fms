/* eslint-disable no-console */
/**
 * One-off fix: resolving a file to COMPLETED was only allowed directly from
 * IN_PROGRESS or APPROVED - every other non-terminal status (ASSIGNED,
 * FORWARDED, SUBMITTED, UNDER_REVIEW, AWAITING_INFO, DEPT_RESPONSE, DRAFT)
 * rejected it with a 409. seedConfigDefaults() only $setOnInsert's statuses,
 * so changing DEFAULT_STATUSES in shared/src/enums.ts alone doesn't fix
 * already-seeded dev/prod data - this script does.
 *
 * Uses $addToSet (not a full overwrite) so it only adds COMPLETED to each
 * status's transitionsTo - any other custom transitions an admin has
 * configured via the Statuses admin page are left untouched. REJECTED and
 * CLOSED (terminal) are deliberately skipped.
 *
 * Idempotent - safe to re-run. Usage: npm run fix:status-transitions --workspace server
 */
import { connectDb, disconnectDb } from '../config/db.js';
import { RequestStatus } from '../models/config.js';

async function run() {
  await connectDb();

  const res = await RequestStatus.updateMany(
    { isTerminal: false, code: { $ne: 'COMPLETED' } },
    { $addToSet: { transitionsTo: 'COMPLETED' } },
  );

  console.log(`Added COMPLETED as an allowed transition on ${res.modifiedCount} non-terminal status(es) (${res.matchedCount} matched, already-correct ones are no-ops).`);

  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Status transition fix failed:', err);
  process.exit(1);
});
