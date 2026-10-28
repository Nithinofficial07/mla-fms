/** Agencies that can implement a sanctioned work. Kept as one constant so adding another later is a one-line change. */
export const IMPLEMENTING_AGENCIES = ['KRIDL', 'PRD', 'Nirmithi Kendra', 'PWD', 'Corporation', 'Other'] as const;
export type ImplementingAgency = (typeof IMPLEMENTING_AGENCIES)[number];

export const THIRD_PARTY_INSPECTION_STATUSES = ['Completed', 'Not Completed'] as const;
export type ThirdPartyInspectionStatus = (typeof THIRD_PARTY_INSPECTION_STATUSES)[number];

export const ROAD_CATEGORIES = ['SH', 'MDR'] as const;

/** documentType values for a work's attachments (stored via the shared Document model). */
export const WORK_DOC_TYPES = {
  ESTIMATION: 'Estimation Copy',
  BEFORE_PHOTO: 'Before Work Photo',
  AFTER_PHOTO: 'After Work Photo',
} as const;

/** Max photos per stage (before / after). */
export const WORK_PHOTO_LIMIT = 4;
export type RoadCategory = (typeof ROAD_CATEGORIES)[number];

/**
 * Indian financial years ("YYYY-YY") from `startYear` through the current
 * FY + 1, so the dropdown grows on its own every April without a code
 * change. The FY starts in April - a date in Jan-Mar belongs to the FY that
 * started the previous calendar year.
 */
export function financialYears(startYear = 2023, now: Date = new Date()): string[] {
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let y = startYear; y <= currentFyStart + 1; y++) {
    years.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`);
  }
  return years;
}
