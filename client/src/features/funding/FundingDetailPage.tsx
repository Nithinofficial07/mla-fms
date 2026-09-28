import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, Divider, Grid, MenuItem, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { FUNDING_STATUSES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { TimelineView } from '@/components/TimelineView';
import { Confetti } from '@/components/Confetti';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error'> = {
  SUBMITTED: 'default', SENT_TO_MINISTER: 'info', UNDER_REVIEW: 'warning',
  APPROVED: 'primary', REJECTED: 'error', FUNDS_RELEASED: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted', SENT_TO_MINISTER: 'Sent to Minister', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved', REJECTED: 'Rejected', FUNDS_RELEASED: 'Funds Released',
};

const CELEBRATE_STATUSES = ['APPROVED', 'FUNDS_RELEASED'];

export function FundingDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState('');
  const [statusRemark, setStatusRemark] = useState('');
  const [remark, setRemark] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [letterNo, setLetterNo] = useState('');
  const [pointPersonName, setPointPersonName] = useState('');
  const [pointPersonNumber, setPointPersonNumber] = useState('');

  const detail = useQuery({
    queryKey: ['funding', 'one', id],
    queryFn: () => api.get(`/funding/${id}`).then((r) => r.data),
  });
  const timeline = useQuery({
    queryKey: ['funding', id, 'timeline'],
    queryFn: () => api.get(`/funding/${id}/timeline`).then((r) => r.data),
  });
  const remarks = useQuery({
    queryKey: ['funding', id, 'remarks'],
    queryFn: () => api.get(`/funding/${id}/remarks`).then((r) => r.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['funding', 'one', id] });
    qc.invalidateQueries({ queryKey: ['funding', id, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['funding', id, 'remarks'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const setStatusM = useMutation({
    mutationFn: (s: string) => api.post(`/funding/${id}/status`, { status: s, remark: statusRemark || undefined }),
    onSuccess: (_data, s) => {
      enqueueSnackbar('Status updated', { variant: 'success' });
      if (CELEBRATE_STATUSES.includes(s)) setCelebrate(true);
      setStatusRemark('');
      refresh();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const addRemark = useMutation({
    mutationFn: () => api.post(`/funding/${id}/remarks`, { body: remark }),
    onSuccess: () => { enqueueSnackbar('Remark added', { variant: 'success' }); setRemark(''); refresh(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const saveDetails = useMutation({
    mutationFn: () => api.patch(`/funding/${id}`, { letterNo, pointPersonName, pointPersonNumber }),
    onSuccess: () => { enqueueSnackbar('Details updated', { variant: 'success' }); setEditing(false); refresh(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const f = detail.data;

  if (detail.isLoading) return <Skeleton variant="rounded" height={400} />;
  if (detail.isError || !f) return <Alert severity="error">Unable to load this funding request.</Alert>;

  return (
    <Box>
      <PageHeader
        title={f.fundingRequestId}
        subtitle={f.subject}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Funding', to: '/funding' }, { label: f.fundingRequestId }]}
      />

      <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'secondary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Chip size="small" color={STATUS_COLOR[f.status] ?? 'default'} label={STATUS_LABEL[f.status] ?? f.status} />
            <Chip size="small" icon={<Icon name="AccountBalance" />} label={f.departmentId?.name ?? 'Unknown department'} />
            <Chip size="small" variant="outlined" icon={<Icon name="Event" />} label={dayjs(f.createdAt).format('DD MMM YYYY')} />
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, mb: 2 }}>
        <Box sx={{ gridColumn: 'span 12' }}>
          <Card>
            <CardHeader
              avatar={<Icon name="AttachMoney" sx={{ color: 'primary.main' }} />}
              title="Funding Request"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
            />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <DetailField icon="AccountBalance" label="Addressed to" value={f.departmentId?.ministryName || 'Respected Minister, Government of Karnataka'} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DetailField icon="PersonAdd" label="Submitted by" value={f.createdBy?.name} />
                </Grid>
                <Grid item xs={12}>
                  <DetailField icon="Description" label="Subject" value={f.subject} />
                </Grid>
                <Grid item xs={12}>
                  <DetailField icon="Place" label="Address" value={f.address} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <DetailField icon="Label" label="Letter No" value={f.letterNo} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <DetailField icon="PersonAdd" label="Point Person" value={f.pointPersonName} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <DetailField icon="Mail" label="Number" value={f.pointPersonNumber} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Stack spacing={2}>
        {can(PERMISSIONS.LETTER_EDIT) && (
          <Card sx={{ maxWidth: 480 }}>
            <CardHeader
              avatar={<Icon name="Label" sx={{ color: 'primary.main' }} />}
              title="Letter No & Point Person"
              titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
              action={
                !editing && (
                  <Button
                    size="small"
                    onClick={() => {
                      setLetterNo(f.letterNo ?? '');
                      setPointPersonName(f.pointPersonName ?? '');
                      setPointPersonNumber(f.pointPersonNumber ?? '');
                      setEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                )
              }
            />
            <Divider />
            {editing && (
              <CardContent>
                <TextField fullWidth size="small" label="Letter No" value={letterNo} onChange={(e) => setLetterNo(e.target.value)} sx={{ mb: 1.5 }} />
                <TextField fullWidth size="small" label="Point Person Name" value={pointPersonName} onChange={(e) => setPointPersonName(e.target.value)} sx={{ mb: 1.5 }} />
                <TextField fullWidth size="small" label="Number" value={pointPersonNumber} onChange={(e) => setPointPersonNumber(e.target.value)} sx={{ mb: 1.5 }} />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" disabled={saveDetails.isPending} onClick={() => saveDetails.mutate()}>Save</Button>
                  <Button color="inherit" onClick={() => setEditing(false)}>Cancel</Button>
                </Stack>
              </CardContent>
            )}
          </Card>
        )}

        {can(PERMISSIONS.LETTER_EDIT) && (
          <Card sx={{ maxWidth: 480 }}>
            <CardHeader
              avatar={<Icon name="SwapHoriz" sx={{ color: 'primary.main' }} />}
              title="Track Status"
              titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
            />
            <Divider />
            <CardContent>
              <TextField fullWidth select label="Status" value={status || f.status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 1.5 }}>
                {FUNDING_STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
              </TextField>
              <TextField fullWidth size="small" multiline minRows={2} label="Remark (optional)" value={statusRemark} onChange={(e) => setStatusRemark(e.target.value)} sx={{ mb: 1.5 }} />
              <Button
                variant="contained"
                disabled={setStatusM.isPending || (status || f.status) === f.status}
                onClick={() => setStatusM.mutate(status || f.status)}
              >
                Update status
              </Button>
            </CardContent>
          </Card>
        )}

        {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
          <Card><CardContent><DocumentUploader owner={{ kind: 'funding', id }} onUploaded={refresh} /></CardContent></Card>
        )}
        <Card><CardContent><DocumentList owner={{ kind: 'funding', id }} /></CardContent></Card>

        <Card>
          <CardHeader
            title="History"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
            avatar={<Icon name="History" sx={{ color: 'primary.main' }} />}
          />
          <Divider />
          <CardContent>
            <TimelineView entries={timeline.data ?? []} />
          </CardContent>
        </Card>

        {can(PERMISSIONS.REMARK_ADD) && (
          <Card>
            <CardContent>
              <TextField fullWidth multiline minRows={2} label="Add a remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
              <Button sx={{ mt: 1 }} variant="contained" disabled={!remark || addRemark.isPending} onClick={() => addRemark.mutate()}>Add remark</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent>
            {(remarks.data ?? []).length === 0 && <Typography color="text.secondary">No remarks yet.</Typography>}
            {(remarks.data ?? []).map((rm: any) => (
              <Box key={rm.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">{rm.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {rm.authorName} · {dayjs(rm.createdAt).format('DD MMM YYYY, hh:mm A')}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Stack>

      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </Box>
  );
}
