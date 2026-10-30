import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, FormControl, FormControlLabel, FormLabel, Grid, InputAdornment,
  MenuItem, Radio, RadioGroup, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  IMPLEMENTING_AGENCIES, ROLES, THIRD_PARTY_INSPECTION_STATUSES, WORK_DOC_TYPES, financialYears,
  type ThirdPartyInspectionStatus,
} from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { Confetti } from '@/components/Confetti';
import { useConfirm } from '@/components/ConfirmDialog';
import { api, errorMessage, getActivePrincipal } from '@/api/client';
import { useDepartments } from '@/hooks/useOptions';
import { useAuth } from '@/app/AuthProvider';
import { WorkLocationPicker, type WorkLocationValue } from './WorkLocationPicker';
import { buildWorkLocationPayload, isWorkLocationComplete } from './workLocationPayload';
import { PhotoSlots } from './PhotoSlots';

const MOBILE_RX = /^[6-9]\d{9}$/;

/** A populated ref comes back as an object; a bare one as a string id. */
const refId = (v: any): string => (v && typeof v === 'object' ? String(v.id ?? v._id) : v ? String(v) : '');

interface FormState {
  departmentId: string;
  implementingAgency: string;
  implementingAgencyOther: string;
  agencyInspectorName: string;
  agencyInspectorContact: string;
  fundingSource: string;
  fundingYear: string;
  nameOfWork: string;
  engineerName: string;
  engineerContact: string;
  location: WorkLocationValue;
  address: string;
  remarks: string;
  amountLakhs: string;
  thirdPartyInspection: ThirdPartyInspectionStatus;
  tpiOfficerName: string;
  tpiOfficerContact: string;
}

const EMPTY: FormState = {
  departmentId: '',
  implementingAgency: '',
  implementingAgencyOther: '',
  agencyInspectorName: '',
  agencyInspectorContact: '',
  fundingSource: '',
  fundingYear: '',
  nameOfWork: '',
  engineerName: '',
  engineerContact: '',
  location: { branch: 'GP' },
  address: '',
  remarks: '',
  amountLakhs: '',
  thirdPartyInspection: 'Not Completed',
  tpiOfficerName: '',
  tpiOfficerContact: '',
};

function fromWork(w: any): FormState {
  const l = w.location ?? {};
  const branch = (l.locationType ?? 'GP') as WorkLocationValue['branch'];
  return {
    departmentId: refId(w.departmentId),
    implementingAgency: w.implementingAgency ?? '',
    implementingAgencyOther: w.implementingAgencyOther ?? '',
    agencyInspectorName: w.agencyInspectorName ?? '',
    agencyInspectorContact: w.agencyInspectorContact ?? '',
    fundingSource: w.fundingSource ?? '',
    fundingYear: w.fundingYear ?? '',
    nameOfWork: w.nameOfWork ?? '',
    engineerName: w.engineerName ?? '',
    engineerContact: w.engineerContact ?? '',
    location: {
      branch,
      wardId: refId(l.wardId) || undefined,
      gramPanchayatId: refId(l.gramPanchayatId) || undefined,
      villageId: refId(l.villageId) || undefined,
      subVillageId: refId(l.subVillageId) || undefined,
      roadCategory: l.roadCategory ?? '',
      roadName: l.roadName ?? '',
    },
    address: w.address ?? '',
    remarks: w.remarks ?? '',
    amountLakhs: w.amountLakhs != null ? String(w.amountLakhs) : '',
    thirdPartyInspection: w.thirdPartyInspection ?? 'Not Completed',
    tpiOfficerName: w.tpiOfficerName ?? '',
    tpiOfficerContact: w.tpiOfficerContact ?? '',
  };
}

async function uploadWorkFiles(workId: string, documentType: string, files: File[]) {
  if (!files.length) return;
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  fd.append('documentType', documentType);
  await api.post(`/documents/work/${workId}`, fd);
}

/**
 * New Work form, also used for editing (/works/:id/edit). Attachments
 * (estimation copy, before/after photos) are picked here on create and
 * uploaded right after the work is saved; on edit they're managed from the
 * detail page instead.
 */
