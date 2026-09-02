import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Grid, MenuItem, MobileStepper, Step, StepLabel,
  Stepper, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';
import { useCategories, useDepartments, useLookup, usePriorities } from '@/hooks/useOptions';
import { CascadingLocationPicker, type LocationValue } from './CascadingLocationPicker';

const STEPS = ['Applicant', 'Location', 'Request', 'Department', 'Review'];

interface FormState {
  applicant: { name: string; mobile: string; altMobile: string; email: string; address: string; idType: string; idNumber: string };
  location: LocationValue;
  subject: string;
  description: string;
  requestType: string;
  categoryId: string;
  priorityId: string;
  primaryDepartmentId: string;
}

const empty: FormState = {
  applicant: { name: '', mobile: '', altMobile: '', email: '', address: '', idType: '', idNumber: '' },
  location: { branch: 'RURAL' },
  subject: '',
  description: '',
  requestType: '',
  categoryId: '',
  priorityId: '',
  primaryDepartmentId: '',
};

export function RequestCreatePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  const categories = useCategories();
  const priorities = usePriorities();
  const departments = useDepartments();
  const requestTypes = useLookup('REQUEST_TYPE');
  const idTypes = useLookup('ID_TYPE');

  const dup = useQuery({
    queryKey: ['dupes', form.applicant.mobile, form.subject],
    queryFn: () =>
      api
        .get('/requests/duplicates', { params: { mobile: form.applicant.mobile, subject: form.subject } })
        .then((r) => r.data.matches as any[]),
    enabled: form.applicant.mobile.length === 10 && form.subject.length > 3 && step >= 2,
  });

  const setApplicant = (k: string, v: string) =>
    setForm((s) => ({ ...s, applicant: { ...s.applicant, [k]: v } }));

  const payload = (submit: boolean) => ({
    subject: form.subject,
    description: form.description,
    requestType: form.requestType || undefined,
    categoryId: form.categoryId || undefined,
    priorityId: form.priorityId,
    primaryDepartmentId: form.primaryDepartmentId || undefined,
    applicant: {
      name: form.applicant.name,
      mobile: form.applicant.mobile,
      altMobile: form.applicant.altMobile || undefined,
      email: form.applicant.email || undefined,
      address: form.applicant.address || undefined,
      idType: form.applicant.idType || undefined,
      idNumber: form.applicant.idNumber || undefined,
    },
    location: {
      wardId: form.location.branch === 'URBAN' ? form.location.wardId : undefined,
      gramPanchayatId: form.location.branch === 'RURAL' ? form.location.gramPanchayatId : undefined,
      villageId: form.location.villageId || undefined,
      subVillageId: form.location.subVillageId || undefined,
    },
    submit,
  });

  const create = useMutation({
    mutationFn: (submit: boolean) => api.post('/requests', payload(submit)).then((r) => r.data),
    onSuccess: (data) => {
      enqueueSnackbar(`Created ${data.fileId}`, { variant: 'success' });
      navigate(`/requests/${data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const canNext = () => {
    if (step === 0) return form.applicant.name.length > 1 && /^[6-9]\d{9}$/.test(form.applicant.mobile);
    if (step === 1) return !!(form.location.wardId || form.location.gramPanchayatId);
    if (step === 2) return form.subject.length > 2 && !!form.priorityId;
    return true;
  };

  return (
    <Box>
      <PageHeader
        title="Create New File / Request"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Requests', to: '/requests' }, { label: 'New' }]}
      />

      {!isMobile && (
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((s) => (
            <Step key={s}><StepLabel>{s}</StepLabel></Step>
          ))}
        </Stepper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {step === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth required label="Applicant name" value={form.applicant.name} onChange={(e) => setApplicant('name', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth required label="Mobile number" value={form.applicant.mobile} onChange={(e) => setApplicant('mobile', e.target.value)} error={!!form.applicant.mobile && !/^[6-9]\d{9}$/.test(form.applicant.mobile)} helperText="10-digit Indian mobile" /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Alternate mobile" value={form.applicant.altMobile} onChange={(e) => setApplicant('altMobile', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={form.applicant.email} onChange={(e) => setApplicant('email', e.target.value)} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Address" value={form.applicant.address} onChange={(e) => setApplicant('address', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="ID type" value={form.applicant.idType} onChange={(e) => setApplicant('idType', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {(idTypes.data ?? []).map((t) => <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="ID number" value={form.applicant.idNumber} onChange={(e) => setApplicant('idNumber', e.target.value)} /></Grid>
            </Grid>
          )}

          {step === 1 && (
            <CascadingLocationPicker value={form.location} onChange={(location) => setForm((s) => ({ ...s, location }))} />
          )}

          {step === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth required label="Subject" value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} /></Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth select label="Request type" value={form.requestType} onChange={(e) => setForm((s) => ({ ...s, requestType: e.target.value }))}>
                  <MenuItem value="">—</MenuItem>
                  {(requestTypes.data ?? []).map((t) => <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth select label="Category" value={form.categoryId} onChange={(e) => setForm((s) => ({ ...s, categoryId: e.target.value }))}>
                  <MenuItem value="">—</MenuItem>
                  {(categories.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required select label="Priority" value={form.priorityId} onChange={(e) => setForm((s) => ({ ...s, priorityId: e.target.value }))}>
                  {(priorities.data ?? []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
              </Grid>
              {dup.data && dup.data.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="warning" icon={<Icon name="ContentCopy" />}>
                    Possible duplicate request(s) found:
                    <ul style={{ margin: '4px 0 0' }}>
                      {dup.data.slice(0, 5).map((m) => (
                        <li key={m._id}>
                          <a href={`/requests/${m._id}`} target="_blank" rel="noreferrer">{m.fileId}</a> — {m.subject} ({m.statusCode})
                        </li>
                      ))}
                    </ul>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}

          {step === 3 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Primary department" value={form.primaryDepartmentId} onChange={(e) => setForm((s) => ({ ...s, primaryDepartmentId: e.target.value }))} helperText="Optional now — can be assigned after submission">
                  <MenuItem value="">—</MenuItem>
                  {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">Documents (application, ID, photos) are attached on the file detail page right after this step.</Alert>
              </Grid>
            </Grid>
          )}

          {step === 4 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Review</Typography>
              <Grid container spacing={1}>
                {[
                  ['Applicant', form.applicant.name],
                  ['Mobile', form.applicant.mobile],
                  ['Location', form.location.branch],
                  ['Subject', form.subject],
                  ['Priority', priorities.data?.find((p) => p.id === form.priorityId)?.name ?? '—'],
                  ['Department', departments.data?.find((d) => d.id === form.primaryDepartmentId)?.name ?? 'Unassigned'],
                ].map(([k, v]) => (
                  <Grid item xs={12} sm={6} key={k as string}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography variant="body2" fontWeight={600}>{String(v || '—')}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {isMobile ? (
        <MobileStepper
          variant="dots"
          steps={STEPS.length}
          position="static"
          activeStep={step}
          sx={{ mt: 2, bgcolor: 'transparent' }}
          nextButton={
            step === STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => create.mutate(true)} disabled={create.isPending}>Submit</Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>Next</Button>
            )
          }
          backButton={<Button onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</Button>}
        />
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {step === STEPS.length - 1 && (
              <Button variant="outlined" onClick={() => create.mutate(false)} disabled={create.isPending}>Save as draft</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>Next</Button>
            ) : (
              <Button variant="contained" onClick={() => create.mutate(true)} disabled={create.isPending}>Submit request</Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
