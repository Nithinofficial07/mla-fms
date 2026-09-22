import { Router } from 'express';
import { formatId, PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate, withId } from '../../utils/queryFeatures.js';
import { nextSequence, yearlyKey } from '../../utils/sequence.js';
import { FundingRequest } from '../../models/FundingRequest.js';
import { createFundingSchema } from './funding.validation.js';

/**
 * Funding requests: MLA-authored correspondence to a department's ministry
 * asking for funding, with supporting photos/scans attached via the
 * Document module (owner kind 'funding'). Reuses the Letter permissions
 * (letter.create/letter.view) rather than introducing new ones - this is
 * the same "MLA office outbound correspondence" category, and it means the
 * feature works immediately for every role that can already create/view
 * letters instead of requiring a manual permission grant per role.
 */
const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    const departmentId = req.query.departmentId;
    if (departmentId) filter.departmentId = departmentId;
    ok(res, await paginate(FundingRequest, filter, params, { populate: ['departmentId', 'createdBy'] }));
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    const doc = await FundingRequest.findById(req.params.id).populate(['departmentId', 'createdBy']).lean();
    if (!doc) throw AppError.notFound('Funding request not found');
    ok(res, withId(doc));
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.LETTER_CREATE),
  validate({ body: createFundingSchema }),
  asyncHandler(async (req, res) => {
    const seq = await nextSequence(yearlyKey('fundingRequestId'));
    const doc = await FundingRequest.create({
      fundingRequestId: formatId({ format: 'FUND/{YYYY}/{SEQ:4}', seq, date: new Date() }),
      departmentId: req.body.departmentId,
      subject: req.body.subject,
      address: req.body.address,
      createdBy: req.auth!.userId,
    });
    recordAudit(req, { action: 'CREATE', entity: 'FundingRequest', entityId: String(doc._id), after: { fundingRequestId: doc.fundingRequestId } });
    created(res, doc);
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_DELETE),
  asyncHandler(async (req, res) => {
    const doc = await FundingRequest.findById(req.params.id);
    if (!doc) throw AppError.notFound('Funding request not found');
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'FundingRequest', entityId: req.params.id });
    res.status(204).send();
  }),
);

export default router;
