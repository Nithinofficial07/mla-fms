import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { SystemSettings } from '../../models/config.js';

const router = Router();
router.use(authenticate);

async function getOrCreate() {
  return (await SystemSettings.findById('app')) ?? (await SystemSettings.create({ _id: 'app' }));
}

/** Public-ish read (any authenticated user) - used to theme the shell. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const s = await getOrCreate();
    ok(res, s.toJSON());
  }),
);

const updateSchema = z
  .object({
    appName: z.string().min(1),
    constituencyName: z.string(),
    logoKey: z.string().nullable(),
    fileIdFormat: z.string().min(3),
    requestIdFormat: z.string().min(3),
    documentIdFormat: z.string().min(3),
    letterNoFormat: z.string().min(3),
    dateFormat: z.string(),
    timezone: z.string(),
    maxUploadBytes: z.number().int().positive(),
    allowedFileTypes: z.array(z.string()),
    defaultSlaDays: z.number().int().min(0),
    notifications: z.object({
      dueSoonDays: z.number().int().min(0),
      email: z.boolean(),
      sms: z.boolean(),
      inApp: z.boolean(),
    }),
    ocrEnabled: z.boolean(),
  })
  .partial();

router.patch(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const before = (await getOrCreate()).toJSON();
    const s = await SystemSettings.findByIdAndUpdate('app', req.body, { new: true, upsert: true });
    recordAudit(req, { action: 'SETTINGS_CHANGE', entity: 'SystemSettings', entityId: 'app', before, after: s?.toJSON() });
    ok(res, s);
  }),
);

/** Backup status is surfaced honestly - "never" until a real backup job runs. */
router.get(
  '/backup-status',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  asyncHandler(async (_req, res) => {
    const s = await getOrCreate();
    ok(res, {
      lastBackupAt: s.lastBackupAt,
      lastBackupStatus: s.lastBackupStatus,
      configured: false,
      note: 'Automated backup is not configured. See docs/DEPLOYMENT.md for MongoDB Atlas backup + object-store lifecycle setup.',
    });
  }),
);

export default router;
