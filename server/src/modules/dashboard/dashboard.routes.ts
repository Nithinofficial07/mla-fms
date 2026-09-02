import { Router } from 'express';
import dayjs from 'dayjs';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { withId } from '../../utils/queryFeatures.js';
import { RequestModel } from '../../models/Request.js';
import { RequestStatus } from '../../models/config.js';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.DASHBOARD_VIEW));

/** Officer scoping: department officers see only their department's slice. */
function scope(auth: Express.AuthContext): Record<string, unknown> {
  if (auth.roleCode === 'DEPARTMENT_OFFICER' && auth.departmentId) {
    return {
      $or: [
        { primaryDepartmentId: auth.departmentId },
        { secondaryDepartmentId: auth.departmentId },
        { assignedOfficerId: auth.userId },
      ],
    };
  }
  return {};
}

/** GET /api/dashboard/stats - all numbers come from live aggregation. */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const base = scope(req.auth!);
    const startOfToday = dayjs().startOf('day').toDate();
    const terminal = (await RequestStatus.find({ isTerminal: true }).select('code').lean()).map((s) => s.code);

    const [byStatus, total, todayRequests, overdue, urgent] = await Promise.all([
      RequestModel.aggregate([{ $match: base }, { $group: { _id: '$statusCode', n: { $sum: 1 } } }]),
      RequestModel.countDocuments(base),
      RequestModel.countDocuments({ ...base, createdAt: { $gte: startOfToday } }),
      RequestModel.countDocuments({ ...base, dueDate: { $lt: new Date() }, statusCode: { $nin: terminal } }),
      RequestModel.aggregate([
        { $match: base },
        { $lookup: { from: 'priorities', localField: 'priorityId', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $match: { 'p.code': 'URGENT' } },
        { $count: 'n' },
      ]),
    ]);

    const map = Object.fromEntries(byStatus.map((r) => [r._id, r.n])) as Record<string, number>;
    const sum = (codes: string[]) => codes.reduce((a, c) => a + (map[c] ?? 0), 0);

    ok(res, {
      totalFiles: total,
      newRequests: sum(['SUBMITTED']),
      pending: sum(['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'AWAITING_INFO']),
      inProgress: sum(['IN_PROGRESS', 'FORWARDED', 'DEPT_RESPONSE']),
      completed: sum(['COMPLETED', 'APPROVED']),
      rejected: sum(['REJECTED']),
      overdue,
      urgent: urgent[0]?.n ?? 0,
      departmentPending: req.auth!.departmentId ? sum(['ASSIGNED', 'FORWARDED', 'IN_PROGRESS']) : 0,
      todayRequests,
      closed: sum(['CLOSED']),
    });
  }),
);

router.get(
  '/charts',
  asyncHandler(async (req, res) => {
    const base = scope(req.auth!);
    const [byDepartment, byStatus, monthly, byWard, byGramPanchayat] = await Promise.all([
      RequestModel.aggregate([
        { $match: base },
        { $group: { _id: '$primaryDepartmentId', n: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'd' } },
        { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
        { $project: { label: { $ifNull: ['$d.name', 'Unassigned'] }, n: 1 } },
        { $sort: { n: -1 } },
      ]),
      RequestModel.aggregate([{ $match: base }, { $group: { _id: '$statusCode', n: { $sum: 1 } } }]),
      RequestModel.aggregate([
        { $match: base },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
        { $limit: 24 },
      ]),
      RequestModel.aggregate([
        { $match: base },
        { $group: { _id: '$location.wardId', n: { $sum: 1 } } },
        { $lookup: { from: 'wards', localField: '_id', foreignField: '_id', as: 'w' } },
        { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
        { $project: { label: { $ifNull: ['$w.name', 'N/A'] }, n: 1 } },
        { $sort: { n: -1 } },
        { $limit: 15 },
      ]),
      RequestModel.aggregate([
        { $match: base },
        { $group: { _id: '$location.gramPanchayatId', n: { $sum: 1 } } },
        { $lookup: { from: 'grampanchayats', localField: '_id', foreignField: '_id', as: 'g' } },
        { $unwind: { path: '$g', preserveNullAndEmptyArrays: true } },
        { $project: { label: { $ifNull: ['$g.name', 'N/A'] }, n: 1 } },
        { $sort: { n: -1 } },
        { $limit: 15 },
      ]),
    ]);

    ok(res, {
      byDepartment: byDepartment.map((r) => ({ label: r.label, value: r.n })),
      byStatus: byStatus.map((r) => ({ label: r._id, value: r.n })),
      monthly: monthly.map((r) => ({ label: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, value: r.n })),
      byWard: byWard.map((r) => ({ label: r.label, value: r.n })),
      byGramPanchayat: byGramPanchayat.map((r) => ({ label: r.label, value: r.n })),
    });
  }),
);

router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const rows = await RequestModel.find(scope(req.auth!))
      .sort('-createdAt')
      .limit(10)
      .populate(['statusId', 'priorityId', 'primaryDepartmentId'])
      .lean();
    ok(res, withId(rows));
  }),
);

export default router;
