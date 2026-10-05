import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, MenuItem, MobileStepper, Stack, Step, StepLabel,
  Stepper, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api, errorMessage, getActivePrincipal } from '@/api/client';
import {
  useCategories, useDepartments, useGramPanchayats, useLookup, useOfficers, useWards,
} from '@/hooks/useOptions';
import { CascadingLocationPicker, type LocationValue } from './CascadingLocationPicker';
import { buildLocationPayload, isLocationComplete, locationSummary } from './locationPayload';

const STEPS = ['Applicant', 'Location', 'Request', 'Immediate Intervention', 'Review'];

interface FormState {
  applicant: {
    firstName: string; lastName: string; mobile: string;
    accompanyingCount: number;
    referencePersonName: string; referencePersonMobile: string;
    idType: string; idNumber: string;
  };
  location: LocationValue;
  subject: string;
  description: string;
  requestType: string;
  categoryId: string;
  primaryDepartmentId: string;
  assignedOfficerId: string;
  interventionInstructions: string;
}

const empty: FormState = {
  applicant: {
    firstName: '', lastName: '', mobile: '',
    accompanyingCount: 0,
    referencePersonName: '', referencePersonMobile: '',
    idType: '', idNumber: '',
  },
  location: { branch: 'RURAL' },
  subject: '',
  description: '',
  requestType: '',
  categoryId: '',
  primaryDepartmentId: '',
  assignedOfficerId: '',
  interventionInstructions: '',
};

