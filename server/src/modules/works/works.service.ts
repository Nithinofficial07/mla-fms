import { Types } from 'mongoose';
import { formatId } from '@mla/shared';
import { Work } from '../../models/Work.js';
import { AppError } from '../../utils/AppError.js';
import { nextSequence } from '../../utils/sequence.js';
import { escapeRegex, withId } from '../../utils/queryFeatures.js';

export interface CreateWorkInput {
  body: Record<string, any>;
  actorId: string;
}

export const worksService = {
  async create({ body, actorId }: CreateWorkInput) {
    // Flat sequence, not year-scoped - the spec's own example (WRK-0001)
    // carries no year, unlike every other ID format in this app.
    const seq = await nextSequence('workId');
    const doc = await Work.create({
      principalId: body.principalId,
      workId: formatId({ format: 'WRK-{SEQ:4}', seq, date: new Date() }),
      departmentId: body.departmentId,
      implementingAgency: body.implementingAgency,
      implementingAgencyOther: body.implementingAgency === 'Other' ? body.implementingAgencyOther : undefined,
      agencyInspectorName: body.agencyInspectorName || undefined,
      agencyInspectorContact: body.agencyInspectorContact || undefined,
      fundingSource: body.fundingSource,
      fundingYear: body.fundingYear,
      nameOfWork: body.nameOfWork,
      engineerName: body.engineerName || undefined,
      engineerContact: body.engineerContact || undefined,
      location: body.location,
      address: body.address || undefined,
      remarks: body.remarks || undefined,
      amountLakhs: body.amountLakhs,
      thirdPartyInspection: body.thirdPartyInspection ?? 'Not Completed',
      tpiOfficerName: body.tpiOfficerName || undefined,
      tpiOfficerContact: body.tpiOfficerContact || undefined,
      createdBy: actorId,
    });
    return doc;
  },

  /** Builds a Mongo filter from list query params + principal scoping. */
  buildListFilter(query: Record<string, unknown>, auth: Express.AuthContext) {
    const filter: Record<string, unknown> = {};
    const q = (k: string) => (query[k] !== undefined && query[k] !== '' ? query[k] : undefined);

    if (q('search')) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [{ workId: rx }, { nameOfWork: rx }, { engineerName: rx }, { address: rx }];
    }
    if (q('fundingYear')) filter.fundingYear = query.fundingYear;
    if (q('departmentId')) filter.departmentId = query.departmentId;
    if (q('implementingAgency')) filter.implementingAgency = query.implementingAgency;
    if (q('thirdPartyInspection')) filter.thirdPartyInspection = query.thirdPartyInspection;
    if (q('wardId')) filter['location.wardId'] = query.wardId;
    if (q('gramPanchayatId')) filter['location.gramPanchayatId'] = query.gramPanchayatId;
    if (q('villageId')) filter['location.villageId'] = query.villageId;

    // Agency users only ever see their own agency's works, whatever they ask for.
    if (auth.implementingAgency !== null) filter.implementingAgency = auth.implementingAgency;

    // Principal scoping: viewAllPrincipals bypasses it, same fail-closed
    // rule as every other module.
    if (!auth.viewAllPrincipals) {
      filter.principalId = { $in: auth.principalIds };
    }
    return filter;
  },

  async getDetail(id: string, auth: Express.AuthContext) {
    const doc = await Work.findById(id)
      .populate(['departmentId', 'location.wardId', 'location.gramPanchayatId', 'location.villageId', 'location.subVillageId'])
      .lean();
    if (!doc) throw AppError.notFound('Work not found');
    const principalId = (doc as any).principalId;
    if (!auth.viewAllPrincipals && !auth.principalIds.includes(String(principalId))) {
      throw AppError.notFound('Work not found');
    }
    if (auth.implementingAgency !== null && (doc as any).implementingAgency !== auth.implementingAgency) {
      throw AppError.notFound('Work not found');
    }
    return withId(doc);
  },

  async summary(filter: Record<string, unknown>) {
    // Model.aggregate() does NOT cast $match values against the schema the
    // way .find() does - ObjectId-valued fields need casting by hand or a
    // plain string filter silently matches nothing.
    const OBJECT_ID_KEYS = ['departmentId', 'location.wardId', 'location.gramPanchayatId', 'location.villageId', 'principalId'];
    const cast = (v: unknown): unknown => {
      if (typeof v === 'string') return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : v;
      if (v && typeof v === 'object' && '$in' in (v as Record<string, unknown>)) {
        return { $in: ((v as { $in: unknown[] }).$in).map(cast) };
      }
      return v;
    };
    // aggregate() also skips the soft-delete query hook, so exclude deleted works by hand.
    const match: Record<string, unknown> = { ...filter, deletedAt: null };
    for (const key of OBJECT_ID_KEYS) {
      if (match[key] !== undefined) match[key] = cast(match[key]);
    }

    const rows = await Work.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, totalAmountLakhs: { $sum: '$amountLakhs' } } },
    ]);
    return { count: rows[0]?.count ?? 0, totalAmountLakhs: rows[0]?.totalAmountLakhs ?? 0 };
  },
};
