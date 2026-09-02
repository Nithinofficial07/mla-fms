import dayjs from 'dayjs';
import { formatId } from '@mla/shared';
import { RequestModel } from '../../models/Request.js';
import { RequestStatus, Priority, SystemSettings } from '../../models/config.js';
import { Constituency } from '../../models/location.js';
import { AppError } from '../../utils/AppError.js';
import { nextSequence, yearlyKey } from '../../utils/sequence.js';
import { escapeRegex, withId } from '../../utils/queryFeatures.js';
import { addTimeline } from '../workflow/timeline.service.js';

async function settings() {
  return (await SystemSettings.findById('app').lean()) ?? (await SystemSettings.create({ _id: 'app' })).toJSON();
}

async function initialStatus() {
  const s = await RequestStatus.findOne({ isInitial: true, isActive: true }).lean();
  if (!s) throw AppError.badRequest('No initial workflow status configured. Run seed or configure statuses.');
  return s;
}

async function statusByCode(code: string) {
  const s = await RequestStatus.findOne({ code: code.toUpperCase(), isActive: true }).lean();
  if (!s) throw AppError.badRequest(`Unknown status: ${code}`);
  return s;
}

export interface CreateInput {
  body: Record<string, any>;
  actorId: string;
  actorName: string;
}

export const requestsService = {
  async create({ body, actorId, actorName }: CreateInput) {
    const cfg = await settings();
    const priority = await Priority.findById(body.priorityId).lean();
    if (!priority) throw AppError.badRequest('Unknown priority');

    const draft = await initialStatus();
    const submittedStatus = body.submit ? await statusByCode('SUBMITTED') : null;
    const status = submittedStatus ?? draft;

    const fileSeq = await nextSequence(yearlyKey('fileId'));
    const reqSeq = await nextSequence(yearlyKey('requestId'));
    const now = new Date();
    const slaDays = body.slaDays ?? priority.slaDays ?? cfg.defaultSlaDays ?? 15;
    const constituency = await Constituency.findOne({ isPrimary: true }).lean();

    const doc = await RequestModel.create({
      fileId: formatId({ format: cfg.fileIdFormat, seq: fileSeq, date: now }),
      requestId: formatId({ format: cfg.requestIdFormat, seq: reqSeq, date: now }),
      date: now,
      requestType: body.requestType,
      categoryId: body.categoryId,
      priorityId: priority._id,
      subject: body.subject,
      description: body.description ?? '',
      applicant: body.applicant,
      location: { ...body.location, constituencyId: constituency?._id ?? null },
      primaryDepartmentId: body.primaryDepartmentId ?? null,
      secondaryDepartmentId: body.secondaryDepartmentId ?? null,
      assignedOfficerId: body.assignedOfficerId ?? null,
      statusId: status._id,
      statusCode: status.code,
      slaDays,
      dueDate: body.submit ? dayjs(now).add(slaDays, 'day').toDate() : null,
      submittedAt: body.submit ? now : null,
      createdBy: actorId,
    });

    await addTimeline({
      requestId: String(doc._id),
      action: 'FILE_CREATED',
      label: `File ${doc.fileId} created`,
      actorId,
      actorName,
      toStatus: status.code,
    });
    if (body.submit) {
      await addTimeline({
        requestId: String(doc._id),
        action: 'REQUEST_SUBMIT',
        label: 'Request submitted',
        actorId,
        actorName,
        fromStatus: draft.code,
        toStatus: 'SUBMITTED',
      });
    }
    return doc;
  },

  /** Builds a Mongo filter from list query params + officer scoping. */
  buildListFilter(query: Record<string, unknown>, auth: Express.AuthContext) {
    const filter: Record<string, unknown> = {};
    const q = (k: string) => (query[k] !== undefined && query[k] !== '' ? query[k] : undefined);

    if (q('search')) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [
        { fileId: rx }, { requestId: rx }, { subject: rx },
        { 'applicant.name': rx }, { 'applicant.mobile': rx },
      ];
    }
    if (q('statusCode')) {
      const codes = String(query.statusCode).split(',').map((s) => s.trim()).filter(Boolean);
      filter.statusCode = codes.length > 1 ? { $in: codes } : codes[0];
    }
    if (q('priorityId')) filter.priorityId = query.priorityId;
    if (q('categoryId')) filter.categoryId = query.categoryId;
    if (q('departmentId')) {
      filter.$or = [
        ...(filter.$or as unknown[] ?? []),
        { primaryDepartmentId: query.departmentId },
        { secondaryDepartmentId: query.departmentId },
      ];
    }
    if (q('wardId')) filter['location.wardId'] = query.wardId;
    if (q('gramPanchayatId')) filter['location.gramPanchayatId'] = query.gramPanchayatId;
    if (q('villageId')) filter['location.villageId'] = query.villageId;
    if (q('assignedOfficerId')) filter.assignedOfficerId = query.assignedOfficerId;
    if (q('overdue') === 'true') filter.dueDate = { $lt: new Date() };
    if (q('from') || q('to')) {
      filter.createdAt = {};
      if (q('from')) (filter.createdAt as Record<string, unknown>).$gte = new Date(String(query.from));
      if (q('to')) (filter.createdAt as Record<string, unknown>).$lte = new Date(String(query.to));
    }

    // Department officers only ever see their own department's work.
    if (auth.roleCode === 'DEPARTMENT_OFFICER' && auth.departmentId) {
      filter.$and = [
        {
          $or: [
            { primaryDepartmentId: auth.departmentId },
            { secondaryDepartmentId: auth.departmentId },
            { assignedOfficerId: auth.userId },
          ],
        },
      ];
    }
    return filter;
  },

  async getDetail(id: string) {
    const doc = await RequestModel.findById(id)
      .populate([
        'priorityId', 'categoryId', 'statusId',
        'primaryDepartmentId', 'secondaryDepartmentId', 'assignedOfficerId',
        'location.wardId', 'location.gramPanchayatId', 'location.villageId', 'location.subVillageId',
      ])
      .lean();
    if (!doc) throw AppError.notFound('Request not found');
    return withId(doc);
  },

  async update(id: string, patch: Record<string, unknown>) {
    const doc = await RequestModel.findById(id);
    if (!doc) throw AppError.notFound('Request not found');
    if (doc.statusCode !== 'DRAFT') {
      throw AppError.conflict('Only draft requests can be edited. Add a remark instead.');
    }
    doc.set(patch);
    await doc.save();
    return doc;
  },

  async submit(id: string, actorId: string, actorName: string) {
    const doc = await RequestModel.findById(id);
    if (!doc) throw AppError.notFound('Request not found');
    if (doc.statusCode !== 'DRAFT') throw AppError.conflict('Request is already submitted');
    const submitted = await statusByCode('SUBMITTED');
    doc.statusId = submitted._id;
    doc.statusCode = submitted.code;
    doc.submittedAt = new Date();
    doc.dueDate = dayjs().add(doc.slaDays, 'day').toDate();
    await doc.save();
    await addTimeline({
      requestId: id, action: 'REQUEST_SUBMIT', label: 'Request submitted',
      actorId, actorName, fromStatus: 'DRAFT', toStatus: 'SUBMITTED',
    });
    return doc;
  },

  async changeStatus(id: string, toStatusCode: string, remark: string | undefined, actorId: string, actorName: string) {
    const doc = await RequestModel.findById(id);
    if (!doc) throw AppError.notFound('Request not found');
    const from = await statusByCode(doc.statusCode);
    const to = await statusByCode(toStatusCode);
    if (from.code !== to.code && from.transitionsTo?.length && !from.transitionsTo.includes(to.code)) {
      throw AppError.conflict(`Cannot move from ${from.name} to ${to.name}. Allowed: ${from.transitionsTo.join(', ') || 'none'}`);
    }
    doc.statusId = to._id;
    doc.statusCode = to.code;
    if (to.isTerminal) doc.closedAt = new Date();
    await doc.save();
    await addTimeline({
      requestId: id, action: 'STATUS_CHANGE',
      label: `Status changed: ${from.name} -> ${to.name}`,
      actorId, actorName, fromStatus: from.code, toStatus: to.code, remark: remark ?? null,
    });
    return doc;
  },

  async findDuplicates(input: Record<string, string | undefined>) {
    const or: Record<string, unknown>[] = [];
    if (input.mobile) or.push({ 'applicant.mobile': input.mobile });
    if (input.applicantName) or.push({ 'applicant.name': new RegExp(escapeRegex(input.applicantName), 'i') });
    if (input.subject) or.push({ $text: { $search: input.subject } });
    if (!or.length) return [];
    const loc: Record<string, unknown> = {};
    if (input.wardId) loc['location.wardId'] = input.wardId;
    if (input.gramPanchayatId) loc['location.gramPanchayatId'] = input.gramPanchayatId;
    if (input.villageId) loc['location.villageId'] = input.villageId;
    return RequestModel.find({ $or: or, ...loc })
      .sort('-createdAt')
      .limit(10)
      .select('fileId requestId subject applicant.name applicant.mobile statusCode createdAt')
      .lean();
  },
};
