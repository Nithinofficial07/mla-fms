import { Router } from 'express';
import dayjs from 'dayjs';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { withId } from '../../utils/queryFeatures.js';
import { RequestModel } from '../../models/Request.js';
import { RequestStatus } from '../../models/config.js';
import { Ward } from '../../models/location.js';

const LOCATION_POPULATE = ['statusId', 'priorityId', 'primaryDepartmentId', 'location.wardId', 'location.gramPanchayatId'];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** Renders a Gram Panchayat's display order (1-8) as a Roman numeral, matching the Location step's GP dropdown. */
function toRoman(order: number): string {
  if (order <= 0) return '';
  return ROMAN[order] ?? String(order);
}

const PENDING_CODES = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'FORWARDED', 'IN_PROGRESS', 'AWAITING_INFO', 'DEPT_RESPONSE'];

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.DASHBOARD_VIEW));

/** Officer + principal scoping, plus an optional date-range filter shared by all dashboard widgets. */
function scope(auth: Express.AuthContext, query: Record<string, unknown> = {}): Record<string, unknown> {
  // .aggregate() doesn't go through the soft-delete pre-hook that .find()/
  // .countDocuments() get (it's only registered for those), so every
  // aggregation here needs this explicitly or it double-counts deactivated
  // requests against the count-based KPIs.
  const filter: Record<string, unknown> = { deletedAt: null };
  if (auth.roleCode === 'DEPARTMENT_OFFICER' && auth.departmentId) {
    filter.$or = [
      { primaryDepartmentId: auth.departmentId },
      { secondaryDepartmentId: auth.departmentId },
      { assignedOfficerId: auth.userId },
    ];
  }
  if (!auth.viewAllPrincipals) {
    filter.principalId = { $in: auth.principalIds };
  }
  const from = query.from ? new Date(String(query.from)) : undefined;
  const to = query.to ? new Date(String(query.to)) : undefined;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) createdAt.$lte = to;
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  }
  return filter;
}

/** GET /api/dashboard/stats - all numbers come from live aggregation. */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const base = scope(req.auth!, req.query as Record<string, unknown>);
    const startOfToday = dayjs().startOf('day').toDate();
    const startOfWeek = dayjs().startOf('week').toDate();
    const terminal = (await RequestStatus.find({ isTerminal: true }).select('code').lean()).map((s) => s.code);

    // "Urgent" used to mean "priority = URGENT" alone, but Priority is no
    // longer collected at intake - a request close to breaching its SLA is
    // just as urgent as one someone manually flagged, so both count now.
    const urgentThreshold = dayjs().add(2, 'day').toDate();

    const [byStatus, total, todayRequests, weekRequests, overdue, urgent] = await Promise.all([
      RequestModel.aggregate([{ $match: base }, { $group: { _id: '$statusCode', n: { $sum: 1 } } }]),
      RequestModel.countDocuments(base),
      RequestModel.countDocuments({ ...base, createdAt: { $gte: startOfToday } }),
      RequestModel.countDocuments({ ...base, createdAt: { $gte: startOfWeek } }),
      RequestModel.countDocuments({ ...base, dueDate: { $lt: new Date() }, statusCode: { $nin: terminal } }),
      RequestModel.aggregate([
        { $match: base },
        { $lookup: { from: 'priorities', localField: 'priorityId', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { 'p.code': 'URGENT' },
              { dueDate: { $ne: null, $lte: urgentThreshold }, statusCode: { $nin: terminal } },
            ],
          },
        },
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
      weekRequests,
      followUp: sum(['AWAITING_INFO', 'DEPT_RESPONSE']),
      closed: sum(['CLOSED']),
    });
  }),
);

