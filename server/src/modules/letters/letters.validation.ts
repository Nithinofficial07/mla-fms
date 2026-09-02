import { z } from 'zod';
import { LETTER_STATUSES } from '@mla/shared';

const objectId = z.string().length(24, 'Invalid id');
const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const location = z
  .object({
    wardId: objectId.nullable().optional(),
    gramPanchayatId: objectId.nullable().optional(),
    villageId: objectId.nullable().optional(),
    subVillageId: objectId.nullable().optional(),
  })
  .refine((l) => l.wardId || l.gramPanchayatId, {
    message: 'Select a Ward or a Gram Panchayat',
    path: ['wardId'],
  });

export const createLetterSchema = z.object({
  subject: z.string().min(3),
  description: z.string().optional(),
  applicant: z.object({
    name: z.string().min(2),
    mobile,
    altMobile: mobile.optional().or(z.literal('')),
    address: z.string().optional(),
  }),
  location,
  referredBy: z.string().optional(),
  departmentId: objectId.nullable().optional(),
  departmentLetterNo: z.string().optional(),
  date: z.coerce.date().optional(),
  issue: z.boolean().optional(), // true => created as ISSUED instead of DRAFT
});

export const updateLetterSchema = createLetterSchema.partial().omit({ issue: true });

export const letterStatusSchema = z.object({
  status: z.enum(LETTER_STATUSES),
});
