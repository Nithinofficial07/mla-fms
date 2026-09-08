import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { parseListParams, paginate, withId } from '../../utils/queryFeatures.js';
import { RequestModel } from '../../models/Request.js';
import { Department } from '../../models/Department.js';
import { User } from '../../models/User.js';
import { Assignment } from '../../models/workflow.js';
import { addTimeline, listTimeline } from '../workflow/timeline.service.js';
import { notifyUsers } from '../notifications/notify.js';
import { notifyRequestToDepartment } from '../notifications/requestNotify.js';
import { requestsService } from './requests.service.js';
import {
  assignSchema, createRequestSchema, duplicateCheckSchema,
  forwardSchema, statusChangeSchema, updateRequestSchema,
} from './requests.validation.js';

const router = Router();
router.use(authenticate);

/* ----------------------------- list & detail ----------------------------- */
router.get(
  '/',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter = requestsService.buildListFilter(req.query as Record<string, unknown>, req.auth!);
    const result = await paginate(RequestModel, filter, params, {
      populate: ['priorityId', 'statusId', 'primaryDepartmentId', 'assignedOfficerId'],
    });
    ok(res, result);
  }),
);

router.get(
  '/duplicates',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  validate({ query: duplicateCheckSchema }),
  asyncHandler(async (req, res) =>
    ok(res, { matches: await requestsService.findDuplicates(req.query as Record<string, string>) }),
  ),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => ok(res, await requestsService.getDetail(req.params.id))),
);

router.get(
  '/:id/timeline',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => ok(res, withId(await listTimeline(req.params.id)))),
);

/* ------------------------------- mutations ------------------------------- */
router.post(
  '/',
  requirePermission(PERMISSIONS.REQUEST_CREATE),
  validate({ body: createRequestSchema }),
  asyncHandler(async (req, res) => {
    const doc = await requestsService.create({
      body: req.body,
      actorId: req.auth!.userId,
      actorName: req.auth!.name,
    });
    recordAudit(req, { action: 'CREATE', entity: 'Request', entityId: String(doc._id), after: { fileId: doc.fileId } });
    if (doc.primaryDepartmentId) {
      await notifyRequestToDepartment({
        request: doc,
        departmentId: String(doc.primaryDepartmentId),
        officerId: doc.assignedOfficerId ? String(doc.assignedOfficerId) : null,
        kind: 'CREATED',
        actorId: req.auth!.userId,
      });
    }
    created(res, doc);
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.REQUEST_EDIT),
  validate({ body: updateRequestSchema }),
  asyncHandler(async (req, res) => {
    const before = await RequestModel.findById(req.params.id).lean();
    const doc = await requestsService.update(req.params.id, req.body);
    recordAudit(req, { action: 'UPDATE', entity: 'Request', entityId: req.params.id, before, after: doc.toJSON() });
    ok(res, doc);
  }),
);

router.post(
  '/:id/submit',
  requirePermission(PERMISSIONS.REQUEST_CREATE),
  asyncHandler(async (req, res) => {
    const doc = await requestsService.submit(req.params.id, req.auth!.userId, req.auth!.name);
    recordAudit(req, { action: 'REQUEST_SUBMIT', entity: 'Request', entityId: req.params.id });
    if (doc.primaryDepartmentId) {
      await notifyRequestToDepartment({
        request: doc,
        departmentId: String(doc.primaryDepartmentId),
        officerId: doc.assignedOfficerId ? String(doc.assignedOfficerId) : null,
        kind: 'CREATED',
        actorId: req.auth!.userId,
      });
    }
    ok(res, doc);
  }),
);

router.post(
  '/:id/status',
  requirePermission(PERMISSIONS.REQUEST_STATUS_CHANGE),
  validate({ body: statusChangeSchema }),
  asyncHandler(async (req, res) => {
    const doc = await requestsService.changeStatus(
      req.params.id, req.body.toStatusCode, req.body.remark, req.auth!.userId, req.auth!.name,
    );
    recordAudit(req, { action: 'STATUS_CHANGE', entity: 'Request', entityId: req.params.id, after: { statusCode: doc.statusCode } });
    if (doc.assignedOfficerId) {
      await notifyUsers([String(doc.assignedOfficerId)], {
        type: 'STATUS_CHANGED', title: `Status: ${doc.statusCode}`, body: doc.subject,
        requestId: req.params.id, link: `/requests/${req.params.id}`,
      });
    }
    ok(res, doc);
  }),
);

async function doAssignOrForward(kind: 'ASSIGN' | 'FORWARD', req: any, res: any) {
  const doc = await RequestModel.findById(req.params.id);
  if (!doc) throw AppError.notFound('Request not found');
  const dept = await Department.findById(req.body.departmentId).lean();
  if (!dept) throw AppError.badRequest('Unknown department');
  let officerId: string | null = req.body.officerId ?? null;
  if (officerId) {
    const officer = await User.findById(officerId).lean();
    if (!officer || String(officer.departmentId) !== String(dept._id)) {
      throw AppError.badRequest('Officer does not belong to the selected department');
    }
  }

  const fromDept = doc.primaryDepartmentId;
  if (kind === 'ASSIGN') doc.primaryDepartmentId = dept._id;
  else doc.secondaryDepartmentId = dept._id;
  if (officerId) doc.assignedOfficerId = officerId as any;
  if (req.body.dueDate) doc.dueDate = new Date(req.body.dueDate);
  if (req.body.priorityId) doc.priorityId = req.body.priorityId;

  const target = await import('../../models/config.js').then((m) => m.RequestStatus.findOne({
    code: kind === 'ASSIGN' ? 'ASSIGNED' : 'FORWARDED', isActive: true,
  }).lean());
  if (target) {
    doc.statusId = target._id;
    doc.statusCode = target.code;
  }
  await doc.save();

  await Assignment.create({
    requestId: doc._id, kind, fromDepartmentId: fromDept ?? null, toDepartmentId: dept._id,
    toOfficerId: officerId, priorityId: req.body.priorityId ?? null,
    dueDate: req.body.dueDate ?? null, remark: req.body.remark ?? '', actedBy: req.auth.userId,
  });
  await addTimeline({
    requestId: String(doc._id),
    action: kind === 'ASSIGN' ? 'REQUEST_ASSIGN' : 'REQUEST_FORWARD',
    label: `${kind === 'ASSIGN' ? 'Assigned' : 'Forwarded'} to ${dept.name}${officerId ? '' : ' (no officer yet)'}`,
    actorId: req.auth.userId, actorName: req.auth.name, remark: req.body.remark ?? null,
    toStatus: doc.statusCode,
  });
  recordAudit(req, { action: kind === 'ASSIGN' ? 'REQUEST_ASSIGN' : 'REQUEST_FORWARD', entity: 'Request', entityId: String(doc._id), after: { departmentId: String(dept._id), officerId } });

  await notifyRequestToDepartment({
    request: doc,
    departmentId: String(dept._id),
    officerId,
    kind: kind === 'ASSIGN' ? 'ASSIGNED' : 'FORWARDED',
    actorId: req.auth.userId,
  });
  ok(res, doc);
}

router.post(
  '/:id/assign',
  requirePermission(PERMISSIONS.REQUEST_ASSIGN),
  validate({ body: assignSchema }),
  asyncHandler((req, res) => doAssignOrForward('ASSIGN', req, res)),
);

router.post(
  '/:id/forward',
  requirePermission(PERMISSIONS.REQUEST_FORWARD),
  validate({ body: forwardSchema }),
  asyncHandler((req, res) => doAssignOrForward('FORWARD', req, res)),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.REQUEST_DELETE),
  asyncHandler(async (req, res) => {
    const doc = await RequestModel.findById(req.params.id);
    if (!doc) throw AppError.notFound('Request not found');
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'Request', entityId: req.params.id });
    res.status(204).send();
  }),
);

