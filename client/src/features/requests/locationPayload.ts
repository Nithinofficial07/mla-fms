import { OTHER_LOCATION, type LocationValue } from './CascadingLocationPicker';

/** True once enough of the location step is filled in to move on / submit. */
export function isLocationComplete(l: LocationValue): boolean {
  if (l.branch === 'URBAN') {
    return l.wardId === OTHER_LOCATION ? !!l.otherPlaceName?.trim() : !!l.wardId;
  }
  return l.gramPanchayatId === OTHER_LOCATION ? !!l.otherPlaceName?.trim() : !!l.gramPanchayatId;
}

/** Builds the `location` object the API expects, stripping the "Other" sentinel. */
export function buildLocationPayload(l: LocationValue) {
  if (l.branch === 'URBAN') {
    return l.wardId === OTHER_LOCATION
      ? { otherPlaceName: l.otherPlaceName?.trim(), addressText: l.addressText?.trim() || undefined }
      : { wardId: l.wardId, addressText: l.addressText?.trim() || undefined };
  }
  return l.gramPanchayatId === OTHER_LOCATION
    ? { otherPlaceName: l.otherPlaceName?.trim(), addressText: l.addressText?.trim() || undefined }
    : { gramPanchayatId: l.gramPanchayatId, villageId: l.villageId || undefined, subVillageId: l.subVillageId || undefined };
}

/** Short human summary for a review screen. */
export function locationSummary(
  l: LocationValue,
  wardName?: string,
  gpName?: string,
): string {
  if (l.branch === 'URBAN') {
    const label = l.wardId === OTHER_LOCATION ? l.otherPlaceName?.trim() : wardName;
    return [label ? `Ward: ${label}` : 'Ward', l.addressText?.trim()].filter(Boolean).join(' — ') || 'Urban';
  }
  const label = l.gramPanchayatId === OTHER_LOCATION ? l.otherPlaceName?.trim() : gpName;
  return label ? `GP: ${label}` : 'Rural';
}