export function WorkCreatePage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const { user } = useAuth();
  // Agency logins can't move a work to another agency (the server rejects it too).
  const isAgencyUser = user?.roleCode === ROLES.IMPLEMENTING_AGENCY;
  const ownAgency = user?.implementingAgency || '';
  const agencyLocked = isAgencyUser || !!ownAgency;
  const departments = useDepartments();
  const years = useMemo(() => financialYears(), []);

  const blank: FormState = ownAgency ? { ...EMPTY, implementingAgency: ownAgency } : EMPTY;
  const [form, setForm] = useState<FormState>(blank);
  const [estimation, setEstimation] = useState<File | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const estimationRef = useRef<HTMLInputElement>(null);

  const existing = useQuery({
    queryKey: ['works', 'one', id],
    queryFn: () => api.get(`/works/${id}`).then((r) => r.data),
    enabled: editing,
  });
  useEffect(() => {
    if (existing.data) setForm(fromWork(existing.data));
  }, [existing.data]);

  // Fill the agency in once the login is known, if the form opened before it was.
  useEffect(() => {
    if (!editing && ownAgency) setForm((f) => (f.implementingAgency ? f : { ...f, implementingAgency: ownAgency }));
  }, [editing, ownAgency]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const amount = Number(form.amountLakhs);
  const contactInvalid = !!form.engineerContact && !MOBILE_RX.test(form.engineerContact);
  const inspectorContactInvalid = !!form.agencyInspectorContact && !MOBILE_RX.test(form.agencyInspectorContact);
  const tpiContactInvalid = !!form.tpiOfficerContact && !MOBILE_RX.test(form.tpiOfficerContact);
  const valid =
    !!form.departmentId &&
    !!form.implementingAgency &&
    (form.implementingAgency !== 'Other' || !!form.implementingAgencyOther.trim()) &&
    !!form.fundingSource.trim() &&
    !!form.fundingYear &&
    form.nameOfWork.trim().length >= 3 &&
    !contactInvalid &&
    !inspectorContactInvalid &&
    !tpiContactInvalid &&
    isWorkLocationComplete(form.location) &&
    form.amountLakhs !== '' && amount > 0;

  const payload = () => ({
    departmentId: form.departmentId,
    implementingAgency: form.implementingAgency,
    implementingAgencyOther: form.implementingAgency === 'Other' ? form.implementingAgencyOther.trim() : undefined,
    agencyInspectorName: form.agencyInspectorName.trim(),
    agencyInspectorContact: form.agencyInspectorContact.trim(),
    fundingSource: form.fundingSource.trim(),
    fundingYear: form.fundingYear,
    nameOfWork: form.nameOfWork.trim(),
    engineerName: form.engineerName.trim(),
    engineerContact: form.engineerContact.trim(),
    location: buildWorkLocationPayload(form.location),
    address: form.address.trim(),
    remarks: form.remarks.trim(),
    amountLakhs: Math.round(amount * 100) / 100,
    thirdPartyInspection: form.thirdPartyInspection,
    tpiOfficerName: form.tpiOfficerName.trim(),
    tpiOfficerContact: form.tpiOfficerContact.trim(),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return api.patch(`/works/${id}`, payload()).then((r) => r.data);
      const work = await api.post('/works', { principalId: getActivePrincipal(), ...payload() }).then((r) => r.data);
      // The work is saved at this point - an upload failure shouldn't lose it,
      // so report it and let the user re-attach from the detail page.
      try {
        if (estimation) await uploadWorkFiles(work.id, WORK_DOC_TYPES.ESTIMATION, [estimation]);
        await uploadWorkFiles(work.id, WORK_DOC_TYPES.BEFORE_PHOTO, beforePhotos);
        await uploadWorkFiles(work.id, WORK_DOC_TYPES.AFTER_PHOTO, afterPhotos);
      } catch (e) {
        enqueueSnackbar(`Work saved, but an attachment failed: ${errorMessage(e)}. Add it from the work page.`, { variant: 'warning' });
      }
      return work;
    },
    onSuccess: (work) => {
      qc.invalidateQueries({ queryKey: ['works'] });
      if (editing) {
        enqueueSnackbar('Work updated', { variant: 'success' });
        navigate(`/works/${id}`);
        return;
      }
      enqueueSnackbar(`Created ${work.workId}`, { variant: 'success' });
      setCelebrate(true);
      setTimeout(() => navigate(`/works/${work.id}`), 700);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const clear = async () => {
    const ok = await confirm({ title: 'Clear the form?', message: 'Everything entered so far will be removed.', confirmLabel: 'Clear', destructive: true });
    if (!ok) return;
    setForm(editing && existing.data ? fromWork(existing.data) : blank);
    setEstimation(null);
    setBeforePhotos([]);
    setAfterPhotos([]);
    setError(null);
  };

  if (editing && existing.isLoading) return <Skeleton variant="rounded" height={500} />;
  if (editing && existing.isError) return <Alert severity="error">Unable to load this work.</Alert>;

  const title = editing ? `Edit ${existing.data?.workId ?? 'Work'}` : 'New Work';

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle="A sanctioned development work - CC road, drain, building, etc."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Works', to: '/works' }, { label: editing ? 'Edit' : 'New' }]}
      />

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {isAgencyUser && !ownAgency && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No implementing agency is set on your login, so works can't be saved. Ask the admin to set it under Users → Edit.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required select label="Department Name" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required select label="Implementing Agency" value={form.implementingAgency} disabled={agencyLocked} onChange={(e) => set('implementingAgency', e.target.value)}>
                {IMPLEMENTING_AGENCIES.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </TextField>
            </Grid>
            {form.implementingAgency === 'Other' && (
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Agency Name" value={form.implementingAgencyOther} onChange={(e) => set('implementingAgencyOther', e.target.value)} />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Agency Inspector Name" value={form.agencyInspectorName} onChange={(e) => set('agencyInspectorName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Agency Inspector Contact Number" value={form.agencyInspectorContact}
                onChange={(e) => set('agencyInspectorContact', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputProps={{ inputMode: 'numeric' }}
                error={inspectorContactInvalid}
                helperText={inspectorContactInvalid ? 'Enter a valid 10-digit mobile number' : ' '}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth required label="Funding Source" value={form.fundingSource}
                onChange={(e) => set('fundingSource', e.target.value)}
                placeholder="e.g. MLA LAD, SDP, State Grant"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required select label="Year of Funding" value={form.fundingYear} onChange={(e) => set('fundingYear', e.target.value)}>
                {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth required label="Name of Work" value={form.nameOfWork}
                onChange={(e) => set('nameOfWork', e.target.value)}
                placeholder="e.g. CC Road from Bus Stand to Govt School"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Engineer Looking After the Work" value={form.engineerName} onChange={(e) => set('engineerName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Engineer Contact Number" value={form.engineerContact}
                onChange={(e) => set('engineerContact', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputProps={{ inputMode: 'numeric' }}
                error={contactInvalid}
                helperText={contactInvalid ? 'Enter a valid 10-digit mobile number' : ' '}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Ward / Gram Panchayat</Typography>
          <WorkLocationPicker value={form.location} onChange={(v) => set('location', v)} />
          <TextField
            fullWidth multiline minRows={2} label="Address" value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Site address / landmark, e.g. Near Govt School, 2nd Cross"
            sx={{ mt: 2 }}
          />

          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth required type="number" label="Amount" value={form.amountLakhs}
                onChange={(e) => set('amountLakhs', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{ endAdornment: <InputAdornment position="end">Lakhs</InputAdornment> }}
                error={form.amountLakhs !== '' && !(amount > 0)}
                helperText={form.amountLakhs !== '' && !(amount > 0) ? 'Amount must be greater than 0' : ' '}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl>
                <FormLabel>Third Party Inspection</FormLabel>
                <RadioGroup row value={form.thirdPartyInspection} onChange={(e) => set('thirdPartyInspection', e.target.value as ThirdPartyInspectionStatus)}>
                  {THIRD_PARTY_INSPECTION_STATUSES.map((s) => <FormControlLabel key={s} value={s} control={<Radio />} label={s} />)}
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="TPI Officer Name" value={form.tpiOfficerName} onChange={(e) => set('tpiOfficerName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="TPI Officer Contact Number" value={form.tpiOfficerContact}
                onChange={(e) => set('tpiOfficerContact', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputProps={{ inputMode: 'numeric' }}
                error={tpiContactInvalid}
                helperText={tpiContactInvalid ? 'Enter a valid 10-digit mobile number' : ' '}
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth multiline minRows={3} label="Remarks / Queries" value={form.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            placeholder="Any remarks or open queries about this work"
            inputProps={{ maxLength: 2000 }}
            sx={{ mt: 1 }}
          />

          {!editing && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Estimation Copy</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Button variant="outlined" startIcon={<Icon name="UploadFile" />} onClick={() => estimationRef.current?.click()}>
                      {estimation ? 'Replace' : 'Upload'}
                    </Button>
                    {estimation && (
                      <>
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{estimation.name}</Typography>
                        <Button size="small" color="inherit" onClick={() => setEstimation(null)}>Remove</Button>
                      </>
                    )}
                  </Stack>
                  <input
                    ref={estimationRef}
                    hidden
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => { setEstimation(e.target.files?.[0] ?? null); e.target.value = ''; }}
                  />
                </Box>
                <PhotoSlots label="Before Work Photos" files={beforePhotos} onChange={setBeforePhotos} />
                <PhotoSlots label="After Work Photos" files={afterPhotos} onChange={setAfterPhotos} />
              </Stack>
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            <Button color="inherit" variant="outlined" startIcon={<Icon name="Autorenew" />} onClick={clear} disabled={save.isPending}>
              Clear
            </Button>
            <Button variant="contained" startIcon={<Icon name="Send" />} disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Submit'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {dialog}
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </Box>
  );
}
