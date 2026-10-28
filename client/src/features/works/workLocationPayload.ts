import type { WorkLocationValue } from './WorkLocationPicker';
import { toAlpha, toRoman } from '../requests/locationPayload';

/** True once enough of the location picker is filled in to submit. */
export function isWorkLocationComplete(l: WorkLocationValue): boolean {
  if (l.branch === 'CITY') return !!l.wardId;
  if (l.branch === 'GP') return !!l.gramPanchayatId;
  return !!l.roadCategory && !!l.roadName?.trim();
}

/** Builds the `location` object the API expects. */
export function buildWorkLocationPayload(l: WorkLocationValue) {
  if (l.branch === 'CITY') {
    return { locationType: 'CITY' as const, wardId: l.wardId, villageId: l.villageId || undefined };
  }
  if (l.branch === 'GP') {
    return {
      locationType: 'GP' as const,
      gramPanchayatId: l.gramPanchayatId,
      villageId: l.villageId || undefined,
      subVillageId: l.subVillageId || undefined,
    };
  }
  return { locationType: 'SH_MDR' as const, roadCategory: l.roadCategory || undefined, roadName: l.roadName?.trim() };
}

/** Short human summary for the review/detail views. */
export function workLocationSummary(l: WorkLocationValue, wardName?: string, gpName?: string, gpOrder?: number): string {
  if (l.branch === 'CITY') return wardName ? `Ward: ${wardName}` : 'Ward';
  if (l.branch === 'GP') {
    const alpha = gpOrder ? `${toAlpha(gpOrder)} – ` : '';
    return gpName ? `GP: ${alpha}${gpName}` : 'Rural';
  }
  return [l.roadCategory, l.roadName].filter(Boolean).join(' – ') || 'SH / MDR';
}

/** "GP: A – Name / Village" / "Ward: Name" / "SH – Road" for one row. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function workLocationLabel(l: any): string {
  if (!l) return '—';
  if (l.locationType === 'CITY') return [l.wardId?.name && `Ward ${l.wardId.name}`, l.villageId?.name].filter(Boolean).join(' / ') || 'City';
  if (l.locationType === 'GP') return [l.gramPanchayatId?.name, l.villageId?.name].filter(Boolean).join(' / ') || 'GP';
  return [l.roadCategory, l.roadName].filter(Boolean).join(' – ') || 'SH / MDR';
}

export { toRoman };
