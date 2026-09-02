import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { parseListParams, paginate } from '../../utils/queryFeatures.js';
import { AuditLog } from '../../models/AuditLog.js';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.AUDIT_VIEW));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    for (const k of ['action', 'entity', 'entityId', 'actorId'] as const) {
      if (req.query[k]) filter[k] = req.query[k];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) (filter.createdAt as Record<string, unknown>).$gte = new Date(String(req.query.from));
      if (req.query.to) (filter.createdAt as Record<string, unknown>).$lte = new Date(String(req.query.to));
    }
    if (params.search) filter.actorName = new RegExp(params.search, 'i');
    ok(res, await paginate(AuditLog, filter, params));
  }),
);

router.get(
  '/entity/:entity/:id',
  asyncHandler(async (req, res) =>
    ok(res, await AuditLog.find({ entity: req.params.entity, entityId: req.params.id }).sort('-createdAt').lean()),
  ),
);

export default router;
