/* eslint-disable no-console */
/**
 * One-off migration: run once per environment (local, dev, prod) right after
 * deploying the multi-principal feature, before anyone logs in. Without this,
 * every existing Request/Letter/FundingRequest fails principal-scoping (no
 * principalId) and every existing User loses access to everything (empty
 * principalIds + fail-closed scoping).
 *
 * Idempotent - safe to re-run. Assigns all pre-existing data to MLA_S
 * (this office's one real principal before this feature existed).
 *
 * Usage: npm run backfill:principal --workspace server
 */
import { connectDb, disconnectDb } from '../config/db.js';
import { backfillPrincipal } from '../migrations/fixes.js';

async function run() {
  await connectDb();
  const result = await backfillPrincipal();
  console.log('Principal backfill (assigned to MLA_S / "MLA – South"):', result);
  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Principal backfill (assigned to MLA_S / "MLA – South") failed:', err);
  process.exit(1);
});
