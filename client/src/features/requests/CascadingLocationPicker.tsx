import { MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useGramPanchayats, useSubVillages, useVillages, useWards } from '@/hooks/useOptions';
import { toAlpha, toRoman } from './locationPayload';

/** Sentinel for "not in the list" — never sent to the server as an id. */
export const OTHER_LOCATION = '__OTHER__';

export type LocationBranch = 'RURAL' | 'URBAN' | 'OTHER';

export interface LocationValue {
  branch: LocationBranch;
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  subVillageId?: string;
  /** Free-text street / landmark address — used for the Urban (Ward) branch, and for "Other". */
  addressText?: string;
  /** Free-text ward / GP name when the master list doesn't have it ("Other" picked). */
  otherPlaceName?: string;
  // Shared Rural/Urban detail breakup.
  houseNumber?: string;
  roadName?: string;
  roadType?: 'MAIN' | 'CROSS' | 'LOCALITY' | '';
  pincode?: string;
  additionalLocationDetails?: string;
  // "Other" branch — a place outside the ward/GP structure entirely.
  otherLocationPlace?: string;
  otherLocationCity?: string;
  otherLocationDistrict?: string;
  otherLocationState?: string;
  otherLocationReason?: string;
}

/** The shared House No. / Road / Road Type / Pincode / Additional Details block, used by both Rural and Urban. */
function LocationBreakupFields({ value, onChange }: { value: LocationValue; onChange: (patch: Partial<LocationValue>) => void }) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField fullWidth label="House / Door No. (optional)" value={value.houseNumber ?? ''} onChange={(e) => onChange({ houseNumber: e.target.value })} />
        <TextField fullWidth label="Road Name (optional)" value={value.roadName ?? ''} onChange={(e) => onChange({ roadName: e.target.value })} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField fullWidth select label="Road Type (optional)" value={value.roadType ?? ''} onChange={(e) => onChange({ roadType: e.target.value as LocationValue['roadType'] })}>
          <MenuItem value="">—</MenuItem>
          <MenuItem value="MAIN">Main Road</MenuItem>
          <MenuItem value="CROSS">Cross Road</MenuItem>
          <MenuItem value="LOCALITY">Locality</MenuItem>
        </TextField>
        <TextField
          fullWidth
          label="Pincode (optional)"
          value={value.pincode ?? ''}
          onChange={(e) => onChange({ pincode: e.target.value })}
          error={!!value.pincode && !/^\d{6}$/.test(value.pincode)}
          helperText={value.pincode && !/^\d{6}$/.test(value.pincode) ? '6-digit pincode' : ' '}
        />
      </Stack>
      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Additional Location Details (optional)"
        value={value.additionalLocationDetails ?? ''}
        onChange={(e) => onChange({ additionalLocationDetails: e.target.value })}
      />
    </Stack>
  );
}

/**
 * Rural branch enforces the hierarchy GP -> Village -> Sub-village, GPs shown
 * as letters (A-H) and Villages as Roman numerals (I, II, III...) ahead of
 * their name - each ordered independently via its own `order` field.
 * Urban branch is Ward + Area/Locality (a Village under that Ward).
 * Other branch is a genuinely different place (e.g. a walk-in from outside
 * the constituency) — flat fields, no master-data dependency.
 * Rural & Urban both carry the same optional House/Road/Pincode breakup.
 * Changing a parent clears its children.
 */
