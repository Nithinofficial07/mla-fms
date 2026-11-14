import { Schema, model } from 'mongoose';
import { loadMandakkiBhattiWorks, loadNov2026Works } from './worksNov2026.js';
import { logger } from '../config/logger.js';
import { seedConfigDefaults } from '../seed/configDefaults.js';
import {
  backfillPrincipal, fixRequestTypes, fixStatusTransitions, grantAgencyWorkCreate, grantOfficerWorkCreate, migrateUserAgencies,
  grantCalendarPermissions, remapCalendarTypes, migrateCalendarMembers, grantCalendarAdminPermission, cleanupGoogleImports, fixCalendarLegacyIdIndex, seedCalendarQuotes, grantTaskPermissions,
} from './fixes.js';

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
  { name: '2026-10-user-agencies-list', run: migrateUserAgencies },
  { name: '2026-10-officer-work-create', run: grantOfficerWorkCreate },
  { name: '2026-11-calendar-permissions', run: grantCalendarPermissions },
  { name: '2026-11-calendar-type-scheme', run: remapCalendarTypes },
  { name: '2026-11-calendar-members-rebuild', run: migrateCalendarMembers },
  { name: '2026-11-calendar-admin-permission', run: grantCalendarAdminPermission },
  // Google-imported events: guess types, strip Meet boilerplate, fill contact phones.
  { name: '2026-11-calendar-google-cleanup', run: cleanupGoogleImports },
  // legacyId unique index must ignore normal (non-imported) events.
  { name: '2026-11-calendar-legacyid-index', run: fixCalendarLegacyIdIndex },
  // Starter list of ದಿನದ ಚಿಂತನೆ / ಸುಭಾಷಿತ / ಗಾದೆ lines for the daily poster.
  { name: '2026-11-calendar-quotes-seed', run: seedCalendarQuotes },
  // Office tasks (Office Teams): task.view / task.manage / task.admin for the default roles.
  { name: '2026-11-task-permissions', run: grantTaskPermissions },
  // Works from the DC Muzrai letter (27.10.2026) and Hutti Gold Mines CSR 2025-26 letter - KRIDL / Nirmithi Kendra.
  { name: '2026-11-works-muzrai-csr-letters', run: loadNov2026Works },
  // Two KRIDL works at Mandakki Bhatti, Ward 03 (CC road + CC drain, Rs 50 lakh each) - MLA South, in progress.
  { name: '2026-11-works-mandakki-bhatti', run: loadMandakkiBhattiWorks },
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
