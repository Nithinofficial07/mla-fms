import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, MenuItem, Skeleton,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { StatusChip, PriorityChip } from '@/components/chips';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { TimelineView } from '@/components/TimelineView';
import { api, errorMessage } from '@/api/client';
import { openViaApi } from '@/lib/download';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments, useStatuses } from '@/hooks/useOptions';
import { PERMISSIONS } from '@mla/shared';

export function RequestDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [remark, setRemark] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [assignDept, setAssignDept] = useState('');

  const departments = useDepartments();
  const statuses = useStatuses();

  const detail = useQuery({ queryKey: ['requests', 'one', id], queryFn: () => api.get(`/requests/${id}`).then((r) => r.data) });
  const timeline = useQuery({ queryKey: ['requests', id, 'timeline'], queryFn: () => api.get(`/requests/${id}/timeline`).then((r) => r.data) });
  const remarks = useQuery({ queryKey: ['requests', id, 'remarks'], queryFn: () => api.get(`/requests/${id}/remarks`).then((r) => r.data) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['requests', 'one', id] });
    qc.invalidateQueries({ queryKey: ['requests', id, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['requests', id, 'remarks'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks -- stable call order, no conditions
  const useAct = (fn: () => Promise<unknown>, ok: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { enqueueSnackbar(ok, { variant: 'success' }); refresh(); },
      onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
    });

  const addRemark = useAct(() => api.post(`/requests/${id}/remarks`, { body: remark }), 'Remark added');
  const changeStatus = useAct(() => api.post(`/requests/${id}/status`, { toStatusCode: nextStatus, remark: remark || undefined }), 'Status updated');
  const assign = useAct(() => api.post(`/requests/${id}/assign`, { departmentId: assignDept, remark: remark || undefined }), 'Assigned');
  const forward = useAct(() => api.post(`/requests/${id}/forward`, { departmentId: assignDept, remark: remark || undefined }), 'Forwarded');

  const r = detail.data;

  if (detail.isLoading) return <Skeleton variant="rounded" height={400} />;
  if (detail.isError || !r) return <Alert severity="error">Unable to load this request.</Alert>;

  const overdue = r.dueDate && dayjs(r.dueDate).isBefore(dayjs()) && !['COMPLETED', 'CLOSED', 'REJECTED'].includes(r.statusCode);

  return (
    <Box>
      <PageHeader
        title={r.fileId}
        subtitle={r.subject}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Requests', to: '/requests' }, { label: r.fileId }]}
        action={
          <Button
            variant="outlined"
            startIcon={<Icon name="Print" />}
            onClick={() =>
              openViaApi(`/requests/${id}/cover.pdf`).catch((e) =>
                enqueueSnackbar(errorMessage(e, 'Could not open the cover sheet'), { variant: 'error' }),
              )
            }
          >
            Print cover
          </Button>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <StatusChip code={r.statusCode} label={r.statusId?.name} />
        <PriorityChip code={r.priorityId?.code} label={r.priorityId?.name} />
        <Chip size="small" icon={<Icon name="AccountBalance" />} label={r.primaryDepartmentId?.name ?? 'Unassigned'} />
        {r.dueDate && (
          <Chip
            size="small"
            color={overdue ? 'error' : 'default'}
            icon={<Icon name="Event" />}
            label={overdue ? `Overdue by ${dayjs().diff(dayjs(r.dueDate), 'day')} day(s)` : `Due ${dayjs(r.dueDate).format('DD MMM YY')}`}
          />
        )}
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        <Tab label="Overview" />
        <Tab label="Documents" />
        <Tab label="Timeline" />
        <Tab label="Remarks" />
        <Tab label="Actions" />
      </Tabs>

      {tab === 0 && (
        <Card><CardContent>
          <Grid container spacing={2}>
            {[
              ['Request ID', r.requestId],
              ['Applicant', r.applicant?.name],
              ['Mobile', r.applicant?.mobile],
              ['Alternate mobile', r.applicant?.altMobile],
              ['Email', r.applicant?.email],
              ['Address', r.applicant?.address],
              ['Ward', r.location?.wardId?.name],
              ['Address', r.location?.addressText],
              ['Gram Panchayat', r.location?.gramPanchayatId?.name],
              ['Village', r.location?.villageId?.name],
              ['Sub-village', r.location?.subVillageId?.name],
              ['Category', r.categoryId?.name],
              ['Request type', r.requestType],
              ['Created', dayjs(r.createdAt).format('DD MMM YYYY, hh:mm A')],
              ['SLA (days)', r.slaDays],
            ].map(([k, v]) => (
              <Grid item xs={6} sm={4} key={k as string}>
                <Typography variant="caption" color="text.secondary">{k}</Typography>
                <Typography variant="body2" fontWeight={600}>{v ? String(v) : '—'}</Typography>
              </Grid>
            ))}
            <Grid item xs={12}><Divider /></Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Description</Typography>
              <Typography variant="body2">{r.description || '—'}</Typography>
            </Grid>
          </Grid>
        </CardContent></Card>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
            <Card><CardContent><DocumentUploader owner={{ kind: 'request', id }} onUploaded={refresh} /></CardContent></Card>
          )}
          <Card><CardContent><DocumentList owner={{ kind: 'request', id }} /></CardContent></Card>
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
                  {rm.authorName} · {dayjs(rm.createdAt).format('DD MMM YYYY, hh:mm A')} · {rm.kind}
                </Typography>
              </Box>
            ))}
          </CardContent></Card>
        </Stack>
      )}

      {tab === 4 && (
        <Grid container spacing={2}>
          {can(PERMISSIONS.REQUEST_STATUS_CHANGE) && (
            <Grid item xs={12} md={6}>
              <Card><CardContent>
                <Typography variant="subtitle2" gutterBottom>Change status</Typography>
                <TextField fullWidth select label="New status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} sx={{ mb: 1 }}>
                  {(statuses.data ?? []).map((s: any) => <MenuItem key={s.id} value={s.code}>{s.name}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" label="Remark (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} sx={{ mb: 1 }} />
                <Button variant="contained" disabled={!nextStatus || changeStatus.isPending} onClick={() => changeStatus.mutate()}>Update status</Button>
              </CardContent></Card>
            </Grid>
          )}
          {(can(PERMISSIONS.REQUEST_ASSIGN) || can(PERMISSIONS.REQUEST_FORWARD)) && (
            <Grid item xs={12} md={6}>
              <Card><CardContent>
                <Typography variant="subtitle2" gutterBottom>Assign / Forward</Typography>
                <TextField fullWidth select label="Department" value={assignDept} onChange={(e) => setAssignDept(e.target.value)} sx={{ mb: 1 }}>
                  {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={1}>
                  {can(PERMISSIONS.REQUEST_ASSIGN) && (
                    <Button variant="contained" disabled={!assignDept || assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
                  )}
                  {can(PERMISSIONS.REQUEST_FORWARD) && (
                    <Button variant="outlined" disabled={!assignDept || forward.isPending} onClick={() => forward.mutate()}>Forward</Button>
                  )}
                </Stack>
              </CardContent></Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
