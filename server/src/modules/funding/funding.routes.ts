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
import { Principal } from '../../models/Principal.js';
import { Remark } from '../../models/workflow.js';
import { addTimeline, listTimeline } from '../workflow/timeline.service.js';
import { createFundingSchema, fundingRemarkSchema, fundingStatusSchema, updateFundingSchema } from './funding.validation.js';

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
    if (req.query.status) filter.status = req.query.status;
    if (!req.auth!.permissions.includes(PERMISSIONS.PRINCIPAL_ALL_VIEW)) {
      filter.principalId = { $in: req.auth!.principalIds };
    }
    ok(res, await paginate(FundingRequest, filter, params, { populate: ['principalId', 'departmentId', 'createdBy'] }));
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    const doc = await FundingRequest.findById(req.params.id).populate(['principalId', 'departmentId', 'createdBy']).lean();
    if (!doc) throw AppError.notFound('Funding request not found');
    if (
      !req.auth!.permissions.includes(PERMISSIONS.PRINCIPAL_ALL_VIEW)
      && !req.auth!.principalIds.includes(String((doc as any).principalId?._id ?? (doc as any).principalId))
    ) {
      throw AppError.notFound('Funding request not found');
    }
    ok(res, withId(doc));
  }),
);

router.get(
  '/:id/timeline',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => ok(res, withId(await listTimeline({ fundingRequestId: req.params.id })))),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.LETTER_CREATE),
  validate({ body: createFundingSchema }),
  asyncHandler(async (req, res) => {
    const principal = await Principal.findById(req.body.principalId).lean();
    if (!principal) throw AppError.badRequest('Unknown principal');
    const seq = await nextSequence(yearlyKey(`fundingRequestId:${principal.code}`));
    const doc = await FundingRequest.create({
      principalId: principal._id,
      fundingRequestId: formatId({ format: `${principal.idPrefix}-FUND/{SEQ:5}`, seq, date: new Date() }),
      departmentId: req.body.departmentId,
      subject: req.body.subject,
      address: req.body.address,
      letterNo: req.body.letterNo,
      pointPersonName: req.body.pointPersonName,
      pointPersonNumber: req.body.pointPersonNumber,
      createdBy: req.auth!.userId,
    });
    recordAudit(req, { action: 'CREATE', entity: 'FundingRequest', entityId: String(doc._id), after: { fundingRequestId: doc.fundingRequestId } });
    await addTimeline({
      fundingRequestId: String(doc._id), action: 'FUNDING_CREATED', label: `Funding request ${doc.fundingRequestId} created`,
      actorId: req.auth!.userId, actorName: req.auth!.name, toStatus: doc.status,
    });
    created(res, doc);
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_EDIT),
  validate({ body: updateFundingSchema }),
  asyncHandler(async (req, res) => {
    const before = await FundingRequest.findById(req.params.id).lean();
    if (!before) throw AppError.notFound('Funding request not found');
    const doc = await FundingRequest.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(['departmentId', 'createdBy']);
    recordAudit(req, { action: 'UPDATE', entity: 'FundingRequest', entityId: req.params.id, before, after: doc!.toJSON() });
    ok(res, doc);
  }),
);

router.post(
  '/:id/status',
  requirePermission(PERMISSIONS.LETTER_EDIT),
  validate({ body: fundingStatusSchema }),
  asyncHandler(async (req, res) => {
    const before = await FundingRequest.findById(req.params.id).lean();
    if (!before) throw AppError.notFound('Funding request not found');
    const doc = await FundingRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    recordAudit(req, { action: 'STATUS_CHANGE', entity: 'FundingRequest', entityId: req.params.id, after: { status: doc!.status } });
    if (before.status !== doc!.status) {
      await addTimeline({
        fundingRequestId: req.params.id, action: 'STATUS_CHANGE',
        label: `Status changed from ${before.status} to ${doc!.status}`,
        actorId: req.auth!.userId, actorName: req.auth!.name,
        fromStatus: before.status, toStatus: doc!.status, remark: req.body.remark ?? null,
      });
    }
    ok(res, doc);
  }),
);

/* -------------------------------- remarks -------------------------------- */
router.get(
  '/:id/remarks',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, withId(await Remark.find({ fundingRequestId: req.params.id }).sort('-createdAt').lean()));
  }),
);

router.post(
  '/:id/remarks',
  requirePermission(PERMISSIONS.REMARK_ADD),
  validate({ body: fundingRemarkSchema }),
  asyncHandler(async (req, res) => {
    const doc = await FundingRequest.findById(req.params.id).lean();
    if (!doc) throw AppError.notFound('Funding request not found');
    const remark = await Remark.create({
      fundingRequestId: req.params.id, body: req.body.body, kind: 'INTERNAL',
      authorId: req.auth!.userId, authorName: req.auth!.name,
    });
    await addTimeline({
      fundingRequestId: req.params.id, action: 'REMARK_ADD', label: 'Remark added',
      actorId: req.auth!.userId, actorName: req.auth!.name, remark: req.body.body,
    });
    recordAudit(req, { action: 'REMARK_ADD', entity: 'FundingRequest', entityId: req.params.id });
    created(res, remark);
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
