import { formatId } from '@mla/shared';
import { Letter } from '../../models/Letter.js';
import { DocumentModel } from '../../models/Document.js';
import { SystemSettings } from '../../models/config.js';
import { AppError } from '../../utils/AppError.js';
import { nextSequence, yearlyKey } from '../../utils/sequence.js';
import { escapeRegex, withId } from '../../utils/queryFeatures.js';

async function letterNoFormat(): Promise<string> {
  const cfg = await SystemSettings.findById('app').lean();
  return cfg?.letterNoFormat ?? 'MLA-LTR/{YYYY}/{SEQ:4}';
}

export const lettersService = {
  async create(body: Record<string, any>, actorId: string) {
    const seq = await nextSequence(yearlyKey('letterNo'));
    const now = body.date ? new Date(body.date) : new Date();
    const doc = await Letter.create({
      letterNo: formatId({ format: await letterNoFormat(), seq, date: now }),
      date: now,
      subject: body.subject,
      description: body.description ?? '',
      applicant: body.applicant,
      location: {
        wardId: body.location.wardId ?? null,
        gramPanchayatId: body.location.gramPanchayatId ?? null,
        villageId: body.location.villageId ?? null,
        subVillageId: body.location.subVillageId ?? null,
      },
      referredBy: body.referredBy,
      departmentId: body.departmentId ?? null,
      departmentLetterNo: body.departmentLetterNo,
      status: body.issue ? 'ISSUED' : 'DRAFT',
      createdBy: actorId,
    });
    return doc;
  },

  buildListFilter(query: Record<string, unknown>) {
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
    return filter;
  },

  async getDetail(id: string) {
    const doc = await Letter.findById(id)
      .populate([
        'departmentId',
        'location.wardId', 'location.gramPanchayatId', 'location.villageId', 'location.subVillageId',
        'createdBy',
      ])
      .lean();
    if (!doc) throw AppError.notFound('Letter not found');
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
