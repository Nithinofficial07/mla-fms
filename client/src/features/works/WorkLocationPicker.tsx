import { Grid, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useGramPanchayats, useSubVillages, useVillages, useWards } from '@/hooks/useOptions';
import { toAlpha, toRoman } from '../requests/locationPayload';

export type WorkLocationBranch = 'CITY' | 'GP' | 'SH_MDR';

export interface WorkLocationValue {
  branch: WorkLocationBranch;
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  subVillageId?: string;
  roadCategory?: 'SH' | 'MDR' | '';
  roadName?: string;
}

/**
 * Works-only location toggle: City(Ward)/GP/SH-MDR. A sibling of
 * CascadingLocationPicker, not an extension of it - that component's third
 * branch ("Other") means "a place outside the constituency," which isn't
 * what SH/MDR (a road classification) means here. Reuses the same
 * useWards/useGramPanchayats/useVillages/useSubVillages hooks and the same
 * toAlpha/toRoman labeling and "changing a parent clears children" rule.
 */
export function WorkLocationPicker({ value, onChange }: { value: WorkLocationValue; onChange: (v: WorkLocationValue) => void }) {
  const wards = useWards();
  const gps = useGramPanchayats();
  const villages = useVillages(
    value.branch === 'CITY' ? { wardId: value.wardId } : value.branch === 'GP' ? { gramPanchayatId: value.gramPanchayatId } : {},
  );
  const subVillages = useSubVillages(value.branch === 'GP' ? value.villageId : undefined);

  const set = (patch: Partial<WorkLocationValue>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.branch}
        onChange={(_e, b) => b && onChange({ branch: b })}
      >
        <ToggleButton value="CITY">City (Urban)</ToggleButton>
        <ToggleButton value="GP">GP (Rural)</ToggleButton>
        <ToggleButton value="SH_MDR">SH / MDR</ToggleButton>
      </ToggleButtonGroup>

      {value.branch === 'CITY' && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth required select label="Ward" value={value.wardId ?? ''}
              onChange={(e) => set({ wardId: e.target.value, villageId: undefined })}
            >
              {(wards.data ?? []).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth select label="Area / Locality (optional)" value={value.villageId ?? ''}
              disabled={!value.wardId} onChange={(e) => set({ villageId: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              {(villages.data ?? []).map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.order ? `${toRoman(v.order)} – ${v.name}` : v.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      )}

      {value.branch === 'GP' && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth required select label="Gram Panchayat" value={value.gramPanchayatId ?? ''}
              onChange={(e) => set({ gramPanchayatId: e.target.value, villageId: undefined, subVillageId: undefined })}
            >
              {(gps.data ?? []).map((g) => (
                <MenuItem key={g.id} value={g.id}>{`${toAlpha(g.order ?? 0)} – ${g.name}`}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth select label="Village" value={value.villageId ?? ''}
              disabled={!value.gramPanchayatId} onChange={(e) => set({ villageId: e.target.value, subVillageId: undefined })}
            >
              <MenuItem value="">—</MenuItem>
              {(villages.data ?? []).map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.order ? `${toRoman(v.order)} – ${v.name}` : v.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth select label="Sub-village / Hamlet (optional)" value={value.subVillageId ?? ''}
              disabled={!value.villageId} onChange={(e) => set({ subVillageId: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              {(subVillages.data ?? []).map((sv) => <MenuItem key={sv.id} value={sv.id}>{sv.name}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      )}

      {value.branch === 'SH_MDR' && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth required select label="Road Category" value={value.roadCategory ?? ''}
              onChange={(e) => set({ roadCategory: e.target.value as WorkLocationValue['roadCategory'] })}
            >
              <MenuItem value="SH">State Highway (SH)</MenuItem>
              <MenuItem value="MDR">Major District Road (MDR)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth required label="Road Name / Stretch" value={value.roadName ?? ''}
              onChange={(e) => set({ roadName: e.target.value })}
              placeholder="e.g. Davangere - Harihar stretch"
            />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
