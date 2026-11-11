import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import {
  PERMISSIONS, CALENDAR_EVENT_TYPE_CODES, CALENDAR_REAL_CODES, CALENDAR_SS_FAMILY, calendarTypeMeta,
} from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { calendarUpload, icsUpload } from '../../middleware/upload.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { withId } from '../../utils/queryFeatures.js';
import { CalendarEvent, type CalendarEventDoc } from '../../models/CalendarEvent.js';
import { CalendarEventLog } from '../../models/CalendarEventLog.js';
import { CalendarPhoto } from '../../models/CalendarPhoto.js';
import { RequestModel } from '../../models/Request.js';
import { RequestStatus } from '../../models/config.js';
import { requestsService } from '../requests/requests.service.js';
import { toCsv, toXlsx } from '../reports/reports.service.js';
import { storage } from '../../storage/index.js';
import {
  myCalendarCodes, scopeFilter, loadScoped, resolveMembers, defaultPublicSchedule, logChange, findClashes,
  toApiShape, expandEventsInRange, importGoogleIcs,
} from './calendar.service.js';
import {
  createEventSchema, updateEventSchema, quickEventSchema, rangeQuerySchema, searchQuerySchema, rsvpSchema, attendanceSchema,
  prepUpdateSchema, replyUpdateSchema, socialUpdateSchema, moveEventSchema, awayRangeSchema, exportQuerySchema,
  importIcsBodySchema,
} from './calendar.validation.js';

const router = Router();
router.use(authenticate);

const MAX_RANGE_DAYS = 120;

/**
 * The office's calendar lookup/label data (types, enums, holidays, world
 * days, ~440 English->Kannada labels) - one JSON file is the source of
 * truth, read once and served to the client so neither side hand-maintains
 * a second copy. See server/src/assets/calendar-reference-data.json.
 */
const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
let referenceDataCache: unknown = null;
function loadReferenceData(): unknown {
  if (!referenceDataCache) {
    referenceDataCache = JSON.parse(readFileSync(path.join(ASSET_DIR, 'calendar-reference-data.json'), 'utf8'));
  }
  return referenceDataCache;
}

router.get('/reference', requirePermission(PERMISSIONS.CALENDAR_VIEW), (_req, res) => ok(res, loadReferenceData()));

/** Narrows a scope filter to only the calendars both the viewer can see AND asked to see (?members=). */
function resolveViewFilter(auth: Express.AuthContext, codes: string[], membersParam?: string): Record<string, unknown> {
  const requested = membersParam?.split(',').map((m) => m.trim()).filter(Boolean);
  if (!requested?.length) return scopeFilter(codes, auth.viewAllPrincipals);
  const allowed = auth.viewAllPrincipals ? requested : requested.filter((m) => codes.includes(m));
  return { members: { $in: allowed.length ? allowed : codes } };
}

function assertTouchesOwnScope(auth: Express.AuthContext, codes: string[], members: string[]) {
  if (auth.viewAllPrincipals) return;
  if (!members.some((m) => codes.includes(m))) {
    throw AppError.forbidden('You can only save events that include one of your own calendars');
  }
}

