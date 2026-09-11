import { MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useGramPanchayats, useSubVillages, useVillages, useWards } from '@/hooks/useOptions';

/** Sentinel for "not in the list" — never sent to the server as an id. */
export const OTHER_LOCATION = '__OTHER__';

export interface LocationValue {
  branch: 'RURAL' | 'URBAN';
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  subVillageId?: string;
  /** Free-text street / landmark address — used for the Urban (Ward) branch, and for "Other". */
  addressText?: string;
  /** Free-text ward / GP name when the master list doesn't have it ("Other" picked). */
  otherPlaceName?: string;
}

/**
 * Rural branch enforces the hierarchy GP -> Village -> Sub-village.
 * Urban branch is just Ward + a plain-text address (no village / sub-village).
 * Both dropdowns carry an "Other (not in list)" option that swaps the
 * dropdown for a free-text name instead.
 * Changing a parent clears its children.
 */
export function CascadingLocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
}) {
  const wards = useWards();
  const gps = useGramPanchayats();
  const isOtherGp = value.gramPanchayatId === OTHER_LOCATION;
  const villages = useVillages(
    value.branch === 'RURAL' && !isOtherGp ? { gramPanchayatId: value.gramPanchayatId } : {},
  );
  const subVillages = useSubVillages(!isOtherGp ? value.villageId : undefined);

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
      </ToggleButtonGroup>

      {value.branch === 'URBAN' ? (
        <>
          <TextField
            select
            label="Ward"
            value={value.wardId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              set(
                v === OTHER_LOCATION
                  ? { wardId: OTHER_LOCATION, otherPlaceName: value.otherPlaceName ?? '' }
                  : { wardId: v, otherPlaceName: undefined },
              );
            }}
          >
            {(wards.data ?? []).map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
            <MenuItem value={OTHER_LOCATION}>Other (not in list)</MenuItem>
          </TextField>

          {value.wardId === OTHER_LOCATION && (
            <TextField
              label="Ward / locality name"
              placeholder="Type the ward or locality name"
              value={value.otherPlaceName ?? ''}
              onChange={(e) => set({ otherPlaceName: e.target.value })}
            />
          )}

          <TextField
            label="Address / landmark"
            placeholder="House / street / area / landmark within the ward"
            value={value.addressText ?? ''}
            onChange={(e) => set({ addressText: e.target.value })}
            multiline
            minRows={2}
            disabled={!value.wardId}
          />
        </>
      ) : (
        <>
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
              <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
            ))}
            <MenuItem value={OTHER_LOCATION}>Other (not in list)</MenuItem>
          </TextField>

          {isOtherGp ? (
            <>
              <TextField
                label="Gram Panchayat / village name"
                placeholder="Type the Gram Panchayat or village name"
                value={value.otherPlaceName ?? ''}
                onChange={(e) => set({ otherPlaceName: e.target.value })}
              />
              <TextField
                label="Address / landmark (optional)"
                value={value.addressText ?? ''}
                onChange={(e) => set({ addressText: e.target.value })}
                multiline
                minRows={2}
              />
            </>
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
                  <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
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
        </>
      )}
    </Stack>
  );
}