router.get(
  '/charts',
  asyncHandler(async (req, res) => {
    const base = scope(req.auth!, req.query as Record<string, unknown>);
    const dayBucket = req.query.bucket === 'day';

    const [byDepartment, byStatus, monthly, byWard, byGp, otherCount, locatedCount] = await Promise.all([
      RequestModel.aggregate([
        { $match: base },
        { $group: { _id: '$primaryDepartmentId', n: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'd' } },
        { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
        { $project: { id: '$_id', label: { $ifNull: ['$d.name', 'Unassigned'] }, n: 1 } },
        { $sort: { n: -1 } },
      ]),
      RequestModel.aggregate([{ $match: base }, { $group: { _id: '$statusCode', n: { $sum: 1 } } }]),
      dayBucket
        ? RequestModel.aggregate([
          { $match: base },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $limit: 31 },
        ])
        : RequestModel.aggregate([
          { $match: base },
          { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
          { $sort: { '_id.y': 1, '_id.m': 1 } },
          { $limit: 24 },
        ]),
      RequestModel.aggregate([
        { $match: { ...base, 'location.wardId': { $ne: null } } },
        { $group: { _id: '$location.wardId', n: { $sum: 1 } } },
        { $lookup: { from: 'wards', localField: '_id', foreignField: '_id', as: 'w' } },
        { $unwind: '$w' },
        { $project: { id: '$_id', label: '$w.name', n: 1, kind: { $literal: 'ward' } } },
      ]),
      RequestModel.aggregate([
        { $match: { ...base, 'location.gramPanchayatId': { $ne: null } } },
        { $group: { _id: '$location.gramPanchayatId', n: { $sum: 1 } } },
        { $lookup: { from: 'grampanchayats', localField: '_id', foreignField: '_id', as: 'g' } },
        { $unwind: '$g' },
        { $project: { id: '$_id', n: 1, kind: { $literal: 'gp' }, name: '$g.name', order: { $ifNull: ['$g.order', 0] } } },
      ]),
      RequestModel.countDocuments({ ...base, 'location.locationType': 'OTHER' }),
      RequestModel.countDocuments({
        ...base,
        $or: [
          { 'location.wardId': { $ne: null } },
          { 'location.gramPanchayatId': { $ne: null } },
          { 'location.locationType': 'OTHER' },
        ],
      }),
    ]);

    const inScope = await RequestModel.countDocuments(base);
    const byLocation = [
      ...byWard.map((r) => ({ label: r.label, value: r.n, kind: 'ward' as const, id: String(r.id) })),
      ...byGp.map((r) => ({
        label: r.order > 0 ? `${toRoman(r.order)} - ${r.name}` : r.name,
        value: r.n, kind: 'gp' as const, id: String(r.id),
      })),
      ...(otherCount > 0 ? [{ label: 'Other (outside constituency)', value: otherCount, kind: 'other' as const, id: null }] : []),
    ].sort((a, b) => b.value - a.value).slice(0, 15);
    // Only non-zero for records that genuinely never got a ward/GP/Other
    // branch recorded - new intake always sets one of these (Phase A).
    const notSpecified = Math.max(0, inScope - locatedCount);

    ok(res, {
      byDepartment: byDepartment.map((r) => ({ id: r.id ? String(r.id) : null, label: r.label, value: r.n })),
      byStatus: byStatus.map((r) => ({ label: r._id, value: r.n })),
      monthly: dayBucket
        ? monthly.map((r) => ({ label: r._id, value: r.n }))
        : monthly.map((r) => ({ label: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, value: r.n })),
      byLocation,
      notSpecified,
    });
  }),
);

router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const filter = scope(req.auth!, req.query as Record<string, unknown>);
    if (req.query.statusCode) {
      const codes = String(req.query.statusCode).split(',').map((s) => s.trim()).filter(Boolean);
      filter.statusCode = codes.length > 1 ? { $in: codes } : codes[0];
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const rows = await RequestModel.find(filter)
      .sort('-createdAt')
      .limit(limit)
      .populate(LOCATION_POPULATE)
      .lean();
    ok(res, withId(rows));
  }),
);

/**
 * GET /api/dashboard/geo - request counts per ward, for the constituency map.
 * Returns one row per ward that has a boundary + any request, keyed by
 * wardNumber so the client can join it to the GeoJSON features.
 */
router.get(
  '/geo',
  asyncHandler(async (req, res) => {
    const wards = await Ward.find().select('name number').lean();
    const now = new Date();

    const agg = await RequestModel.aggregate([
      { $match: { ...scope(req.auth!), 'location.wardId': { $ne: null } } },
      {
        $group: {
          _id: '$location.wardId',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $in: ['$statusCode', PENDING_CODES] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [{ $and: [{ $lt: ['$dueDate', now] }, { $in: ['$statusCode', PENDING_CODES] }] }, 1, 0],
            },
          },
        },
      },
    ]);
    const counts = new Map(agg.map((a) => [String(a._id), a]));

    const rows = wards.map((w) => {
      const c = counts.get(String(w._id));
      return {
        wardId: String(w._id),
        wardNumber: Number(w.number) || null,
        wardName: w.name,
        total: c?.total ?? 0,
        pending: c?.pending ?? 0,
        overdue: c?.overdue ?? 0,
      };
    });
    ok(res, rows);
  }),
);

export default router;
