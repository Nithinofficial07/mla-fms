import { formatId } from '@mla/shared';
import { Letter } from '../../models/Letter.js';
import { DocumentModel } from '../../models/Document.js';
import { Principal } from '../../models/Principal.js';
import { AppError } from '../../utils/AppError.js';
import { nextSequence, yearlyKey } from '../../utils/sequence.js';
import { escapeRegex, withId } from '../../utils/queryFeatures.js';

export const lettersService = {
  async create(body: Record<string, any>, actorId: string) {
    const principal = await Principal.findById(body.principalId).lean();
    if (!principal) throw AppError.badRequest('Unknown principal');
    const seq = await nextSequence(yearlyKey(`letterNo:${principal.code}`));
    const now = body.date ? new Date(body.date) : new Date();
    const doc = await Letter.create({
      principalId: principal._id,
      letterNo: formatId({ format: `${principal.idPrefix}-LTR/{SEQ:5}`, seq, date: now }),
      date: now,
      subject: body.subject,
      description: body.description ?? '',
      applicant: body.applicant,
      location: {
        wardId: body.location.wardId ?? null,
        gramPanchayatId: body.location.gramPanchayatId ?? null,
        villageId: body.location.villageId ?? null,
        subVillageId: body.location.subVillageId ?? null,
        addressText: body.location.addressText ?? null,
        otherPlaceName: body.location.otherPlaceName ?? null,
      },
      referredBy: body.referredBy,
      departmentId: body.departmentId ?? null,
      departmentLetterNo: body.departmentLetterNo,
      status: body.issue ? 'ISSUED' : 'DRAFT',
      createdBy: actorId,
    });
    return doc;
  },

  buildListFilter(query: Record<string, unknown>, auth: Express.AuthContext) {
    const filter: Record<string, unknown> = {};
    const q = (k: string) => (query[k] !== undefined && query[k] !== '' ? query[k] : undefined);
    if (q('search')) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [
        { letterNo: rx }, { subject: rx }, { referredBy: rx }, { departmentLetterNo: rx },
        { 'applicant.name': rx }, { 'applicant.mobile': rx },
      ];
    }
    if (q('status')) filter.status = query.status;
    if (q('departmentId')) filter.departmentId = query.departmentId;
    if (q('wardId')) filter['location.wardId'] = query.wardId;
    if (q('gramPanchayatId')) filter['location.gramPanchayatId'] = query.gramPanchayatId;
    if (q('from') || q('to')) {
      filter.date = {};
      if (q('from')) (filter.date as Record<string, unknown>).$gte = new Date(String(query.from));
      if (q('to')) (filter.date as Record<string, unknown>).$lte = new Date(String(query.to));
    }
    if (!auth.viewAllPrincipals) {
      filter.principalId = { $in: auth.principalIds };
    }
    return filter;
  },

  async getDetail(id: string, auth: Express.AuthContext) {
    const doc = await Letter.findById(id)
      .populate([
        'principalId', 'departmentId',
        'location.wardId', 'location.gramPanchayatId', 'location.villageId', 'location.subVillageId',
        'createdBy',
      ])
      .lean();
    if (!doc) throw AppError.notFound('Letter not found');
    if (
      !auth.viewAllPrincipals
      && !auth.principalIds.includes(String((doc as any).principalId?._id ?? (doc as any).principalId))
    ) {
      throw AppError.notFound('Letter not found');
    }
    return withId(doc);
  },

  async update(id: string, patch: Record<string, unknown>) {
    const doc = await Letter.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!doc) throw AppError.notFound('Letter not found');
    return doc;
  },

  async setStatus(id: string, status: string) {
    const doc = await Letter.findByIdAndUpdate(id, { status }, { new: true });
    if (!doc) throw AppError.notFound('Letter not found');
    return doc;
  },

  async remove(id: string) {
    const doc = await Letter.findById(id);
    if (!doc) throw AppError.notFound('Letter not found');
    doc.isActive = false;
    doc.deletedAt = new Date();
    await doc.save();
  },

  documentCount(id: string) {
    return DocumentModel.countDocuments({ letterId: id });
  },
};
