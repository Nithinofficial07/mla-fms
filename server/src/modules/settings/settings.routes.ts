import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { SystemSettings } from '../../models/config.js';
import { User } from '../../models/User.js';
import { sendEmailNow, emailLayout, emailConfigured } from '../notifications/email.js';

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

/** Whether SMTP is wired up (for the Settings UI to show status). */
router.get(
  '/email-status',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  asyncHandler(async (_req, res) => ok(res, { configured: emailConfigured() })),
);

/** Sends a test email to the signed-in admin so SMTP config can be verified. */
router.post(
  '/test-email',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.auth!.userId).select('email name').lean();
    if (!me?.email) throw AppError.badRequest('Your account has no email address');
    const result = await sendEmailNow({
      to: me.email,
      subject: 'MLA FMS - test email',
      html: emailLayout('SMTP is working', [
        ['To', me.email],
        ['Requested by', me.name],
        ['When', new Date().toLocaleString('en-IN')],
      ]),
      text: 'This confirms the MLA File Management System can send email through your SMTP settings.',
    });
    recordAudit(req, { action: 'SETTINGS_CHANGE', entity: 'SystemSettings', entityId: 'app', message: `test email: ${result.ok ? 'ok' : result.detail}` });
    if (!result.ok) return res.status(502).json({ message: result.detail, code: 'EMAIL_FAILED' });
    ok(res, { message: `Test email sent to ${me.email}. Check your inbox (and spam).`, detail: result.detail });
  }),
);

export default router;