export function CascadingLocationPicker({
  value,
  onChange,
  allowOther = true,
  showBreakup = true,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  /** Letters don't support the "Other" (outside constituency) branch yet — hide the toggle there. */
  allowOther?: boolean;
  /** Letters don't collect the House No./Road/Pincode breakup — hide it there. */
  showBreakup?: boolean;
}) {
  const wards = useWards();
  const gps = useGramPanchayats();
  const isOtherGp = value.gramPanchayatId === OTHER_LOCATION;
  const villages = useVillages(
    value.branch === 'RURAL' && !isOtherGp
      ? { gramPanchayatId: value.gramPanchayatId }
      : value.branch === 'URBAN' && value.wardId !== OTHER_LOCATION
        ? { wardId: value.wardId }
        : {},
  );
  const subVillages = useSubVillages(value.branch === 'RURAL' && !isOtherGp ? value.villageId : undefined);

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.branch}
        onChange={(_e, b) => b && onChange({ branch: b })}
      >
        <ToggleButton value="RURAL">Rural (Gram Panchayat)</ToggleButton>
        <ToggleButton value="URBAN">Urban (Ward)</ToggleButton>
        {allowOther && <ToggleButton value="OTHER">Other</ToggleButton>}
      </ToggleButtonGroup>

      {value.branch === 'OTHER' && (
        <Stack spacing={2}>
          <TextField fullWidth required label="Location / Place Name" value={value.otherLocationPlace ?? ''} onChange={(e) => set({ otherLocationPlace: e.target.value })} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth label="City / Town" value={value.otherLocationCity ?? ''} onChange={(e) => set({ otherLocationCity: e.target.value })} />
            <TextField fullWidth label="District" value={value.otherLocationDistrict ?? ''} onChange={(e) => set({ otherLocationDistrict: e.target.value })} />
            <TextField fullWidth label="State" value={value.otherLocationState ?? ''} onChange={(e) => set({ otherLocationState: e.target.value })} />
          </Stack>
          <TextField fullWidth multiline minRows={2} label="Detailed Location" value={value.additionalLocationDetails ?? ''} onChange={(e) => set({ additionalLocationDetails: e.target.value })} />
          <TextField fullWidth multiline minRows={2} label="Reason / Context" placeholder="e.g. visiting from Harihar for a one-off matter" value={value.otherLocationReason ?? ''} onChange={(e) => set({ otherLocationReason: e.target.value })} />
        </Stack>
      )}

      {value.branch === 'URBAN' && (
        <Stack spacing={2}>
          <TextField
            select
            label="Ward"
            value={value.wardId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              set(
                v === OTHER_LOCATION
                  ? { wardId: OTHER_LOCATION, otherPlaceName: value.otherPlaceName ?? '', villageId: undefined }
                  : { wardId: v, otherPlaceName: undefined, villageId: undefined },
              );
            }}
          >
            {(wards.data ?? []).map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
            <MenuItem value={OTHER_LOCATION}>Other (not in list)</MenuItem>
          </TextField>

          {value.wardId === OTHER_LOCATION ? (
            <TextField
              label="Ward / locality name"
              placeholder="Type the ward or locality name"
              value={value.otherPlaceName ?? ''}
              onChange={(e) => set({ otherPlaceName: e.target.value })}
            />
          ) : (
            <TextField
              select
              label="Area / Locality (optional)"
              value={value.villageId ?? ''}
              disabled={!value.wardId}
              onChange={(e) => set({ villageId: e.target.value })}
              helperText={villages.data && villages.data.length === 0 ? 'No localities configured for this ward yet' : ' '}
            >
              <MenuItem value="">—</MenuItem>
              {(villages.data ?? []).map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.order ? `${toRoman(v.order)} – ${v.name}` : v.name}</MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Address / landmark (optional)"
            placeholder="House / street / area / landmark within the ward"
            value={value.addressText ?? ''}
            onChange={(e) => set({ addressText: e.target.value })}
            multiline
            minRows={2}
            disabled={!value.wardId}
          />

          {showBreakup && <LocationBreakupFields value={value} onChange={set} />}
        </Stack>
      )}

      {value.branch === 'RURAL' && (
        <Stack spacing={2}>
          <TextField
            select
            label="Gram Panchayat"
            value={value.gramPanchayatId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              set(
                v === OTHER_LOCATION
                  ? { gramPanchayatId: OTHER_LOCATION, otherPlaceName: value.otherPlaceName ?? '', villageId: undefined, subVillageId: undefined }
                  : { gramPanchayatId: v, otherPlaceName: undefined, villageId: undefined, subVillageId: undefined },
              );
            }}
          >
            {(gps.data ?? []).map((g) => (
              <MenuItem key={g.id} value={g.id}>{`${toAlpha(g.order ?? 0)} – ${g.name}`}</MenuItem>
            ))}
            <MenuItem value={OTHER_LOCATION}>Other (not in list)</MenuItem>
          </TextField>

          {isOtherGp ? (
            <TextField
              label="Gram Panchayat / village name"
              placeholder="Type the Gram Panchayat or village name"
              value={value.otherPlaceName ?? ''}
              onChange={(e) => set({ otherPlaceName: e.target.value })}
            />
          ) : (
            <>
              <TextField
                select
                label="Village / Area"
                value={value.villageId ?? ''}
                disabled={!value.gramPanchayatId}
                onChange={(e) => set({ villageId: e.target.value, subVillageId: undefined })}
                helperText={villages.data && villages.data.length === 0 ? 'No villages configured for this parent yet' : ' '}
              >
                {(villages.data ?? []).map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.order ? `${toRoman(v.order)} – ${v.name}` : v.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Sub-village / Hamlet (optional)"
                value={value.subVillageId ?? ''}
                disabled={!value.villageId}
                onChange={(e) => set({ subVillageId: e.target.value })}
              >
                <MenuItem value="">—</MenuItem>
                {(subVillages.data ?? []).map((sv) => (
                  <MenuItem key={sv.id} value={sv.id}>{sv.name}</MenuItem>
                ))}
              </TextField>
            </>
          )}

          <TextField
            label="Address / landmark (optional)"
            value={value.addressText ?? ''}
            onChange={(e) => set({ addressText: e.target.value })}
            multiline
            minRows={2}
          />

          {showBreakup && <LocationBreakupFields value={value} onChange={set} />}
        </Stack>
      )}
    </Stack>
  );
}
