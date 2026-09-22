import { z } from 'zod';

const objectId = z.string().length(24, 'Invalid id');

export const createFundingSchema = z.object({
  departmentId: objectId,
  subject: z.string().min(3),
  address: z.string().min(3),
});
