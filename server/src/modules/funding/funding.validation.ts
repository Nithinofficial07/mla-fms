import { z } from 'zod';
import { FUNDING_STATUSES } from '@mla/shared';

const objectId = z.string().length(24, 'Invalid id');

export const createFundingSchema = z.object({
  departmentId: objectId,
  subject: z.string().min(3),
  address: z.string().min(3),
  letterNo: z.string().optional(),
  pointPersonName: z.string().optional(),
  pointPersonNumber: z.string().optional(),
});

export const updateFundingSchema = z.object({
  letterNo: z.string().optional(),
  pointPersonName: z.string().optional(),
  pointPersonNumber: z.string().optional(),
});

export const fundingStatusSchema = z.object({
  status: z.enum(FUNDING_STATUSES),
  remark: z.string().optional(),
});

export const fundingRemarkSchema = z.object({
  body: z.string().min(1),
});
