import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, ROLES } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, noContent, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate, escapeRegex, withId } from '../../utils/queryFeatures.js';
import { hashPassword } from '../../utils/password.js';
import { queueEmail, emailLayout } from '../notifications/email.js';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { Department } from '../../models/Department.js';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.USER_MANAGE));

const createSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).regex(/^[a-z0-9._-]+$/i, 'letters, digits, . _ - only'),
  email: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile').optional(),
  designation: z.string().optional(),
  roleId: z.string().length(24),
  departmentId: z.string().length(24).nullable().optional(),
  password: z.string().min(8).regex(/\d/).regex(/[a-zA-Z]/),
  mustChangePassword: z.boolean().optional(),
});

const updateSchema = createSchema
  .omit({ password: true, username: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

async function assertRoleAndDept(roleId: string, departmentId?: string | null): Promise<string> {
  const role = await Role.findById(roleId).lean();
  if (!role) throw AppError.badRequest('Unknown role');
  if (role.code === ROLES.DEPARTMENT_OFFICER && !departmentId) {
    throw AppError.badRequest('Department officers must be linked to a department');
  }
  if (departmentId && !(await Department.exists({ _id: departmentId }))) {
    throw AppError.badRequest('Unknown department');
  }
  return role.code;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    if (params.search) {
      const rx = new RegExp(escapeRegex(params.search), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { username: rx }, { mobile: rx }];
    }
    for (const k of ['roleCode', 'departmentId', 'isActive'] as const) {
      if (req.query[k] !== undefined && req.query[k] !== '') filter[k] = req.query[k];
    }
    ok(res, await paginate(User, filter, params, { populate: ['roleId', 'departmentId'] }));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).populate(['roleId', 'departmentId']).lean();
    if (!user) throw AppError.notFound('User not found');
    ok(res, withId(user));
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const roleCode = await assertRoleAndDept(req.body.roleId, req.body.departmentId);
    const user = await User.create({
      ...req.body,
      roleCode,
      passwordHash: await hashPassword(req.body.password),
      mustChangePassword: req.body.mustChangePassword ?? true,
    });
    recordAudit(req, { action: 'CREATE', entity: 'User', entityId: String(user._id), after: user.toJSON() });
    created(res, user.toJSON());
  }),
);

router.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const before = await User.findById(req.params.id).lean();
    if (!before) throw AppError.notFound('User not found');
    const patch: Record<string, unknown> = { ...req.body };
    if (req.body.roleId) patch.roleCode = await assertRoleAndDept(req.body.roleId, req.body.departmentId ?? before.departmentId);
    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    recordAudit(req, { action: 'UPDATE', entity: 'User', entityId: req.params.id, before, after: user?.toJSON() });
    ok(res, user);
  }),
);

router.post(
  '/:id/reset-password',
  validate({ body: z.object({ password: z.string().min(8).regex(/\d/).regex(/[a-zA-Z]/) }) }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('+tokenVersion');
    if (!user) throw AppError.notFound('User not found');
    user.passwordHash = await hashPassword(req.body.password);
    user.mustChangePassword = true;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    recordAudit(req, { action: 'PASSWORD_RESET', entity: 'User', entityId: req.params.id, message: 'admin reset' });
    queueEmail({
      to: user.email,
      subject: 'Your MLA FMS password was reset',
      html: emailLayout('An administrator reset your password', [
        ['Account', user.email],
        ['Next step', 'Log in with the new password; you will be asked to change it.'],
      ]),
      text: 'An administrator has reset your password. Log in with the new one you were given; you will be prompted to change it.',
    });
    ok(res, { message: 'Password reset. User must change it on next login.' });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.userId) throw AppError.badRequest('You cannot deactivate your own account');
    const user = await User.findById(req.params.id).select('+tokenVersion');
    if (!user) throw AppError.notFound('User not found');
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // force logout everywhere
    await user.save();
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'User', entityId: req.params.id });
    noContent(res);
  }),
);

export default router;
