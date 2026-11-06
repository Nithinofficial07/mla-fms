import { Router } from 'express';
import { PERMISSIONS, expandOccurrences } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { withId } from '../../utils/queryFeatures.js';
import { CalendarEvent } from '../../models/CalendarEvent.js';
import { RequestModel } from '../../models/Request.js';
import { RequestStatus } from '../../models/config.js';
import { requestsService } from '../requests/requests.service.js';
import { createEventSchema, rangeQuerySchema, updateEventSchema } from './calendar.validation.js';

const router = Router();
router.use(authenticate);

const MAX_RANGE_DAYS = 120;
const POPULATE = ['wardId', 'gramPanchayatId', 'createdBy'];

function scopeFilter(auth: Express.AuthContext): Record<string, unknown> {
  return auth.viewAllPrincipals ? {} : { principalId: { $in: auth.principalIds } };
}

async function loadScoped(id: string, auth: Express.AuthContext) {
  const doc = await CalendarEvent.findOne({ _id: id, ...scopeFilter(auth) });
  if (!doc) throw AppError.notFound('Event not found');
  return doc;
}

/**
 * Every occurrence overlapping [from, to): recurring events are expanded,
 * and (optionally) open requests whose due date falls in range are added as
 * read-only "deadline" entries.
 */
router.get(
  '/events',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ query: rangeQuerySchema }),
  asyncHandler(async (req, res) => {
    const { from, to, types, includeDeadlines } = req.query as unknown as {
      from: Date; to: Date; types?: string; includeDeadlines?: string;
    };
    if (to.getTime() <= from.getTime()) throw AppError.badRequest('"to" must be after "from"');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw AppError.badRequest(`Range can be at most ${MAX_RANGE_DAYS} days`);
    }
    const auth = req.auth!;

    const filter: Record<string, unknown> = {
      ...scopeFilter(auth),
      start: { $lt: to },
      $or: [
        { recurrence: { $in: [null, 'NONE'] }, end: { $gte: from } },
        { recurrence: { $nin: [null, 'NONE'] }, $or: [{ recurrenceUntil: null }, { recurrenceUntil: { $gte: new Date(from.getTime() - 86_400_000) } }] },
      ],
    };
    const typeList = types?.split(',').map((t) => t.trim()).filter(Boolean);
    if (typeList?.length) filter.type = { $in: typeList };

    const events = await CalendarEvent.find(filter).populate(['wardId', 'gramPanchayatId']).sort('start').lean();

    const items: Record<string, unknown>[] = [];
    for (const ev of events) {
      const base = withId(ev) as Record<string, any>;
      const duration = new Date(ev.end).getTime() - new Date(ev.start).getTime();
      const recurring = !!ev.recurrence && ev.recurrence !== 'NONE';
      for (const occStart of expandOccurrences(ev, from, to)) {
        items.push({
          ...base,
          kind: 'event',
          eventId: base.id,
          id: recurring ? `${base.id}:${occStart.toISOString()}` : base.id,
          isRecurring: recurring,
          seriesStart: ev.start,
          seriesEnd: ev.end,
          start: occStart,
          end: new Date(occStart.getTime() + duration),
        });
      }
    }

    if (includeDeadlines === 'true' && (auth.roleCode === 'SUPER_ADMIN' || auth.permissions.includes(PERMISSIONS.REQUEST_VIEW))) {
      const terminal = (await RequestStatus.find({ isTerminal: true }, { code: 1 }).lean()).map((s) => s.code);
      const reqFilter = requestsService.buildListFilter({}, auth) as Record<string, unknown>;
      reqFilter.dueDate = { $gte: from, $lt: to };
      if (terminal.length) reqFilter.statusCode = { $nin: terminal };
      const due = await RequestModel.find(reqFilter)
        .select('fileId subject dueDate statusCode applicant.name')
        .sort('dueDate')
        .limit(500)
        .lean();
      for (const r of due as any[]) {
        items.push({
          kind: 'deadline',
          id: `deadline:${r._id}`,
          requestId: String(r._id),
          title: `${r.fileId} - ${r.subject}`,
          description: r.applicant?.name ? `Applicant: ${r.applicant.name}` : '',
          type: 'DEADLINE',
          status: r.statusCode,
          start: r.dueDate,
          end: r.dueDate,
          allDay: true,
        });
      }
    }

    items.sort((a, b) => new Date(a.start as Date).getTime() - new Date(b.start as Date).getTime());
    ok(res, items);
  }),
);

router.get(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  asyncHandler(async (req, res) => {
    const doc = await loadScoped(req.params.id, req.auth!);
    await doc.populate(POPULATE);
    ok(res, doc);
  }),
);

router.post(
  '/events',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: createEventSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    if (!auth.viewAllPrincipals && !auth.principalIds.includes(String(req.body.principalId))) {
      throw AppError.forbidden('You can only add events for your own office');
    }
    const doc = await CalendarEvent.create({ ...req.body, createdBy: auth.userId });
    recordAudit(req, { action: 'CREATE', entity: 'CalendarEvent', entityId: String(doc._id), after: { title: doc.title, start: doc.start } });
    await doc.populate(POPULATE);
    created(res, doc);
  }),
);

router.patch(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: updateEventSchema }),
  asyncHandler(async (req, res) => {
    const doc = await loadScoped(req.params.id, req.auth!);
    const before = doc.toJSON();
    doc.set({ ...req.body, updatedBy: req.auth!.userId });
    if (doc.end.getTime() < doc.start.getTime()) throw AppError.badRequest('End must be after start');
    await doc.save();
    recordAudit(req, { action: 'UPDATE', entity: 'CalendarEvent', entityId: req.params.id, before, after: doc.toJSON() });
    await doc.populate(POPULATE);
    ok(res, doc);
  }),
);

router.delete(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  asyncHandler(async (req, res) => {
    const doc = await loadScoped(req.params.id, req.auth!);
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'CalendarEvent', entityId: req.params.id });
    ok(res, { id: req.params.id });
  }),
);

export default router;