/** A short list of human-readable change lines for the log - just the fields staff actually care to see. */
function diffDetail(before: Record<string, any>, after: Record<string, any>): string[] {
  const out: string[] = [];
  for (const key of ['title', 'start', 'end', 'venue', 'status', 'type'] as const) {
    const a = before[key] instanceof Date ? before[key].toISOString() : before[key];
    const b = after[key] instanceof Date ? after[key].toISOString() : after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${key}: ${a ?? '-'} -> ${b ?? '-'}`);
  }
  return out;
}

const asObject = (doc: CalendarEventDoc & { _id: unknown }) => (doc as any).toObject({ flattenMaps: true });

/* --------------------------------------------------------------------- */
/* events                                                                 */
/* --------------------------------------------------------------------- */

router.get(
  '/events',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ query: rangeQuerySchema }),
  asyncHandler(async (req, res) => {
    const { from, to, types, members, includeDeadlines } = req.query as unknown as {
      from: Date; to: Date; types?: string; members?: string; includeDeadlines?: string;
    };
    if (to.getTime() <= from.getTime()) throw AppError.badRequest('"to" must be after "from"');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw AppError.badRequest(`Range can be at most ${MAX_RANGE_DAYS} days`);
    }
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const filter = resolveViewFilter(auth, codes, members);
    const typeList = types?.split(',').map((t) => t.trim()).filter(Boolean);
    if (typeList?.length) filter.type = { $in: typeList };

    const items = await expandEventsInRange(filter, from, to);

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

    items.sort((a, b) => new Date(a.start as any).getTime() - new Date(b.start as any).getTime());
    ok(res, items);
  }),
);

router.get(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  asyncHandler(async (req, res) => {
    const codes = await myCalendarCodes(req.auth!);
    const doc = await loadScoped(req.params.id, codes, req.auth!.viewAllPrincipals);
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.post(
  '/events',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: createEventSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const members = resolveMembers(req.body.members);
    assertTouchesOwnScope(auth, codes, members);

    const doc = await CalendarEvent.create({
      ...req.body,
      members,
      publicSchedule: req.body.publicSchedule ?? defaultPublicSchedule(req.body.type ?? 'MEETING_OFFICIAL'),
      createdBy: auth.userId,
    });
    await logChange(String(doc._id), doc.title, 'created', [], auth.userId, auth.name);
    recordAudit(req, { action: 'CREATE', entity: 'CalendarEvent', entityId: String(doc._id), after: { title: doc.title, start: doc.start } });
    created(res, toApiShape(asObject(doc)));
  }),
);

router.post(
  '/events/quick',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: quickEventSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const members = resolveMembers(req.body.members);
    assertTouchesOwnScope(auth, codes, members);

    const now = new Date();
    const start = req.body.start ?? now;
    const end = req.body.end ?? new Date(start.getTime() + 30 * 60_000);

    const doc = await CalendarEvent.create({
      ...req.body,
      members,
      start,
      end,
      draft: true,
      publicSchedule: defaultPublicSchedule(req.body.type ?? 'MEETING_OFFICIAL'),
      createdBy: auth.userId,
    });
    await logChange(String(doc._id), doc.title, 'quick', [], auth.userId, auth.name);
    recordAudit(req, { action: 'CREATE', entity: 'CalendarEvent', entityId: String(doc._id), message: 'quick event' });
    created(res, toApiShape(asObject(doc)));
  }),
);

router.patch(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: updateEventSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    const before = asObject(doc);

    const patch: Record<string, unknown> = { ...req.body, updatedBy: auth.userId };
    if (req.body.members) {
      const members = resolveMembers(req.body.members);
      assertTouchesOwnScope(auth, codes, members);
      patch.members = members;
    }
    doc.set(patch);
    if (doc.end.getTime() < doc.start.getTime()) throw AppError.badRequest('End must be after start');
    await doc.save();

    const after = asObject(doc);
    await logChange(String(doc._id), doc.title, 'edited', diffDetail(before, after), auth.userId, auth.name);
    recordAudit(req, { action: 'UPDATE', entity: 'CalendarEvent', entityId: req.params.id, before, after });
    ok(res, toApiShape(after));
  }),
);

router.patch(
  '/events/:id/move',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: moveEventSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    const prevStart = doc.start;
    doc.set({ start: req.body.start, end: req.body.end, updatedBy: auth.userId });
    await doc.save();
    await logChange(String(doc._id), doc.title, 'moved', [`${prevStart.toISOString()} -> ${doc.start.toISOString()}`], auth.userId, auth.name);
    recordAudit(req, { action: 'UPDATE', entity: 'CalendarEvent', entityId: req.params.id, message: 'moved' });
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.delete(
  '/events/:id',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    const title = doc.title;
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    await logChange(req.params.id, title, 'deleted', [], auth.userId, auth.name);
    recordAudit(req, { action: 'SOFT_DELETE', entity: 'CalendarEvent', entityId: req.params.id });
    ok(res, { id: req.params.id });
  }),
);

/* -------------------------- per-calendar decisions ------------------------ */

router.post(
  '/events/:id/rsvp',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: rsvpSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    if (!doc.members.includes(req.body.code)) throw AppError.badRequest('That calendar is not invited to this event');
    if (!auth.viewAllPrincipals && !codes.includes(req.body.code)) throw AppError.forbidden('Not your calendar to RSVP for');

    doc.rsvp.set(req.body.code, req.body.status);
    doc.updatedBy = auth.userId as any;
    await doc.save();
    await logChange(String(doc._id), doc.title, 'rsvp', [`${req.body.code}: ${req.body.status}`], auth.userId, auth.name);
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.post(
  '/events/:id/attendance',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: attendanceSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    if (!doc.members.includes(req.body.code)) throw AppError.badRequest('That calendar is not invited to this event');

    if (req.body.status === null) doc.attendance.delete(req.body.code);
    else {
      doc.attendance.set(req.body.code, {
        status: req.body.status, members: req.body.members ?? [], note: req.body.note ?? '',
        by: auth.userId, at: new Date(),
      } as any);
    }
    doc.updatedBy = auth.userId as any;
    await doc.save();
    await logChange(String(doc._id), doc.title, 'attendance', [`${req.body.code}: ${req.body.status ?? 'cleared'}`], auth.userId, auth.name);
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.patch(
  '/events/:id/prep',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: prepUpdateSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    doc.set({ ...req.body, updatedBy: auth.userId });
    await doc.save();
    await logChange(String(doc._id), doc.title, 'prep', [], auth.userId, auth.name);
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.patch(
  '/events/:id/reply',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: replyUpdateSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    doc.set({ reply: req.body.reply, updatedBy: auth.userId });
    await doc.save();
    await logChange(String(doc._id), doc.title, 'reply', [`reply: ${req.body.reply}`], auth.userId, auth.name);
    ok(res, toApiShape(asObject(doc)));
  }),
);

router.post(
  '/events/:id/social',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: socialUpdateSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const doc = await loadScoped(req.params.id, codes, auth.viewAllPrincipals);
    if (!doc.members.includes(req.body.code)) throw AppError.badRequest('That calendar is not invited to this event');

    if (req.body.status === null) doc.social.delete(req.body.code);
    else {
      doc.social.set(req.body.code, {
        status: req.body.status, platforms: req.body.platforms ?? [], caption: req.body.caption ?? '',
        by: auth.userId, at: new Date(),
      } as any);
    }
    doc.updatedBy = auth.userId as any;
    await doc.save();
    await logChange(String(doc._id), doc.title, 'social', [`${req.body.code}: ${req.body.status ?? 'cleared'}`], auth.userId, auth.name);
    ok(res, toApiShape(asObject(doc)));
  }),
);

/* -------------------------------- clashes --------------------------------- */

const clashBody = z.object({
  members: z.array(z.string()).min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  excludeId: z.string().length(24).optional(),
});
router.post(
  '/clashes',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ body: clashBody }),
  asyncHandler(async (req, res) => {
    const members = resolveMembers(req.body.members);
    const clashes = await findClashes(members, req.body.start, req.body.end, req.body.excludeId);
    ok(res, clashes);
  }),
);

/* ------------------------------- away / out ------------------------------- */

router.post(
  '/away',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ body: awayRangeSchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    assertTouchesOwnScope(auth, codes, req.body.members);

    const doc = await CalendarEvent.create({
      members: req.body.members,
      title: req.body.reason?.trim() || 'Out of station / Unavailable',
      type: 'UNAVAILABLE',
      start: req.body.start,
      end: req.body.end,
      allDay: true,
      publicSchedule: false,
      createdBy: auth.userId,
    });
    await logChange(String(doc._id), doc.title, 'created', ['Marked away / unavailable'], auth.userId, auth.name);
    recordAudit(req, { action: 'CREATE', entity: 'CalendarEvent', entityId: String(doc._id), message: 'away range' });
    created(res, toApiShape(asObject(doc)));
  }),
);

/* ------------------------------- work lists -------------------------------- */

router.get(
  '/worklists',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const filter = scopeFilter(codes, auth.viewAllPrincipals);
    const now = new Date();
    const soon = dayjs(now).add(21, 'day').toDate();
    const recentPast = dayjs(now).subtract(60, 'day').toDate();
    const postWindow = dayjs(now).subtract(45, 'day').toDate();

    const [upcoming, pastRecent] = await Promise.all([
      CalendarEvent.find({ ...filter, start: { $gte: now, $lte: soon }, status: { $ne: 'CANCELLED' } })
        .sort('start').limit(300).lean({ flattenMaps: true }),
      CalendarEvent.find({ ...filter, start: { $gte: recentPast, $lt: now }, status: { $ne: 'CANCELLED' } })
        .sort('-start').limit(300).lean({ flattenMaps: true }),
    ]);

    const myRsvp = (ev: any) => {
      const mine = (ev.members as string[]).find((m) => codes.includes(m));
      return mine ? (ev.rsvp?.[mine] ?? 'UNDECIDED') : null;
    };
    const socialDone = (ev: any) => Object.values(ev.social ?? {}).some((s: any) => s?.status === 'POSTED' || s?.status === 'SKIPPED');
    const going = (ev: any) => (ev.members as string[]).some((m) => ev.rsvp?.[m] === 'GOING');
    const marked = (ev: any) => Object.keys(ev.attendance ?? {}).length > 0;
    const attended = (ev: any) => Object.values(ev.attendance ?? {}).some((a: any) => a?.status === 'ATTENDED' || a?.status === 'REPRESENTATIVE');
    const real = (ev: any) => !ev.draft && ev.type !== 'UNAVAILABLE';

    const shape = (list: any[]) => list.slice(0, 50).map((ev) => toApiShape(ev));
    ok(res, {
      toDecide: shape(upcoming.filter((ev) => myRsvp(ev) === 'UNDECIDED')),
      // Past 60 days: someone was going but attendance isn't recorded yet.
      toCheck: shape(pastRecent.filter((ev) => real(ev) && ev.end < now && going(ev) && !marked(ev))),
      toPrepare: shape(upcoming.filter((ev) => (ev.prep ?? []).length > (ev.prepDone ?? []).length)),
      toFill: shape([...upcoming, ...pastRecent].filter((ev) => ev.draft || ev.dateUnknown)),
      // Past 45 days: attended (or a representative went), public, not posted or skipped yet.
      toPost: shape(pastRecent.filter((ev) => real(ev) && ev.start >= postWindow && ev.publicSchedule !== false && attended(ev) && !socialDone(ev))),
      organisersNotReplied: shape(upcoming.filter((ev) => ev.reply === 'PENDING')),
      comingUp: shape(upcoming),
    });
  }),
);

/* ------------------------------- suggestions ------------------------------ */

/** Past venues / areas / organisers / contacts, most-used first - feeds the editor's autocompletes. */
router.get(
  '/suggestions',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const since = dayjs().subtract(2, 'year').toDate();
    const docs = (await CalendarEvent.find({ ...scopeFilter(codes, auth.viewAllPrincipals), start: { $gte: since } })
      .select('venue area organizer organizerKind contactName contactPhone contact2Name contact2Phone')
      .sort('-start').limit(3000).lean()) as any[];
    const top = (vals: (string | undefined)[], n = 300) => {
      const m = new Map<string, number>();
      for (const v of vals) { const t = (v ?? '').trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
    };
    const contacts = new Map<string, { name: string; phone: string; n: number }>();
    for (const d of docs) {
      for (const [name, phone] of [[d.contactName, d.contactPhone], [d.contact2Name, d.contact2Phone]]) {
        const nm = (name ?? '').trim();
        if (!nm) continue;
        const ph = (phone ?? '').trim();
        const key = `${nm.toLowerCase()}|${ph}`;
        const c = contacts.get(key);
        if (c) c.n++; else contacts.set(key, { name: nm, phone: ph, n: 1 });
      }
    }
    const organizerKinds: Record<string, string> = {};
    for (const d of docs) if (d.organizer && d.organizerKind && !organizerKinds[d.organizer]) organizerKinds[d.organizer] = d.organizerKind;
    ok(res, {
      venues: top(docs.map((d) => d.venue)),
      areas: top(docs.map((d) => d.area)),
      organizers: top(docs.map((d) => d.organizer)),
      organizerKinds,
      contacts: [...contacts.values()].sort((a, b) => b.n - a.n).slice(0, 400).map(({ name, phone }) => ({ name, phone })),
    });
  }),
);

/* --------------------------------- search ---------------------------------- */

router.get(
  '/search',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const { q } = req.query as unknown as { q: string };
    const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fields = ['title', 'venue', 'area', 'organizer', 'contactName', 'contactPhone', 'contact2Name', 'contact2Phone', 'description', 'attendees'];
    // Every word must match somewhere; phone digits also match ignoring spaces.
    const and = words.map((w) => ({ $or: fields.map((f) => ({ [f]: { $regex: esc(w), $options: 'i' } })) }));
    const docs = (await CalendarEvent.find({ ...scopeFilter(codes, auth.viewAllPrincipals), $and: and })
      .sort('-start').limit(80).lean({ flattenMaps: true })) as any[];
    // Upcoming first (soonest), then past (most recent).
    const nowMs = Date.now();
    docs.sort((x, y) => {
      const dx = new Date(x.start).getTime() - nowMs;
      const dy = new Date(y.start).getTime() - nowMs;
      if ((dx >= 0) !== (dy >= 0)) return dx >= 0 ? -1 : 1;
      return dx >= 0 ? dx - dy : dy - dx;
    });
    ok(res, docs.slice(0, 50).map((ev) => {
      const base = toApiShape(ev);
      return {
        ...base, kind: 'event', eventId: base.id,
        isRecurring: !!ev.recurrence && ev.recurrence !== 'NONE', seriesStart: ev.start, seriesEnd: ev.end,
      };
    }));
  }),
);

/* --------------------------------- reports --------------------------------- */

const summaryQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM') });
router.get(
  '/reports/summary',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ query: summaryQuery }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const filter = scopeFilter(codes, auth.viewAllPrincipals);
    const { month } = req.query as unknown as { month: string };
    const from = dayjs(`${month}-01`).startOf('month').toDate();
    const to = dayjs(from).add(1, 'month').toDate();

    // Everything touching the month (an away block can start in the previous one).
    const all = (await CalendarEvent.find({ ...filter, start: { $lt: to }, end: { $gt: from }, draft: { $ne: true }, status: { $ne: 'CANCELLED' } })
      .lean({ flattenMaps: true })) as any[];
    const away = all.filter((ev) => ev.type === 'UNAVAILABLE');
    const events = all.filter((ev) => ev.type !== 'UNAVAILABLE' && new Date(ev.start) >= from);
    const now = new Date();

    const byType: Record<string, number> = {};
    const byTypeAttended: Record<string, number> = {};
    const areas: Record<string, number> = {};
    const replies: Record<string, number> = { PENDING: 0, CONFIRMED: 0, REGRET: 0 };
    let going = 0, notGoing = 0, attended = 0, notAttended = 0, posted = 0, toPost = 0, attendedEvents = 0;
    const visibleCodes = auth.viewAllPrincipals ? [...CALENDAR_REAL_CODES] : codes;
    const perMember = Object.fromEntries(visibleCodes.map((c) => [c, {
      invited: 0, going: 0, notGoing: 0, undecided: 0, attended: 0, representative: 0, notAttended: 0, unmarked: 0, awayDays: 0,
    }])) as Record<string, Record<string, number>>;

    for (const ev of events) {
      const someoneGoing = (ev.members as string[]).some((c) => ev.rsvp?.[c] === 'GOING');
      if (someoneGoing) {
        byType[ev.type] = (byType[ev.type] ?? 0) + 1;
        const area = String(ev.area ?? '').trim();
        if (area) areas[area] = (areas[area] ?? 0) + 1;
      }
      if (ev.reply && replies[ev.reply] !== undefined) replies[ev.reply]++;
      const wentAny = Object.values(ev.attendance ?? {}).some((a: any) => a?.status === 'ATTENDED' || a?.status === 'REPRESENTATIVE');
      if (wentAny) {
        attendedEvents++;
        byTypeAttended[ev.type] = (byTypeAttended[ev.type] ?? 0) + 1;
        const isPosted = Object.values(ev.social ?? {}).some((x: any) => x?.status === 'POSTED');
        if (isPosted) posted++; else if (ev.publicSchedule) toPost++;
      }
      for (const code of ev.members as string[]) {
        const r = ev.rsvp?.[code] ?? 'UNDECIDED';
        if (r === 'GOING') going++; else if (r === 'NOT_GOING') notGoing++;
        const a = ev.attendance?.[code]?.status;
        if (a === 'ATTENDED' || a === 'REPRESENTATIVE') attended++; else if (a === 'NOT_ATTENDED') notAttended++;
        const m = perMember[code];
        if (!m) continue;
        m.invited++;
        if (r === 'GOING') m.going++; else if (r === 'NOT_GOING') m.notGoing++; else m.undecided++;
        if (a === 'ATTENDED') m.attended++;
        else if (a === 'REPRESENTATIVE') m.representative++;
        else if (a === 'NOT_ATTENDED') m.notAttended++;
        else if (r === 'GOING' && new Date(ev.end) < now) m.unmarked++;
      }
    }
    for (const code of visibleCodes) {
      const days = new Set<string>();
      for (const ev of away.filter((e) => (e.members as string[]).includes(code))) {
        let d = dayjs(ev.start).startOf('day');
        for (let g = 0; g < 62 && d.isBefore(dayjs(ev.end)) && d.isBefore(to); g++, d = d.add(1, 'day')) {
          if (!d.isBefore(from)) days.add(d.format('YYYY-MM-DD'));
        }
      }
      perMember[code].awayDays = days.size;
    }
    const topAreas = Object.entries(areas).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([area, count]) => ({ area, count }));
    ok(res, {
      month, total: events.length, attendedEvents, byType, byTypeAttended, topAreas, replies,
      social: { posted, toPost }, perMember,
      rsvp: { going, notGoing }, attendance: { attended, notAttended },
    });
  }),
);

const changesQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  eventId: z.string().length(24).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
router.get(
  '/reports/changes',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  validate({ query: changesQuery }),
  asyncHandler(async (req, res) => {
    const { from, to, eventId, limit } = req.query as unknown as { from?: Date; to?: Date; eventId?: string; limit?: number };
    const filter: Record<string, unknown> = {};
    if (eventId) filter.eventId = eventId;
    if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const logs = await CalendarEventLog.find(filter).sort('-at').limit(limit ?? 200).lean();
    ok(res, withId(logs));
  }),
);

/* --------------------------------- export ---------------------------------- */

function icsEscape(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function icsDateUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
function icsDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function toIcs(items: any[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MLA FMS//Office Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const ev of items) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@mla-fms`);
    lines.push(`DTSTAMP:${icsDateUTC(new Date())}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(new Date(ev.start))}`);
      lines.push(`DTEND;VALUE=DATE:${icsDateOnly(new Date(new Date(ev.end).getTime() + 86_400_000))}`);
    } else {
      lines.push(`DTSTART:${icsDateUTC(new Date(ev.start))}`);
      lines.push(`DTEND:${icsDateUTC(new Date(ev.end))}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.venue) lines.push(`LOCATION:${icsEscape(ev.venue)}`);
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(String(ev.description).replace(/<[^>]+>/g, ' '))}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function toWhatsappText(items: any[]): string {
  const byDay = new Map<string, any[]>();
  for (const ev of items) {
    const key = dayjs(ev.start).format('DD MMM YYYY (ddd)');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(ev);
  }
  const out: string[] = [];
  for (const [day, list] of byDay) {
    out.push(`*${day}*`);
    for (const ev of list) {
      const time = ev.allDay ? 'All day' : dayjs(ev.start).format('h:mm A');
      out.push(`- ${time}  ${ev.title}${ev.venue ? ` (${ev.venue})` : ''}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

router.get(
  '/export',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ query: exportQuerySchema.extend({ format: z.enum(['ics', 'csv', 'xlsx', 'whatsapp']) }) }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const codes = await myCalendarCodes(auth);
    const { from, to, types, members, excludeNotGoing, format } = req.query as unknown as {
      from: Date; to: Date; types?: string; members?: string; excludeNotGoing?: string; format: 'ics' | 'csv' | 'xlsx' | 'whatsapp';
    };
    const filter = resolveViewFilter(auth, codes, members);
    const typeList = types?.split(',').map((t) => t.trim()).filter(Boolean);
    if (typeList?.length) filter.type = { $in: typeList };

    let items = await expandEventsInRange(filter, from, to);
    if (excludeNotGoing === 'true') {
      items = items.filter((ev: any) => !(ev.members as string[]).every((m) => ev.rsvp?.[m] === 'NOT_GOING'));
    }
    items.sort((a, b) => new Date(a.start as any).getTime() - new Date(b.start as any).getTime());

    recordAudit(req, { action: 'READ', entity: 'CalendarEvent', message: `export ${format} (${items.length} items)` });

    if (format === 'ics') {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      return res.send(toIcs(items as any[]));
    }
    if (format === 'whatsapp') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(toWhatsappText(items as any[]));
    }
    const columns = ['date', 'time', 'title', 'type', 'venue', 'calendars'];
    const rows = (items as any[]).map((ev) => ({
      date: dayjs(ev.start).format('DD-MM-YYYY'),
      time: ev.allDay ? 'All day' : `${dayjs(ev.start).format('HH:mm')}-${dayjs(ev.end).format('HH:mm')}`,
      title: ev.title,
      type: calendarTypeMeta(ev.type).label,
      venue: ev.venue ?? '',
      calendars: (ev.members ?? []).join(', '),
    }));
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.csv"');
      return res.send(toCsv(columns, rows));
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="calendar.xlsx"');
    return res.send(await toXlsx('Calendar', columns, rows));
  }),
);

