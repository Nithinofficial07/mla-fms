import { z } from 'zod';
import { IMPLEMENTING_AGENCIES, ROAD_CATEGORIES, THIRD_PARTY_INSPECTION_STATUSES } from '@mla/shared';

const objectId = z.string().length(24, 'Invalid id');
const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const workLocationSchema = z
  .object({
    locationType: z.enum(['CITY', 'GP', 'SH_MDR']),
    wardId: objectId.nullable().optional(),
    gramPanchayatId: objectId.nullable().optional(),
    villageId: objectId.nullable().optional(),
    subVillageId: objectId.nullable().optional(),
    roadCategory: z.enum(ROAD_CATEGORIES).nullable().optional(),
    roadName: z.string().max(200).optional(),
  })
  .refine((l) => {
    if (l.locationType === 'CITY') return !!l.wardId;
    if (l.locationType === 'GP') return !!l.gramPanchayatId;
    if (l.locationType === 'SH_MDR') return !!l.roadCategory && !!l.roadName?.trim();
    return false;
  }, {
    message: 'Complete the location details for the selected location type',
    path: ['locationType'],
  });

export const createWorkSchema = z
  .object({
    principalId: objectId,
    departmentId: objectId,
    implementingAgency: z.enum(IMPLEMENTING_AGENCIES),
    implementingAgencyOther: z.string().max(200).optional(),
    agencyInspectorName: z.string().trim().max(200).optional(),
    agencyInspectorContact: mobile.optional().or(z.literal('')),
    fundingSource: z.string().trim().min(1, 'Funding source is required'),
    fundingYear: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a financial year like 2025-26'),
    nameOfWork: z.string().trim().min(3, 'Name of work is required'),
    engineerName: z.string().trim().optional(),
    engineerContact: mobile.optional().or(z.literal('')),
    location: workLocationSchema,
    address: z.string().trim().max(1000).optional(),
    amountLakhs: z.coerce.number().positive('Amount must be greater than 0'),
    thirdPartyInspection: z.enum(THIRD_PARTY_INSPECTION_STATUSES).optional(),
    tpiOfficerName: z.string().trim().max(200).optional(),
    tpiOfficerContact: mobile.optional().or(z.literal('')),
  })
  .refine((w) => w.implementingAgency !== 'Other' || !!w.implementingAgencyOther?.trim(), {
    message: 'Enter the implementing agency name',
    path: ['implementingAgencyOther'],
  });

export const updateWorkSchema = z.object({
  departmentId: objectId.optional(),
  implementingAgency: z.enum(IMPLEMENTING_AGENCIES).optional(),
  implementingAgencyOther: z.string().max(200).optional(),
  agencyInspectorName: z.string().trim().max(200).optional(),
  agencyInspectorContact: mobile.optional().or(z.literal('')),
  fundingSource: z.string().trim().min(1).optional(),
  fundingYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  nameOfWork: z.string().trim().min(3).optional(),
  engineerName: z.string().trim().optional(),
  engineerContact: mobile.optional().or(z.literal('')),
  location: workLocationSchema.optional(),
  address: z.string().trim().max(1000).optional(),
  amountLakhs: z.coerce.number().positive().optional(),
  thirdPartyInspection: z.enum(THIRD_PARTY_INSPECTION_STATUSES).optional(),
  tpiOfficerName: z.string().trim().max(200).optional(),
  tpiOfficerContact: mobile.optional().or(z.literal('')),
});
