import { MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useGramPanchayats, useSubVillages, useVillages, useWards } from '@/hooks/useOptions';

export interface LocationValue {
  branch: 'RURAL' | 'URBAN';
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  subVillageId?: string;
  /** Free-text street / landmark address — used for the Urban (Ward) branch. */
  addressText?: string;
}

/**
 * Rural branch enforces the hierarchy GP -> Village -> Sub-village.
 * Urban branch is just Ward + a plain-text address (no village / sub-village).
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
  const villages = useVillages(
    value.branch === 'URBAN' ? { wardId: value.wardId } : { gramPanchayatId: value.gramPanchayatId },
  );
  const subVillages = useSubVillages(value.villageId);

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
            onChange={(e) =>
              set({ wardId: e.target.value, villageId: undefined, subVillageId: undefined, gramPanchayatId: undefined })
            }
          >
            {(wards.data ?? []).map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </TextField>

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
            onChange={(e) =>
              set({ gramPanchayatId: e.target.value, wardId: undefined, addressText: undefined, villageId: undefined, subVillageId: undefined })
            }
          >
            {(gps.data ?? []).map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
            ))}
          </TextField>

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
    </Stack>
  );
}