/* -------------------------------- remarks -------------------------------- */
router.get(
  '/:id/remarks',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => {
    const { Remark } = await import('../../models/workflow.js');
    ok(res, withId(await Remark.find({ requestId: req.params.id }).sort('-createdAt').lean()));
  }),
);

router.post(
  '/:id/remarks',
  requirePermission(PERMISSIONS.REMARK_ADD),
  validate({ body: z.object({ body: z.string().min(1), kind: z.enum(['INTERNAL', 'DEPARTMENT_RESPONSE']).optional() }) }),
  asyncHandler(async (req, res) => {
    const { Remark } = await import('../../models/workflow.js');
    const doc = await RequestModel.findById(req.params.id).lean();
    if (!doc) throw AppError.notFound('Request not found');
    const remark = await Remark.create({
      requestId: req.params.id, body: req.body.body, kind: req.body.kind ?? 'INTERNAL',
      authorId: req.auth!.userId, authorName: req.auth!.name,
    });
    await addTimeline({
      requestId: req.params.id, action: 'REMARK_ADD', label: 'Remark added',
      actorId: req.auth!.userId, actorName: req.auth!.name, remark: req.body.body,
    });
    recordAudit(req, { action: 'REMARK_ADD', entity: 'Request', entityId: req.params.id });
    await notifyUsers([String(doc.createdBy), doc.assignedOfficerId ? String(doc.assignedOfficerId) : null], {
      type: 'REMARK_ADDED', title: `New remark on ${doc.fileId}`, body: req.body.body,
      requestId: req.params.id, link: `/requests/${req.params.id}`,
    });
    created(res, remark);
  }),
);

export default router;
