import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, MenuItem, Skeleton, Stack, Tab,
  Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { LETTER_STATUSES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

export function LetterDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState('');

  const detail = useQuery({ queryKey: ['letters', 'one', id], queryFn: () => api.get(`/letters/${id}`).then((r) => r.data) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['letters', 'one', id] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const setStatusM = useMutation({
    mutationFn: (s: string) => api.post(`/letters/${id}/status`, { status: s }),
    onSuccess: () => { enqueueSnackbar('Status updated', { variant: 'success' }); refresh(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const l = detail.data;
  if (detail.isLoading) return <Skeleton variant="rounded" height={360} />;
  if (detail.isError || !l) return <Alert severity="error">Unable to load this letter.</Alert>;

  const loc = l.location?.wardId?.name
    ? `Ward: ${l.location.wardId.name}`
    : l.location?.gramPanchayatId?.name
      ? `GP: ${l.location.gramPanchayatId.name}`
      : '—';

  return (
    <Box>
      <PageHeader
        title={l.letterNo}
        subtitle={l.subject}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'MLA Letters', to: '/letters' }, { label: l.letterNo }]}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip size="small" label={l.status} color="primary" />
        <Chip size="small" label={l.departmentId?.name ?? 'No department'} />
        <Chip size="small" label={dayjs(l.date).format('DD MMM YYYY')} />
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Overview" />
        <Tab label="Documents" />
        <Tab label="Status" />
      </Tabs>

      {tab === 0 && (
        <Card><CardContent>
          <Grid container spacing={2}>
            {[
              ['Applicant', l.applicant?.name],
              ['Phone', l.applicant?.mobile],
              ['Alternate phone', l.applicant?.altMobile],
              ['Address', l.applicant?.address],
              ['Location', loc],
              ['Ward address', l.location?.addressText],
              ['Village', l.location?.villageId?.name],
              ['Sub-village', l.location?.subVillageId?.name],
              ['Referred by', l.referredBy],
              ['Department', l.departmentId?.name],
              ['Department letter no.', l.departmentLetterNo],
              ['Created', dayjs(l.createdAt).format('DD MMM YYYY, hh:mm A')],
            ].map(([k, v]) => (
              <Grid item xs={6} sm={4} key={k as string}>
                <Typography variant="caption" color="text.secondary">{k}</Typography>
                <Typography variant="body2" fontWeight={600}>{v ? String(v) : '—'}</Typography>
              </Grid>
            ))}
            <Grid item xs={12}><Divider /></Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Description</Typography>
              <Typography variant="body2">{l.description || '—'}</Typography>
            </Grid>
          </Grid>
        </CardContent></Card>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
            <Card><CardContent><DocumentUploader owner={{ kind: 'letter', id }} onUploaded={refresh} /></CardContent></Card>
          )}
          <Card><CardContent><DocumentList owner={{ kind: 'letter', id }} /></CardContent></Card>
        </Stack>
      )}

      {tab === 2 && (
        <Card sx={{ maxWidth: 420 }}><CardContent>
          <Typography variant="subtitle2" gutterBottom>Update status</Typography>
          <TextField fullWidth select label="Status" value={status || l.status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 1 }}>
            {LETTER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={setStatusM.isPending || (status || l.status) === l.status} onClick={() => setStatusM.mutate(status || l.status)}>
            Save
          </Button>
        </CardContent></Card>
      )}
    </Box>
  );
}