/* ------------------------------ admin: backup ------------------------------ */

router.get(
  '/backup',
  requirePermission(PERMISSIONS.CALENDAR_ADMIN),
  asyncHandler(async (req, res) => {
    const [events, logs, photos] = await Promise.all([
      CalendarEvent.find({}).lean({ flattenMaps: true }),
      CalendarEventLog.find({}).sort('-at').lean(),
      CalendarPhoto.find({}).lean(),
    ]);
    recordAudit(req, { action: 'READ', entity: 'CalendarEvent', message: `full backup export (${events.length} events)` });
    res.setHeader('Content-Disposition', `attachment; filename="calendar-backup-${dayjs().format('YYYY-MM-DD')}.json"`);
    ok(res, { exportedAt: new Date().toISOString(), version: 1, events: withId(events), logs: withId(logs), photos: withId(photos) });
  }),
);

/**
 * Admin-only import of the OLD standalone calendar artifact's backup JSON.
 * That artifact's own id format isn't known to be a Mongo ObjectId, so
 * original ids are kept on `legacyId` (not `_id`) and upserted on it - safe
 * to run the same backup file twice. Best-effort field mapping: unrecognised
 * or missing fields fall back to sane defaults rather than failing the row.
 */
const importBody = z.object({ events: z.array(z.record(z.string(), z.any())).max(5000) });
router.post(
  '/import',
  requirePermission(PERMISSIONS.CALENDAR_ADMIN),
  validate({ body: importBody }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    let createdCount = 0, updatedCount = 0, skipped = 0;
    const errors: string[] = [];

    for (const raw of req.body.events as Record<string, any>[]) {
      try {
        const legacyId = raw.id != null ? String(raw.id) : null;
        if (!legacyId) { skipped++; continue; }
        const start = raw.start ? new Date(raw.start) : null;
        if (!start || Number.isNaN(start.getTime())) { skipped++; continue; }
        const end = raw.end ? new Date(raw.end) : start;

        const rawMembers: string[] = raw.members ?? raw.calendars ?? (raw.calendar ? [raw.calendar] : []);
        const members = resolveMembers(rawMembers.length ? rawMembers : ['MLA_S']);
        const meta = calendarTypeMeta(raw.type ?? '');
        const type = meta.code === 'UNKNOWN' ? 'MEETING_OFFICIAL' : meta.code;

        const fields = {
          legacyId, members, title: String(raw.title ?? 'Untitled'), description: raw.description ?? '',
          type, status: raw.status ?? 'SCHEDULED', start, end: end.getTime() >= start.getTime() ? end : start,
          allDay: !!raw.allDay, recurrence: raw.recurrence ?? 'NONE',
          recurrenceUntil: raw.recurrenceUntil ? new Date(raw.recurrenceUntil) : null,
          venue: raw.venue ?? '', area: raw.area ?? raw.ward ?? '', organizer: raw.organizer ?? '',
          organizerKind: raw.organizerKind ?? 'IND', contactName: raw.contactName ?? '', contactPhone: raw.contactPhone ?? '',
          attendees: Array.isArray(raw.attendees) ? raw.attendees.map(String) : [],
          role: raw.role ?? null,
          prep: Array.isArray(raw.prep) ? raw.prep : [], prepDone: Array.isArray(raw.prepDone) ? raw.prepDone : [],
          prepNote: raw.prepNote ?? '', reply: raw.reply ?? 'PENDING',
          publicSchedule: raw.publicSchedule ?? defaultPublicSchedule(type),
          writeup: raw.writeup ?? '', draft: !!raw.draft, dateUnknown: !!raw.dateUnknown,
          updatedBy: auth.userId,
        };

        const existing = await CalendarEvent.findOne({ legacyId });
        if (existing) {
          existing.set(fields);
          await existing.save();
          updatedCount++;
        } else {
          await CalendarEvent.create({ ...fields, createdBy: auth.userId });
          createdCount++;
        }
      } catch (err) {
        errors.push(`${raw.id ?? '?'}: ${(err as Error).message}`);
        skipped++;
      }
    }

    recordAudit(req, {
      action: 'CREATE', entity: 'CalendarEvent',
      message: `import backup: ${createdCount} created, ${updatedCount} updated, ${skipped} skipped`,
    });
    ok(res, { created: createdCount, updated: updatedCount, skipped, errors: errors.slice(0, 50) });
  }),
);

