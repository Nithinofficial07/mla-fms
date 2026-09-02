import { MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useGramPanchayats, useSubVillages, useVillages, useWards } from '@/hooks/useOptions';

export interface LocationValue {
  branch: 'RURAL' | 'URBAN';
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  subVillageId?: string;
}

/**
 * Enforces the hierarchy: villages are fetched for the selected GP/Ward only,
 * sub-villages for the selected village only. Changing a parent clears children.
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
        <TextField
          select
          label="Ward"
          value={value.wardId ?? ''}
          onChange={(e) => set({ wardId: e.target.value, villageId: undefined, subVillageId: undefined })}
        >
          {(wards.data ?? []).map((w) => (
            <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          select
          label="Gram Panchayat"
          value={value.gramPanchayatId ?? ''}
          onChange={(e) => set({ gramPanchayatId: e.target.value, villageId: undefined, subVillageId: undefined })}
        >
          {(gps.data ?? []).map((g) => (
            <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
          ))}
        </TextField>
      )}

      <TextField
        select
        label="Village / Area"
        value={value.villageId ?? ''}
        disabled={!value.wardId && !value.gramPanchayatId}
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
    </Stack>
  );
}
