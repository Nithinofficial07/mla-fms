import { Schema, model } from 'mongoose';
import { logger } from '../config/logger.js';
import { seedConfigDefaults } from '../seed/configDefaults.js';
import { backfillPrincipal, fixRequestTypes, fixStatusTransitions, grantAgencyWorkCreate } from './fixes.js';

/** One row per migration that has completed on this database. */
const Migration = model(
  'Migration',
  new Schema({
    name: { type: String, required: true, unique: true },
    ranAt: { type: Date, default: Date.now },
    result: { type: Schema.Types.Mixed },
  }),
);

/**
 * Ordered, append-only. Each runs exactly once per database, then is recorded
 * in `migrations` and skipped on every later boot. To re-apply a fix (e.g.
 * new role permissions), add a NEW entry with a new name - never rename one.
 */
const MIGRATIONS: { name: string; run: () => Promise<unknown> }[] = [
  { name: '2026-10-principal-backfill', run: backfillPrincipal },
  { name: '2026-10-request-types', run: fixRequestTypes },
  { name: '2026-10-status-transitions', run: fixStatusTransitions },
  // Creates the IMPLEMENTING_AGENCY role and grants the Works permissions.
  // Note: resets system roles' permissions to the code defaults.
  { name: '2026-10-works-roles', run: seedConfigDefaults },
  { name: '2026-10-agency-work-create', run: grantAgencyWorkCreate },
];

/**
 * Applies pending data migrations at boot, so a deploy fixes its own data on
 * hosts with no shell (e.g. Render without paid Shell access). Results go to
 * the service logs. A failure is logged and retried on the next boot rather
 * than taking the API down.
 */
export async function runStartupMigrations(): Promise<void> {
  const done = new Set((await Migration.find({}, { name: 1 }).lean()).map((m) => m.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    try {
      const result = await m.run();
      await Migration.create({ name: m.name, result });
      logger.info({ migration: m.name, result }, `Migration applied: ${m.name}`);
    } catch (err) {
      logger.error({ err, migration: m.name }, `Migration failed (will retry on next boot): ${m.name}`);
      return;
    }
  }
}
