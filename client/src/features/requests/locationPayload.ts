import { OTHER_LOCATION, type LocationValue } from './CascadingLocationPicker';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Renders a Gram Panchayat's display order (1-8) as a Roman numeral. Falls back to the number itself above X, or '' for 0/unset. */
export function toRoman(order: number): string {
  if (order <= 0) return '';
  return ROMAN[order] ?? String(order);
}

/** True once enough of the location step is filled in to move on / submit. */
export function isLocationComplete(l: LocationValue): boolean {
  if (l.branch === 'OTHER') return !!l.otherLocationPlace?.trim();
  if (l.branch === 'URBAN') {
    return l.wardId === OTHER_LOCATION ? !!l.otherPlaceName?.trim() : !!l.wardId;
  }
  return l.gramPanchayatId === OTHER_LOCATION ? !!l.otherPlaceName?.trim() : !!l.gramPanchayatId;
}

const breakup = (l: LocationValue) => ({
  houseNumber: l.houseNumber?.trim() || undefined,
  roadName: l.roadName?.trim() || undefined,
  roadType: l.roadType || undefined,
  pincode: l.pincode?.trim() || undefined,
  additionalLocationDetails: l.additionalLocationDetails?.trim() || undefined,
});

/** Builds the `location` object the API expects, stripping the "Other" sentinel. */
export function buildLocationPayload(l: LocationValue) {
  if (l.branch === 'OTHER') {
    return {
      locationType: 'OTHER' as const,
      otherLocationPlace: l.otherLocationPlace?.trim(),
      otherLocationCity: l.otherLocationCity?.trim() || undefined,
      otherLocationDistrict: l.otherLocationDistrict?.trim() || undefined,
      otherLocationState: l.otherLocationState?.trim() || undefined,
      additionalLocationDetails: l.additionalLocationDetails?.trim() || undefined,
      otherLocationReason: l.otherLocationReason?.trim() || undefined,
    };
  }
  if (l.branch === 'URBAN') {
    return l.wardId === OTHER_LOCATION
      ? { locationType: 'URBAN' as const, otherPlaceName: l.otherPlaceName?.trim(), addressText: l.addressText?.trim() || undefined, ...breakup(l) }
      : { locationType: 'URBAN' as const, wardId: l.wardId, villageId: l.villageId || undefined, addressText: l.addressText?.trim() || undefined, ...breakup(l) };
  }
  return l.gramPanchayatId === OTHER_LOCATION
    ? { locationType: 'RURAL' as const, otherPlaceName: l.otherPlaceName?.trim(), addressText: l.addressText?.trim() || undefined, ...breakup(l) }
    : { locationType: 'RURAL' as const, gramPanchayatId: l.gramPanchayatId, villageId: l.villageId || undefined, subVillageId: l.subVillageId || undefined, addressText: l.addressText?.trim() || undefined, ...breakup(l) };
}

/** Short human summary for a review screen. */
export function locationSummary(
  l: LocationValue,
  wardName?: string,
  gpName?: string,
  gpOrder?: number,
): string {
  if (l.branch === 'OTHER') {
    return [l.otherLocationPlace?.trim(), l.otherLocationCity?.trim()].filter(Boolean).join(', ') || 'Other location';
  }
  if (l.branch === 'URBAN') {
    const label = l.wardId === OTHER_LOCATION ? l.otherPlaceName?.trim() : wardName;
    return [label ? `Ward: ${label}` : 'Ward', l.addressText?.trim()].filter(Boolean).join(' — ') || 'Urban';
  }
  const label = l.gramPanchayatId === OTHER_LOCATION ? l.otherPlaceName?.trim() : gpName;
  const roman = l.gramPanchayatId === OTHER_LOCATION || !gpOrder ? '' : `${toRoman(gpOrder)} – `;
  return label ? `GP: ${roman}${label}` : 'Rural';
}
