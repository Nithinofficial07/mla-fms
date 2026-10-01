import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { Principal } from '../../models/Principal.js';
import { RequestModel } from '../../models/Request.js';
import { Letter } from '../../models/Letter.js';
import { FundingRequest } from '../../models/FundingRequest.js';
import { User } from '../../models/User.js';
import { crudRouter } from '../../utils/crudFactory.js';
import { AppError } from '../../utils/AppError.js';

const base = {
  code: z.enum(['MLA_S', 'MLA_N', 'MP']),
  label: z.string().min(2),
  idPrefix: z.string().min(1).max(10),
  isActive: z.boolean().optional(),
};

export default crudRouter({
  model: Principal,
  entity: 'Principal',
  createSchema: z.object(base),
  updateSchema: z.object(base).omit({ code: true }).partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.PRINCIPAL_MANAGE },
  searchFields: ['label', 'code', 'idPrefix'],
  async beforeDelete(id) {
    const [reqCount, letterCount, fundingCount, userCount] = await Promise.all([
      RequestModel.countDocuments({ principalId: id }),
      Letter.countDocuments({ principalId: id }),
      FundingRequest.countDocuments({ principalId: id }),
      User.countDocuments({ principalIds: id }),
    ]);
    if (reqCount || letterCount || fundingCount || userCount) {
      throw AppError.conflict(
        `Principal is in use (${reqCount} request(s), ${letterCount} letter(s), ${fundingCount} funding request(s), ${userCount} user(s)). Deactivate it instead.`,
      );
    }
  },
});
