import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { hashPassword } from '../../utils/password.js';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { Constituency } from '../../models/location.js';
import { SystemSettings } from '../../models/config.js';
import { seedConfigDefaults } from '../../seed/configDefaults.js';

const router = Router();

/**
 * GET /api/setup/status  (public)
 * Tells the SPA whether to show the first-run wizard. `needsBootstrap` is true
 * when there is not a single user yet - that first call is allowed unauthenticated.
 */
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const [userCount, settings] = await Promise.all([
      User.countDocuments().setOptions({ withDeleted: true }),
      SystemSettings.findById('app').lean(),
    ]);
    ok(res, {
      needsBootstrap: userCount === 0,
      setupCompleted: !!settings?.setupCompleted,
    });
  }),
);

/**
 * POST /api/setup/bootstrap  (public, one-shot)
 * Seeds the reference-data defaults (roles, priorities, statuses, categories,
 * lookups) and creates the very first Super Admin. 409 once any user exists.
 */
router.post(
  '/bootstrap',
  validate({
    body: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      username: z.string().min(3),
      password: z.string().min(8).regex(/\d/).regex(/[a-zA-Z]/),
      constituencyName: z.string().min(2),
      appName: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (await User.countDocuments().setOptions({ withDeleted: true })) {
      return res.status(409).json({ message: 'Setup already completed', code: 'CONFLICT' });
    }
    await seedConfigDefaults();
    const superAdmin = await Role.findOne({ code: ROLES.SUPER_ADMIN });

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      username: req.body.username,
      passwordHash: await hashPassword(req.body.password),
      roleId: superAdmin!._id,
      roleCode: ROLES.SUPER_ADMIN,
    });
    await Constituency.findOneAndUpdate(
      { isPrimary: true },
      { $setOnInsert: { name: req.body.constituencyName, isPrimary: true } },
      { upsert: true },
    );
    await SystemSettings.findByIdAndUpdate(
      'app',
      {
        $set: {
          constituencyName: req.body.constituencyName,
          appName: req.body.appName ?? 'MLA File Management System',
        },
      },
      { upsert: true },
    );
    recordAudit(req, { action: 'CREATE', entity: 'User', entityId: String(user._id), message: 'bootstrap super admin' });
    ok(res, { message: 'Setup complete. You can now log in.', userId: String(user._id) });
  }),
);

/** Marks the guided wizard finished (auth required). */
router.post(
  '/complete',
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    await SystemSettings.findByIdAndUpdate('app', { $set: { setupCompleted: true } }, { upsert: true });
    recordAudit(req, { action: 'SETTINGS_CHANGE', entity: 'SystemSettings', entityId: 'app', message: 'setup wizard completed' });
    ok(res, { ok: true });
  }),
);

export default router;
