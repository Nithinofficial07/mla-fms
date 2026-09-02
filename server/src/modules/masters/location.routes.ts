import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import {
  AreaType, Constituency, GramPanchayat, SubVillage, Village, Ward,
} from '../../models/location.js';
import { RequestModel } from '../../models/Request.js';
import { crudRouter } from '../../utils/crudFactory.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { withId } from '../../utils/queryFeatures.js';
import { AppError } from '../../utils/AppError.js';

const READ = PERMISSIONS.DASHBOARD_VIEW;
const WRITE = PERMISSIONS.LOCATION_MANAGE;

const named = { name: z.string().min(1), code: z.string().optional(), description: z.string().optional() };

export const constituencyRouter = crudRouter({
  model: Constituency,
  entity: 'Constituency',
  createSchema: z.object({ ...named, state: z.string().optional(), district: z.string().optional(), isPrimary: z.boolean().optional() }),
  updateSchema: z.object({ ...named, state: z.string(), district: z.string(), isPrimary: z.boolean(), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code', 'district'],
});

export const areaTypeRouter = crudRouter({
  model: AreaType,
  entity: 'AreaType',
  createSchema: z.object({ code: z.string().min(2), name: z.string().min(2), childLabel: z.string().optional() }),
  updateSchema: z.object({ name: z.string().min(2), childLabel: z.string(), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code'],
});

export const wardRouter = crudRouter({
  model: Ward,
  entity: 'Ward',
  createSchema: z.object({ ...named, number: z.string().optional(), constituencyId: z.string().length(24) }),
  updateSchema: z.object({ ...named, number: z.string(), constituencyId: z.string().length(24), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code', 'number'],
  filterFields: ['constituencyId'],
  populate: 'constituencyId',
  async beforeDelete(id) {
    if (await RequestModel.countDocuments({ 'location.wardId': id })) {
      throw AppError.conflict('Ward has linked requests. Deactivate it instead.');
    }
  },
});

export const gramPanchayatRouter = crudRouter({
  model: GramPanchayat,
  entity: 'GramPanchayat',
  createSchema: z.object({ ...named, constituencyId: z.string().length(24) }),
  updateSchema: z.object({ ...named, constituencyId: z.string().length(24), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code'],
  filterFields: ['constituencyId'],
  populate: 'constituencyId',
  async beforeDelete(id) {
    if (await Village.countDocuments({ gramPanchayatId: id })) {
      throw AppError.conflict('Gram Panchayat has villages. Move or remove them first.');
    }
  },
});

export const villageRouter = crudRouter({
  model: Village,
  entity: 'Village',
  createSchema: z
    .object({
      name: z.string().min(1),
      code: z.string().optional(),
      parentType: z.enum(['GRAM_PANCHAYAT', 'WARD']),
      gramPanchayatId: z.string().length(24).nullable().optional(),
      wardId: z.string().length(24).nullable().optional(),
    })
    .refine((v) => (v.parentType === 'GRAM_PANCHAYAT' ? !!v.gramPanchayatId : !!v.wardId), {
      message: 'Parent id must match parentType',
      path: ['parentType'],
    }),
  updateSchema: z.object({ name: z.string().min(1), code: z.string(), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code'],
  filterFields: ['gramPanchayatId', 'wardId', 'parentType'],
  async beforeDelete(id) {
    if (await SubVillage.countDocuments({ villageId: id })) {
      throw AppError.conflict('Village has sub-villages. Remove them first.');
    }
  },
});

export const subVillageRouter = crudRouter({
  model: SubVillage,
  entity: 'SubVillage',
  createSchema: z.object({ name: z.string().min(1), code: z.string().optional(), villageId: z.string().length(24) }),
  updateSchema: z.object({ name: z.string().min(1), code: z.string(), isActive: z.boolean() }).partial(),
  permissions: { read: READ, write: WRITE },
  searchFields: ['name', 'code'],
  filterFields: ['villageId'],
});

/**
 * Cascading option endpoints for the request form. Each returns a flat list of
 * { id, name, code } filtered by the selected parent, enforcing the hierarchy:
 * a village only appears for its own GP/Ward.
 */
export const locationOptionsRouter = Router();
locationOptionsRouter.use(authenticate, requirePermission(READ));

locationOptionsRouter.get(
  '/area-types',
  asyncHandler(async (_req, res) => ok(res, withId(await AreaType.find({ isActive: true }).sort('name').lean()))),
);
locationOptionsRouter.get(
  '/wards',
  asyncHandler(async (req, res) => {
    const f: Record<string, unknown> = { isActive: true };
    if (req.query.constituencyId) f.constituencyId = req.query.constituencyId;
    ok(res, withId(await Ward.find(f).sort('name').select('name code number').lean()));
  }),
);
locationOptionsRouter.get(
  '/gram-panchayats',
  asyncHandler(async (req, res) => {
    const f: Record<string, unknown> = { isActive: true };
    if (req.query.constituencyId) f.constituencyId = req.query.constituencyId;
    ok(res, withId(await GramPanchayat.find(f).sort('name').select('name code').lean()));
  }),
);
locationOptionsRouter.get(
  '/villages',
  asyncHandler(async (req, res) => {
    const { gramPanchayatId, wardId } = req.query;
    if (!gramPanchayatId && !wardId) throw AppError.badRequest('gramPanchayatId or wardId is required');
    const f: Record<string, unknown> = { isActive: true };
    if (gramPanchayatId) f.gramPanchayatId = gramPanchayatId;
    if (wardId) f.wardId = wardId;
    ok(res, withId(await Village.find(f).sort('name').select('name code parentType').lean()));
  }),
);
locationOptionsRouter.get(
  '/sub-villages',
  asyncHandler(async (req, res) => {
    if (!req.query.villageId) throw AppError.badRequest('villageId is required');
    ok(res, withId(await SubVillage.find({ isActive: true, villageId: req.query.villageId }).sort('name').select('name code').lean()));
  }),
);
