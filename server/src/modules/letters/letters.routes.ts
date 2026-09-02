import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, noContent, ok } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate } from '../../utils/queryFeatures.js';
import { Letter } from '../../models/Letter.js';
import { lettersService } from './letters.service.js';
import { createLetterSchema, letterStatusSchema, updateLetterSchema } from './letters.validation.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter = lettersService.buildListFilter(req.query as Record<string, unknown>);
    ok(res, await paginate(Letter, filter, params, { populate: ['departmentId'] }));
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => ok(res, await lettersService.getDetail(req.params.id))),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.LETTER_CREATE),
  validate({ body: createLetterSchema }),
  asyncHandler(async (req, res) => {
    const doc = await lettersService.create(req.body, req.auth!.userId);
    recordAudit(req, { action: 'CREATE', entity: 'Letter', entityId: String(doc._id), after: { letterNo: doc.letterNo } });
    created(res, doc);
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_EDIT),
  validate({ body: updateLetterSchema }),
  asyncHandler(async (req, res) => {
    const before = await Letter.findById(req.params.id).lean();
    const doc = await lettersService.update(req.params.id, req.body);
    recordAudit(req, { action: 'UPDATE', entity: 'Letter', entityId: req.params.id, before, after: doc.toJSON() });
    ok(res, doc);
  }),
);

router.post(
  '/:id/status',
  requirePermission(PERMISSIONS.LETTER_EDIT),
  validate({ body: letterStatusSchema }),
  asyncHandler(async (req, res) => {
    const doc = await lettersService.setStatus(req.params.id, req.body.status);
    recordAudit(req, { action: 'STATUS_CHANGE', entity: 'Letter', entityId: req.params.id, after: { status: doc.status } });
    ok(res, doc);
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_DELETE),
  asyncHandler(async (req, res) => {
    await lettersService.remove(req.params.id);
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'Letter', entityId: req.params.id });
    noContent(res);
  }),
);

export default router;
