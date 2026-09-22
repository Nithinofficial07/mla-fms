import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, Divider, Grid, MenuItem, Skeleton, Stack, Tab,
  Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { LETTER_STATUSES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { TimelineView } from '@/components/TimelineView';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success' | 'warning'> = {
  DRAFT: 'default', ISSUED: 'info', DISPATCHED: 'primary', REPLIED: 'warning', CLOSED: 'success',
};

export function LetterDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');

  const detail = useQuery({ queryKey: ['letters', 'one', id], queryFn: () => api.get(`/letters/${id}`).then((r) => r.data) });
  const timeline = useQuery({ queryKey: ['letters', id, 'timeline'], queryFn: () => api.get(`/letters/${id}/timeline`).then((r) => r.data) });
  const remarks = useQuery({ queryKey: ['letters', id, 'remarks'], queryFn: () => api.get(`/letters/${id}/remarks`).then((r) => r.data) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['letters', 'one', id] });
    qc.invalidateQueries({ queryKey: ['letters', id, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['letters', id, 'remarks'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const setStatusM = useMutation({
    mutationFn: (s: string) => api.post(`/letters/${id}/status`, { status: s }),
    onSuccess: () => { enqueueSnackbar('Status updated', { variant: 'success' }); refresh(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const addRemark = useMutation({
    mutationFn: () => api.post(`/letters/${id}/remarks`, { body: remark }),
    onSuccess: () => { enqueueSnackbar('Remark added', { variant: 'success' }); setRemark(''); refresh(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const l = detail.data;
  if (detail.isLoading) return <Skeleton variant="rounded" height={360} />;
  if (detail.isError || !l) return <Alert severity="error">Unable to load this letter.</Alert>;

  const loc = l.location?.wardId?.name
    ? `Ward: ${l.location.wardId.name}`
    : l.location?.gramPanchayatId?.name
      ? `GP: ${l.location.gramPanchayatId.name}`
      : l.location?.otherPlaceName
        ? `Other: ${l.location.otherPlaceName}`
        : '—';

  return (
    <Box>
      <PageHeader
        title={l.letterNo}
        subtitle={l.subject}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'MLA Letters', to: '/letters' }, { label: l.letterNo }]}
      />

      <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'secondary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Chip size="small" label={l.status} color={STATUS_COLOR[l.status] ?? 'default'} />
            <Chip size="small" icon={<Icon name="AccountBalance" />} label={l.departmentId?.name ?? 'No department'} />
            <Chip size="small" variant="outlined" icon={<Icon name="Event" />} label={dayjs(l.date).format('DD MMM YYYY')} />
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        <Tab icon={<Icon name="Description" />} iconPosition="start" label="Overview" />
        <Tab icon={<Icon name="AttachFile" />} iconPosition="start" label="Documents" />
        <Tab icon={<Icon name="Timeline" />} iconPosition="start" label="Timeline" />
        <Tab icon={<Icon name="Comment" />} iconPosition="start" label="Remarks" />
        <Tab icon={<Icon name="SwapHoriz" />} iconPosition="start" label="Status" />
      </Tabs>

      <Box key={tab} sx={{ animation: 'fadeInUp .3s ease both' }}>
      {tab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
          <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="Applicant" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
              <Divider />
              <CardContent>
                <Stack spacing={2}>
                  <DetailField icon="PersonAdd" label="Applicant" value={l.applicant?.name} />
                  <DetailField icon="Mail" label="Phone" value={l.applicant?.mobile} />
                  <DetailField icon="Mail" label="Alternate phone" value={l.applicant?.altMobile} />
                  <DetailField icon="Place" label="Address" value={l.applicant?.address} />
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="Location & Referral" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
              <Divider />
              <CardContent>
                <Stack spacing={2}>
                  <DetailField icon="Place" label="Location" value={loc} />
                  <DetailField icon="Place" label="Ward address" value={l.location?.addressText} />
                  <DetailField icon="Grass" label="Village" value={l.location?.villageId?.name} />
                  <DetailField icon="Spa" label="Sub-village" value={l.location?.subVillageId?.name} />
                  <DetailField icon="Forward" label="Referred by" value={l.referredBy} />
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ gridColumn: 'span 12' }}>
            <Card>
              <CardHeader title="Department & Timing" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
              <Divider />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}><DetailField icon="AccountBalance" label="Department" value={l.departmentId?.name} /></Grid>
                  <Grid item xs={6} sm={4}><DetailField icon="Label" label="Dept. letter no." value={l.departmentLetterNo} /></Grid>
                  <Grid item xs={6} sm={4}><DetailField icon="Event" label="Created" value={dayjs(l.createdAt).format('DD MMM YYYY, hh:mm A')} /></Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <DetailField label="Description" value={l.description} />
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
            <Card><CardContent><DocumentUploader owner={{ kind: 'letter', id }} onUploaded={refresh} /></CardContent></Card>
          )}
          <Card><CardContent><DocumentList owner={{ kind: 'letter', id }} /></CardContent></Card>
        </Stack>
      )}

      {tab === 2 && <Card><CardContent><TimelineView entries={timeline.data ?? []} /></CardContent></Card>}

      {tab === 3 && (
        <Stack spacing={2}>
          {can(PERMISSIONS.REMARK_ADD) && (
            <Card><CardContent>
              <TextField fullWidth multiline minRows={2} label="Add a remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
              <Button sx={{ mt: 1 }} variant="contained" disabled={!remark || addRemark.isPending} onClick={() => addRemark.mutate()}>Add remark</Button>
            </CardContent></Card>
          )}
          <Card><CardContent>
            {(remarks.data ?? []).length === 0 && <Typography color="text.secondary">No remarks yet.</Typography>}
            {(remarks.data ?? []).map((rm: any) => (
              <Box key={rm.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">{rm.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {rm.authorName} · {dayjs(rm.createdAt).format('DD MMM YYYY, hh:mm A')}
                </Typography>
              </Box>
            ))}
          </CardContent></Card>
        </Stack>
      )}

      {tab === 4 && (
        <Card sx={{ maxWidth: 420 }}>
          <CardHeader
            avatar={<Icon name="SwapHoriz" sx={{ color: 'primary.main' }} />}
            title="Update status"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
          />
          <Divider />
          <CardContent>
            <TextField fullWidth select label="Status" value={status || l.status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 1 }}>
              {LETTER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <Button variant="contained" disabled={setStatusM.isPending || (status || l.status) === l.status} onClick={() => setStatusM.mutate(status || l.status)}>
              Save
            </Button>
          </CardContent>
        </Card>
      )}
      </Box>
    </Box>
  );
}
