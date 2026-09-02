import { Router } from 'express';
import type { Model, FilterQuery } from 'mongoose';
import { z } from 'zod';
import type { Permission } from '@mla/shared';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, created, noContent, ok } from './http.js';
import { AppError } from './AppError.js';
import { parseListParams, paginate, escapeRegex, withId } from './queryFeatures.js';
import { recordAudit } from './audit.js';

interface CrudOptions<T> {
  model: Model<T>;
  entity: string;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  /** permissions: [read, write] */
  permissions: { read: Permission; write: Permission };
  /** regex-searched fields for ?search= */
  searchFields?: string[];
  /** query keys copied verbatim into the Mongo filter (equality) */
  filterFields?: string[];
  populate?: string | string[];
  /** guard executed before a delete; throw AppError to block (e.g. FK in use) */
  beforeDelete?: (id: string) => Promise<void>;
  softDelete?: boolean;
}

/**
 * Builds a REST router for a simple master-data collection:
 *   GET /            list (paginated, ?search=, ?includeInactive=)
 *   GET /:id         read one
 *   POST /           create
 *   PATCH /:id       update
 *   DELETE /:id      soft-delete (deactivate) by default
 *   POST /:id/restore
 * Every mutation writes an audit record.
 */
export function crudRouter<T>(o: CrudOptions<T>): Router {
  const r = Router();
  const soft = o.softDelete ?? true;
  r.use(authenticate);

  r.get(
    '/',
    requirePermission(o.permissions.read),
    asyncHandler(async (req, res) => {
      const params = parseListParams(req.query as Record<string, unknown>);
      const filter: FilterQuery<T> = {};
      if (params.search && o.searchFields?.length) {
        const rx = new RegExp(escapeRegex(params.search), 'i');
        (filter as Record<string, unknown>).$or = o.searchFields.map((f) => ({ [f]: rx }));
      }
      for (const key of o.filterFields ?? []) {
        const v = (req.query as Record<string, unknown>)[key];
        if (v !== undefined && v !== '') (filter as Record<string, unknown>)[key] = v;
      }
      if (soft && (req.query as Record<string, unknown>).includeInactive !== 'true') {
        (filter as Record<string, unknown>).isActive = true;
      }
      const result = await paginate(o.model, filter, params, { populate: o.populate });
      ok(res, result);
    }),
  );

  r.get(
    '/:id',
    requirePermission(o.permissions.read),
    asyncHandler(async (req, res) => {
      let q = o.model.findById(req.params.id);
      if (o.populate) q = q.populate(o.populate as string);
      const doc = await q.lean();
      if (!doc) throw AppError.notFound(`${o.entity} not found`);
      ok(res, withId(doc));
    }),
  );

  r.post(
    '/',
    requirePermission(o.permissions.write),
    validate({ body: o.createSchema }),
    asyncHandler(async (req, res) => {
      const doc = await o.model.create(req.body);
      recordAudit(req, { action: 'CREATE', entity: o.entity, entityId: String(doc._id), after: doc.toJSON() });
      created(res, doc);
    }),
  );

  r.patch(
    '/:id',
    requirePermission(o.permissions.write),
    validate({ body: o.updateSchema }),
    asyncHandler(async (req, res) => {
      const before = await o.model.findById(req.params.id).lean();
      if (!before) throw AppError.notFound(`${o.entity} not found`);
      const doc = await o.model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      recordAudit(req, {
        action: 'UPDATE',
        entity: o.entity,
        entityId: req.params.id,
        before,
        after: doc?.toJSON(),
      });
      ok(res, doc);
    }),
  );

  r.delete(
    '/:id',
    requirePermission(o.permissions.write),
    asyncHandler(async (req, res) => {
      const doc = await o.model.findById(req.params.id);
      if (!doc) throw AppError.notFound(`${o.entity} not found`);
      await o.beforeDelete?.(req.params.id);
      if (soft && 'isActive' in doc) {
        // Deactivate (reversible). deletedAt is reserved for a true delete and
        // is intentionally left null so the row stays visible with
        // ?includeInactive=true and can be re-activated via /:id/restore.
        (doc as unknown as { isActive: boolean }).isActive = false;
        await doc.save();
        recordAudit(req, { action: 'SOFT_DELETE', entity: o.entity, entityId: req.params.id });
      } else {
        await doc.deleteOne();
        recordAudit(req, { action: 'DELETE', entity: o.entity, entityId: req.params.id });
      }
      noContent(res);
    }),
  );

  r.post(
    '/:id/restore',
    requirePermission(o.permissions.write),
    asyncHandler(async (req, res) => {
      const doc = await o.model.findOne({ _id: req.params.id }).setOptions({ withDeleted: true });
      if (!doc) throw AppError.notFound(`${o.entity} not found`);
      if ('isActive' in doc) {
        (doc as unknown as { isActive: boolean; deletedAt: Date | null }).isActive = true;
        (doc as unknown as { isActive: boolean; deletedAt: Date | null }).deletedAt = null;
        await doc.save();
      }
      recordAudit(req, { action: 'RESTORE', entity: o.entity, entityId: req.params.id });
      ok(res, doc);
    }),
  );

  return r;
}
