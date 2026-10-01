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
import { seedConfigDefaults } from '../seed/configDefaults.js';
import { Principal } from '../models/Principal.js';
import { RequestModel } from '../models/Request.js';
import { Letter } from '../models/Letter.js';
import { FundingRequest } from '../models/FundingRequest.js';
import { User } from '../models/User.js';

async function run() {
  await connectDb();

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

  console.log('Principal backfill complete (assigned to MLA_S / "MLA – South"):');
  console.log(`  requests updated: ${reqRes.modifiedCount}`);
  console.log(`  letters updated:  ${letterRes.modifiedCount}`);
  console.log(`  funding updated:  ${fundingRes.modifiedCount}`);
  console.log(`  users updated:    ${userRes.modifiedCount}`);
  console.log('\nAny user who should instead be MLA-North or MP-only can be re-scoped from the Users admin page.');

  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error('Principal backfill failed:', err);
  process.exit(1);
});
