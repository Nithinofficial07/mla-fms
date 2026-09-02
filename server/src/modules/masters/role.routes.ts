import { z } from 'zod';
import { PERMISSIONS, ALL_PERMISSIONS } from '@mla/shared';
import { Router } from 'express';
import { Role } from '../../models/Role.js';
import { User } from '../../models/User.js';
import { crudRouter } from '../../utils/crudFactory.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';

const permEnum = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

const crud = crudRouter({
  model: Role,
  entity: 'Role',
  createSchema: z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(permEnum).default([]),
  }),
  updateSchema: z
    .object({
      name: z.string().min(2),
      description: z.string(),
      permissions: z.array(permEnum),
      isActive: z.boolean(),
    })
    .partial(),
  permissions: { read: PERMISSIONS.USER_MANAGE, write: PERMISSIONS.ROLE_MANAGE },
  searchFields: ['code', 'name'],
  async beforeDelete(id) {
    const role = await Role.findById(id).lean();
    if (role?.isSystem) throw AppError.conflict('System roles cannot be deleted');
    if (await User.countDocuments({ roleId: id })) {
      throw AppError.conflict('Role is assigned to users. Reassign them first.');
    }
  },
});

const router = Router();
router.use(authenticate);
/** Catalogue of assignable permissions for the role editor UI. */
router.get(
  '/meta/permissions',
  requirePermission(PERMISSIONS.USER_MANAGE),
  asyncHandler(async (_req, res) => ok(res, { permissions: Object.entries(PERMISSIONS).map(([k, v]) => ({ key: k, value: v })) })),
);
router.use('/', crud);

export default router;