export function RequestCreatePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categories = useCategories();
  const departments = useDepartments();
  const wards = useWards();
  const gramPanchayats = useGramPanchayats();
  const officers = useOfficers(form.primaryDepartmentId || undefined);
  const requestTypes = useLookup('REQUEST_TYPE');
  const idTypes = useLookup('ID_TYPE');

  const selectedOfficer = officers.data?.find((o) => o.id === form.assignedOfficerId);

  const dup = useQuery({
    queryKey: ['dupes', form.applicant.mobile, form.subject],
    queryFn: () =>
      api
        .get('/requests/duplicates', { params: { mobile: form.applicant.mobile, subject: form.subject } })
        .then((r) => r.data.matches as any[]),
    enabled: form.applicant.mobile.length === 10 && form.subject.length > 3 && step >= 2,
  });

  const setApplicant = <K extends keyof FormState['applicant']>(k: K, v: FormState['applicant'][K]) =>
    setForm((s) => ({ ...s, applicant: { ...s.applicant, [k]: v } }));

  const payload = (submit: boolean) => ({
    principalId: getActivePrincipal(),
    subject: form.subject,
    description: form.description,
    requestType: form.requestType || undefined,
    categoryId: form.categoryId || undefined,
    primaryDepartmentId: form.primaryDepartmentId || undefined,
    assignedOfficerId: form.assignedOfficerId || undefined,
    interventionInstructions: form.interventionInstructions || undefined,
    applicant: {
      firstName: form.applicant.firstName.trim(),
      lastName: form.applicant.lastName.trim(),
      mobile: form.applicant.mobile,
      accompanyingCount: form.applicant.accompanyingCount,
      referencePersonName: form.applicant.referencePersonName.trim() || undefined,
      referencePersonMobile: form.applicant.referencePersonMobile || undefined,
      idType: form.applicant.idType || undefined,
      idNumber: form.applicant.idNumber || undefined,
    },
    location: buildLocationPayload(form.location),
    submit,
  });

  const create = useMutation({
    mutationFn: (submit: boolean) => api.post('/requests', payload(submit)).then((r) => r.data),
    onSuccess: async (data) => {
      if (files.length) {
        try {
          const fd = new FormData();
          files.forEach((f) => fd.append('files', f));
          fd.append('documentType', 'Supporting Document');
          await api.post(`/documents/request/${data.id}`, fd);
        } catch {
          enqueueSnackbar('File created, but attaching the document(s) failed — attach them from the file detail page.', { variant: 'warning' });
        }
      }
      enqueueSnackbar(`Created ${data.fileId}`, { variant: 'success' });
      navigate(`/requests/${data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const canNext = () => {
    if (step === 0) {
      return (
        form.applicant.firstName.trim().length > 0
        && form.applicant.lastName.trim().length > 0
        && /^[6-9]\d{9}$/.test(form.applicant.mobile)
      );
    }
    if (step === 1) return isLocationComplete(form.location);
    if (step === 2) return form.subject.length > 2;
    return true;
  };

  const gp = gramPanchayats.data?.find((g) => g.id === form.location.gramPanchayatId);

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
              <Grid item xs={12} sm={4}><TextField fullWidth required label="First Name" value={form.applicant.firstName} onChange={(e) => setApplicant('firstName', e.target.value)} /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth required label="Last Name" value={form.applicant.lastName} onChange={(e) => setApplicant('lastName', e.target.value)} /></Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth required label="Mobile number" value={form.applicant.mobile}
                  onChange={(e) => setApplicant('mobile', e.target.value)}
                  error={!!form.applicant.mobile && !/^[6-9]\d{9}$/.test(form.applicant.mobile)}
                  helperText={!!form.applicant.mobile && !/^[6-9]\d{9}$/.test(form.applicant.mobile) ? 'Enter a valid 10-digit mobile number' : '10-digit Indian mobile'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="number" label="Number of people accompanying applicant"
                  value={form.applicant.accompanyingCount}
                  onChange={(e) => setApplicant('accompanyingCount', Math.max(0, Number(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                  helperText="Helps gauge the scale of the visit"
                />
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Reference Person Name (optional)" value={form.applicant.referencePersonName} onChange={(e) => setApplicant('referencePersonName', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Reference Person Mobile (optional)" value={form.applicant.referencePersonMobile}
                  onChange={(e) => setApplicant('referencePersonMobile', e.target.value)}
                  error={!!form.applicant.referencePersonMobile && !/^[6-9]\d{9}$/.test(form.applicant.referencePersonMobile)}
                />
              </Grid>
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
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline minRows={3} label="Request Description"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  helperText="Provide a clear and complete description of the applicant's request, issue, background and required intervention."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Request type" value={form.requestType} onChange={(e) => setForm((s) => ({ ...s, requestType: e.target.value }))}>
                  <MenuItem value="">—</MenuItem>
                  {(requestTypes.data ?? []).map((t) => <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Category" value={form.categoryId} onChange={(e) => setForm((s) => ({ ...s, categoryId: e.target.value }))}>
                  <MenuItem value="">—</MenuItem>
                  {(categories.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
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
                <TextField
                  fullWidth select label="Intervention Department / Authority"
                  value={form.primaryDepartmentId}
                  onChange={(e) => setForm((s) => ({ ...s, primaryDepartmentId: e.target.value, assignedOfficerId: '' }))}
                  helperText="Can be changed later from the file's Workflow Actions tab"
                >
                  <MenuItem value="">—</MenuItem>
                  {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth select label="Officer / Person (optional)"
                  value={form.assignedOfficerId}
                  onChange={(e) => setForm((s) => ({ ...s, assignedOfficerId: e.target.value }))}
                  disabled={!form.primaryDepartmentId}
                  helperText={selectedOfficer?.designation ? `Designation: ${selectedOfficer.designation}` : ' '}
                >
                  <MenuItem value="">—</MenuItem>
                  {(officers.data ?? []).map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline minRows={2} label="Instructions / Action Required (optional)"
                  value={form.interventionInstructions}
                  onChange={(e) => setForm((s) => ({ ...s, interventionInstructions: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <Button component="label" variant="outlined" startIcon={<Icon name="AttachFile" />}>
                  Attach document(s)
                  <input hidden type="file" multiple onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
                </Button>
                {files.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {files.map((f, i) => (
                      <Chip key={`${f.name}-${i}`} label={f.name} size="small" onDelete={() => setFiles((fs) => fs.filter((_, j) => j !== i))} />
                    ))}
                  </Stack>
                )}
              </Grid>
            </Grid>
          )}

          {step === 4 && (
            <Stack spacing={2.5}>
              {[
                {
                  title: 'Applicant', editStep: 0,
                  rows: [
                    ['First Name', form.applicant.firstName],
                    ['Last Name', form.applicant.lastName],
                    ['Mobile', form.applicant.mobile],
                    ['Accompanying People', String(form.applicant.accompanyingCount)],
                    ['Reference Person', form.applicant.referencePersonName || '—'],
                    ['Reference Mobile', form.applicant.referencePersonMobile || '—'],
                    ['ID', form.applicant.idType ? `${form.applicant.idType}: ${form.applicant.idNumber || '—'}` : '—'],
                  ],
                },
                {
                  title: 'Location', editStep: 1,
                  rows: [
                    ['Location', locationSummary(form.location, wards.data?.find((w) => w.id === form.location.wardId)?.name, gp?.name, gp?.order)],
                  ],
                },
                {
                  title: 'Request', editStep: 2,
                  rows: [
                    ['Subject', form.subject],
                    ['Request Description', form.description || '—'],
                    ['Request Type', form.requestType || '—'],
                    ['Category', categories.data?.find((c) => c.id === form.categoryId)?.name ?? '—'],
                  ],
                },
                {
                  title: 'Immediate Intervention', editStep: 3,
                  rows: [
                    ['Department / Authority', departments.data?.find((d) => d.id === form.primaryDepartmentId)?.name ?? 'Unassigned'],
                    ['Officer', selectedOfficer?.name ?? '—'],
                    ['Designation', selectedOfficer?.designation ?? '—'],
                    ['Instructions / Action Required', form.interventionInstructions || '—'],
                    ['Attachments', files.length ? files.map((f) => f.name).join(', ') : 'None'],
                  ],
                },
              ].map((section) => (
                <Box key={section.title}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{section.title}</Typography>
                    <Button size="small" onClick={() => setStep(section.editStep)}>Edit</Button>
                  </Stack>
                  <Grid container spacing={1}>
                    {section.rows.map(([k, v]) => (
                      <Grid item xs={12} sm={6} key={k}>
                        <Typography variant="caption" color="text.secondary">{k}</Typography>
                        <Typography variant="body2" fontWeight={600}>{v || '—'}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
            </Stack>
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
