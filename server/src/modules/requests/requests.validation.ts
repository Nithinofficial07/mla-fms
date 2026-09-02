import { z } from 'zod';

const objectId = z.string().length(24, 'Invalid id');
const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const applicantSchema = z.object({
  name: z.string().min(2),
  mobile,
  altMobile: mobile.optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
});

export const locationSchema = z
  .object({
    areaTypeId: objectId.optional(),
    wardId: objectId.nullable().optional(),
    gramPanchayatId: objectId.nullable().optional(),
    villageId: objectId.nullable().optional(),
    subVillageId: objectId.nullable().optional(),
  })
  .refine((l) => l.wardId || l.gramPanchayatId, {
    message: 'Select a Ward or a Gram Panchayat',
    path: ['wardId'],
  });

export const createRequestSchema = z.object({
  subject: z.string().min(3),
  description: z.string().optional(),
  requestType: z.string().optional(),
  categoryId: objectId.optional(),
  priorityId: objectId,
  applicant: applicantSchema,
  location: locationSchema,
  primaryDepartmentId: objectId.nullable().optional(),
  secondaryDepartmentId: objectId.nullable().optional(),
  assignedOfficerId: objectId.nullable().optional(),
  slaDays: z.number().int().min(0).max(365).optional(),
  submit: z.boolean().optional(), // true => go straight to SUBMITTED
});

export const updateRequestSchema = createRequestSchema.partial().omit({ submit: true });

export const assignSchema = z.object({
  departmentId: objectId,
  officerId: objectId.nullable().optional(),
  priorityId: objectId.optional(),
  dueDate: z.coerce.date().optional(),
  remark: z.string().optional(),
});

export const forwardSchema = assignSchema;

export const statusChangeSchema = z.object({
  toStatusCode: z.string().min(2),
  remark: z.string().optional(),
});

export const duplicateCheckSchema = z.object({
  applicantName: z.string().optional(),
  mobile: z.string().optional(),
  subject: z.string().optional(),
  wardId: objectId.optional(),
  gramPanchayatId: objectId.optional(),
  villageId: objectId.optional(),
});