/**
 * Google Calendar import: Settings > Import & export > Export downloads a
 * .zip of .ics files, one per calendar - the user picks one and which of our
 * calendars to drop it onto. Open to anyone who can manage the calendar
 * (not admin-only like /import above): this is "bring in events I already
 * made", not a system-level backup restore.
 */
router.post(
  '/import-ics',
  requirePermission(PERMISSIONS.CALENDAR_MANAGE),
  icsUpload.single('file'),
  validate({ body: importIcsBodySchema }),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    if (!req.file) throw AppError.badRequest('Choose a .ics file to import');
    const codes = await myCalendarCodes(auth);
    const members = resolveMembers(req.body.members.split(',').map((m: string) => m.trim()).filter(Boolean));
    if (!auth.viewAllPrincipals && !members.some((m) => codes.includes(m))) {
      throw AppError.forbidden('You can only import onto one of your own calendars');
    }
    // Default: guess each event's type from its title (Google's export carries no colour / type).
    const type = req.body.type && (CALENDAR_EVENT_TYPE_CODES as readonly string[]).includes(req.body.type)
      ? req.body.type
      : 'AUTO';

    const result = await importGoogleIcs(req.file.buffer.toString('utf8'), members, type, auth.userId);
    recordAudit(req, {
      action: 'CREATE', entity: 'CalendarEvent',
      message: `import .ics: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    });
    ok(res, result);
  }),
);

/* ------------------------------ calendar photos ----------------------------- */

const photoCodeParam = z.object({ code: z.enum([...CALENDAR_REAL_CODES, CALENDAR_SS_FAMILY.code]) });

router.get(
  '/photos/:code',
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  validate({ params: photoCodeParam }),
  asyncHandler(async (req, res) => {
    const photo = await CalendarPhoto.findById(req.params.code).lean();
    if (!photo) return ok(res, { url: null });
    const url = await storage().getSignedUrl(photo.storageKey, {});
    ok(res, { url, updatedAt: (photo as any).updatedAt });
  }),
);

router.put(
  '/photos/:code',
  requirePermission(PERMISSIONS.CALENDAR_ADMIN),
  validate({ params: photoCodeParam }),
  calendarUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('File is required');
    if (!req.file.mimetype.startsWith('image/')) throw AppError.badRequest('Photo must be an image');
    const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
    const key = `calendar-photos/${req.params.code}-${Date.now()}.${ext}`;
    const stored = await storage().put({ key, body: req.file.buffer, contentType: req.file.mimetype });
    await CalendarPhoto.findByIdAndUpdate(
      req.params.code,
      { storageKey: stored.key, contentType: req.file.mimetype, updatedBy: req.auth!.userId },
      { upsert: true },
    );
    recordAudit(req, { action: 'UPDATE', entity: 'CalendarPhoto', entityId: req.params.code });
    ok(res, { ok: true });
  }),
);

export default router;
