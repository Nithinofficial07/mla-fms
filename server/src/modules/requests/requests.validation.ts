import { z } from 'zod';

const objectId = z.string().length(24, 'Invalid id');
const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const applicantSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  mobile,
  accompanyingCount: z.number().int().min(0).optional().default(0),
  referencePersonName: z.string().trim().optional(),
  referencePersonMobile: mobile.optional().or(z.literal('')),
  // Legacy fields - kept for backward-compat updates, not collected by the
  // current intake form.
  name: z.string().optional(),
  altMobile: mobile.optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
});

export const locationSchema = z
  .object({
    locationType: z.enum(['RURAL', 'URBAN', 'OTHER']),
    areaTypeId: objectId.optional(),
    wardId: objectId.nullable().optional(),
    gramPanchayatId: objectId.nullable().optional(),
    villageId: objectId.nullable().optional(),
    subVillageId: objectId.nullable().optional(),
    addressText: z.string().max(500).optional(),
    otherPlaceName: z.string().max(200).optional(),
    // Shared Rural/Urban detail breakup.
    houseNumber: z.string().max(100).optional(),
    roadName: z.string().max(200).optional(),
    roadType: z.enum(['MAIN', 'CROSS', 'LOCALITY']).nullable().optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode').optional().or(z.literal('')),
    additionalLocationDetails: z.string().max(500).optional(),
    // "Other" branch - a place outside the ward/GP structure entirely.
    otherLocationPlace: z.string().max(200).optional(),
    otherLocationCity: z.string().max(100).optional(),
    otherLocationDistrict: z.string().max(100).optional(),
    otherLocationState: z.string().max(100).optional(),
    otherLocationReason: z.string().max(500).optional(),
  })
  .refine((l) => {
    if (l.locationType === 'RURAL') return !!(l.gramPanchayatId || l.otherPlaceName?.trim());
    if (l.locationType === 'URBAN') return !!(l.wardId || l.otherPlaceName?.trim());
    if (l.locationType === 'OTHER') return !!l.otherLocationPlace?.trim();
    return false;
  }, {
    message: 'Complete the location details for the selected location type',
    path: ['locationType'],
  });

export const createRequestSchema = z.object({
  principalId: objectId,
  subject: z.string().min(3),
  description: z.string().optional(),
  requestType: z.string().optional(),
  categoryId: objectId.optional(),
  // No longer collected at intake - staff may set it later via the Workflow
  // Actions tab.
  priorityId: objectId.optional(),
  applicant: applicantSchema,
  location: locationSchema,
  primaryDepartmentId: objectId.nullable().optional(),
  secondaryDepartmentId: objectId.nullable().optional(),
  assignedOfficerId: objectId.nullable().optional(),
  interventionInstructions: z.string().max(2000).optional(),
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
