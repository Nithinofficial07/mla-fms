import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { Department } from '../../models/Department.js';
import { RequestModel } from '../../models/Request.js';
import { Letter } from '../../models/Letter.js';
import { User } from '../../models/User.js';
import { crudRouter } from '../../utils/crudFactory.js';
import { AppError } from '../../utils/AppError.js';

const base = {
  name: z.string().min(2),
  code: z.string().min(1).max(20),
  description: z.string().optional(),
  headName: z.string().optional(),
  officerName: z.string().optional(),
  officerDesignation: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  officeAddress: z.string().optional(),
  logoKey: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
};

export default crudRouter({
  model: Department,
  entity: 'Department',
  createSchema: z.object(base),
  updateSchema: z.object(base).partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.DEPARTMENT_MANAGE },
  searchFields: ['name', 'code', 'headName', 'officerName'],
  async beforeDelete(id) {
    // Do not allow removal while requests or officers still reference it.
    const [reqCount, userCount, letterCount] = await Promise.all([
      RequestModel.countDocuments({
        $or: [{ primaryDepartmentId: id }, { secondaryDepartmentId: id }],
      }),
      User.countDocuments({ departmentId: id }),
      Letter.countDocuments({ departmentId: id }),
    ]);
    if (reqCount || userCount || letterCount) {
      throw AppError.conflict(
        `Department is in use (${reqCount} request(s), ${letterCount} letter(s), ${userCount} user(s)). Deactivate it instead.`,
      );
    }
  },
});
