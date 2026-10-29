import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate } from '../../utils/queryFeatures.js';
import { toXlsx } from '../reports/reports.service.js';
import { Work } from '../../models/Work.js';
import { worksService } from './works.service.js';
import { createWorkSchema, updateWorkSchema } from './works.validation.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.WORK_VIEW),
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter = worksService.buildListFilter(req.query as Record<string, unknown>, req.auth!);
    const result = await paginate(Work, filter, params, {
      populate: ['departmentId', 'location.wardId', 'location.gramPanchayatId', 'location.villageId'],
    });
    ok(res, result);
  }),
);

router.get(
  '/summary',
  requirePermission(PERMISSIONS.WORK_VIEW),
  asyncHandler(async (req, res) => {
    const filter = worksService.buildListFilter(req.query as Record<string, unknown>, req.auth!);
    ok(res, await worksService.summary(filter));
  }),
);

router.get(
  '/export.xlsx',
  requirePermission(PERMISSIONS.WORK_VIEW),
  asyncHandler(async (req, res) => {
    const filter = worksService.buildListFilter(req.query as Record<string, unknown>, req.auth!);
    const rows = await Work.find(filter)
      .populate(['departmentId', 'location.wardId', 'location.gramPanchayatId', 'location.villageId'])
      .sort('-createdAt')
      .lean();
    const columns = ['workId', 'nameOfWork', 'department', 'implementingAgency', 'agencyInspectorName', 'agencyInspectorContact', 'fundingYear', 'location', 'address', 'amountLakhs', 'thirdPartyInspection', 'tpiOfficerName', 'tpiOfficerContact'];
    const data = rows.map((r: any) => ({
      workId: r.workId,
      nameOfWork: r.nameOfWork,
      department: r.departmentId?.name ?? '',
      implementingAgency: r.implementingAgency === 'Other' ? r.implementingAgencyOther : r.implementingAgency,
      agencyInspectorName: r.agencyInspectorName ?? '',
      agencyInspectorContact: r.agencyInspectorContact ?? '',
      fundingYear: r.fundingYear,
      location: r.location?.wardId?.name ?? r.location?.gramPanchayatId?.name ?? r.location?.roadName ?? '',
      address: r.address ?? '',
      amountLakhs: r.amountLakhs,
      thirdPartyInspection: r.thirdPartyInspection,
      tpiOfficerName: r.tpiOfficerName ?? '',
      tpiOfficerContact: r.tpiOfficerContact ?? '',
    }));
    const buf = await toXlsx('Works', columns, data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="works.xlsx"');
    res.send(buf);
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.WORK_VIEW),
  asyncHandler(async (req, res) => ok(res, await worksService.getDetail(req.params.id, req.auth!))),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.WORK_CREATE),
  validate({ body: createWorkSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    // Agency users always create under their own agency, and nobody may file
    // a work under a principal outside their offices.
    if (auth.implementingAgency === '') throw AppError.forbidden('No implementing agency is set on your login - ask the admin to set it under Users');
    if (auth.implementingAgency !== null) req.body.implementingAgency = auth.implementingAgency;
    if (!auth.viewAllPrincipals && !auth.principalIds.includes(String(req.body.principalId))) {
      throw AppError.forbidden('You can only add works for your own office');
    }
    const doc = await worksService.create({ body: req.body, actorId: auth.userId });
    recordAudit(req, { action: 'CREATE', entity: 'Work', entityId: String(doc._id), after: { workId: doc.workId } });
    created(res, doc);
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.WORK_EDIT),
  validate({ body: updateWorkSchema }),
  asyncHandler(async (req, res) => {
    // getDetail also enforces principal scoping - 404s outside the user's offices.
    const before = await worksService.getDetail(req.params.id, req.auth!);
    // An agency user can't hand a work over to a different agency.
    if (req.auth!.implementingAgency !== null && req.body.implementingAgency && req.body.implementingAgency !== req.auth!.implementingAgency) {
      throw AppError.forbidden('You can only update works of your own agency');
    }
    const doc = await Work.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.auth!.userId },
      { new: true },
    ).populate(['departmentId', 'location.wardId', 'location.gramPanchayatId', 'location.villageId']);
    recordAudit(req, { action: 'UPDATE', entity: 'Work', entityId: req.params.id, before, after: doc!.toJSON() });
    ok(res, doc);
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.WORK_DELETE),
  asyncHandler(async (req, res) => {
    await worksService.getDetail(req.params.id, req.auth!);
    const doc = await Work.findById(req.params.id);
    if (!doc) throw AppError.notFound('Work not found');
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'Work', entityId: req.params.id });
    res.status(204).send();
  }),
);

export default router;
