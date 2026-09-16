import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, noContent, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate, withId } from '../../utils/queryFeatures.js';
import { Letter } from '../../models/Letter.js';
import { Remark } from '../../models/workflow.js';
import { addTimeline, listTimeline } from '../workflow/timeline.service.js';
import { toCsv, toPdf, toXlsx } from '../reports/reports.service.js';
import { lettersService } from './letters.service.js';
import { createLetterSchema, letterRemarkSchema, letterStatusSchema, updateLetterSchema } from './letters.validation.js';

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

/** Export the current filtered letters list as CSV / Excel / PDF. */
router.get(
  '/export',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => {
    const format = String(req.query.format ?? 'csv');
    const filter = lettersService.buildListFilter(req.query as Record<string, unknown>);
    const rows = await Letter.find(filter)
      .sort('-date')
      .limit(5000)
      .populate(['departmentId'])
      .lean();
    const columns = ['letterNo', 'date', 'applicant', 'mobile', 'subject', 'referredBy', 'department', 'status'];
    const data = rows.map((l: any) => ({
      letterNo: l.letterNo,
      date: l.date ? new Date(l.date).toISOString().slice(0, 10) : '',
      applicant: l.applicant?.name,
      mobile: l.applicant?.mobile,
      subject: l.subject,
      referredBy: l.referredBy ?? '',
      department: l.departmentId?.name ?? '',
      status: l.status,
    }));
    recordAudit(req, { action: 'CREATE', entity: 'Letter', entityId: 'export', message: `export ${format}` });

    if (format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="letters.xlsx"');
      return res.send(await toXlsx('Letters', columns, data));
    }
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="letters.pdf"');
      return res.send(await toPdf('Letters', columns, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="letters.csv"');
    return res.send(toCsv(columns, data));
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => ok(res, await lettersService.getDetail(req.params.id))),
);

router.get(
  '/:id/timeline',
  requirePermission(PERMISSIONS.LETTER_VIEW),
  asyncHandler(async (req, res) => ok(res, withId(await listTimeline({ letterId: req.params.id })))),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.LETTER_CREATE),
  validate({ body: createLetterSchema }),
  asyncHandler(async (req, res) => {
    const doc = await lettersService.create(req.body, req.auth!.userId);
    recordAudit(req, { action: 'CREATE', entity: 'Letter', entityId: String(doc._id), after: { letterNo: doc.letterNo } });
    await addTimeline({
      letterId: String(doc._id), action: 'LETTER_CREATED', label: `Letter ${doc.letterNo} created`,
      actorId: req.auth!.userId, actorName: req.auth!.name, toStatus: doc.status,
    });
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
    const before = await Letter.findById(req.params.id).lean();
    if (!before) throw AppError.notFound('Letter not found');
    const doc = await lettersService.setStatus(req.params.id, req.body.status);
    recordAudit(req, { action: 'STATUS_CHANGE', entity: 'Letter', entityId: req.params.id, after: { status: doc.status } });
    if (before.status !== doc.status) {
      await addTimeline({
        letterId: req.params.id, action: 'STATUS_CHANGE',
        label: `Status changed from ${before.status} to ${doc.status}`,
        actorId: req.auth!.userId, actorName: req.auth!.name,
        fromStatus: before.status, toStatus: doc.status, remark: req.body.remark ?? null,
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
    ok(res, withId(await Remark.find({ letterId: req.params.id }).sort('-createdAt').lean()));
  }),
);

router.post(
  '/:id/remarks',
  requirePermission(PERMISSIONS.REMARK_ADD),
  validate({ body: letterRemarkSchema }),
  asyncHandler(async (req, res) => {
    const doc = await Letter.findById(req.params.id).lean();
    if (!doc) throw AppError.notFound('Letter not found');
    const remark = await Remark.create({
      letterId: req.params.id, body: req.body.body, kind: 'INTERNAL',
      authorId: req.auth!.userId, authorName: req.auth!.name,
    });
    await addTimeline({
      letterId: req.params.id, action: 'REMARK_ADD', label: 'Remark added',
      actorId: req.auth!.userId, actorName: req.auth!.name, remark: req.body.body,
    });
    recordAudit(req, { action: 'REMARK_ADD', entity: 'Letter', entityId: req.params.id });
    created(res, remark);
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
