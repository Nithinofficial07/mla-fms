import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { api, errorMessage } from '@/api/client';
import { useDepartments } from '@/hooks/useOptions';
import { CascadingLocationPicker, type LocationValue } from '@/features/requests/CascadingLocationPicker';

interface FormState {
  subject: string;
  description: string;
  applicant: { name: string; mobile: string; altMobile: string; address: string };
  location: LocationValue;
  referredBy: string;
  departmentId: string;
  departmentLetterNo: string;
}

const empty: FormState = {
  subject: '',
  description: '',
  applicant: { name: '', mobile: '', altMobile: '', address: '' },
  location: { branch: 'RURAL' },
  referredBy: '',
  departmentId: '',
  departmentLetterNo: '',
};

export function LetterCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const departments = useDepartments();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  const setApplicant = (k: string, v: string) => setForm((s) => ({ ...s, applicant: { ...s.applicant, [k]: v } }));

  const payload = (issue: boolean) => ({
    subject: form.subject,
    description: form.description || undefined,
    applicant: {
      name: form.applicant.name,
      mobile: form.applicant.mobile,
      altMobile: form.applicant.altMobile || undefined,
      address: form.applicant.address || undefined,
    },
    location: {
      wardId: form.location.branch === 'URBAN' ? form.location.wardId : undefined,
      gramPanchayatId: form.location.branch === 'RURAL' ? form.location.gramPanchayatId : undefined,
      villageId: form.location.villageId || undefined,
      subVillageId: form.location.subVillageId || undefined,
    },
    referredBy: form.referredBy || undefined,
    departmentId: form.departmentId || undefined,
    departmentLetterNo: form.departmentLetterNo || undefined,
    issue,
  });

  const create = useMutation({
    mutationFn: (issue: boolean) => api.post('/letters', payload(issue)).then((r) => r.data),
    onSuccess: (data) => {
      enqueueSnackbar(`Created ${data.letterNo}`, { variant: 'success' });
      navigate(`/letters/${data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const valid = form.subject.length > 2
    && form.applicant.name.length > 1
    && /^[6-9]\d{9}$/.test(form.applicant.mobile)
    && !!(form.location.wardId || form.location.gramPanchayatId);

  return (
    <Box>
      <PageHeader
        title="New MLA Letter"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'MLA Letters', to: '/letters' }, { label: 'New' }]}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card><CardContent>
            <Typography variant="subtitle2" gutterBottom>Applicant</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth required label="Applicant name" value={form.applicant.name} onChange={(e) => setApplicant('name', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth required label="Phone number" value={form.applicant.mobile} onChange={(e) => setApplicant('mobile', e.target.value)} error={!!form.applicant.mobile && !/^[6-9]\d{9}$/.test(form.applicant.mobile)} helperText="10-digit mobile" /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Alternate phone" value={form.applicant.altMobile} onChange={(e) => setApplicant('altMobile', e.target.value)} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Address" value={form.applicant.address} onChange={(e) => setApplicant('address', e.target.value)} /></Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mt: 3 }} gutterBottom>Location (Ward or Rural)</Typography>
            <CascadingLocationPicker value={form.location} onChange={(location) => setForm((s) => ({ ...s, location }))} />
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card><CardContent>
            <Typography variant="subtitle2" gutterBottom>Letter</Typography>
            <Stack spacing={2}>
              <TextField required label="Subject" value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} />
              <TextField multiline minRows={3} label="Description / body notes" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              <TextField label="Referred by" value={form.referredBy} onChange={(e) => setForm((s) => ({ ...s, referredBy: e.target.value }))} />
              <TextField select label="Department" value={form.departmentId} onChange={(e) => setForm((s) => ({ ...s, departmentId: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
              <TextField label="Department letter no." value={form.departmentLetterNo} onChange={(e) => setForm((s) => ({ ...s, departmentLetterNo: e.target.value }))} />
              <Alert severity="info">Scan / attach the letter and supporting files on the next screen.</Alert>
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button variant="outlined" disabled={!valid || create.isPending} onClick={() => create.mutate(false)}>Save as draft</Button>
        <Button variant="contained" disabled={!valid || create.isPending} onClick={() => create.mutate(true)}>Create &amp; issue</Button>
      </Stack>
    </Box>
  );
}
