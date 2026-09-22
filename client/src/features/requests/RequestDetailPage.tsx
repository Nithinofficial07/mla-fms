import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, Divider, Grid, MenuItem, Skeleton,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
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

      {/* At-a-glance status strip */}
      <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: overdue ? 'error.main' : 'secondary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
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
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        <Tab icon={<Icon name="Description" />} iconPosition="start" label="Overview" />
        <Tab icon={<Icon name="AttachFile" />} iconPosition="start" label="Documents" />
        <Tab icon={<Icon name="Timeline" />} iconPosition="start" label="Timeline" />
        <Tab icon={<Icon name="Comment" />} iconPosition="start" label="Remarks" />
        {(can(PERMISSIONS.REQUEST_STATUS_CHANGE) || can(PERMISSIONS.REQUEST_ASSIGN) || can(PERMISSIONS.REQUEST_FORWARD)) && (
          <Tab icon={<Icon name="EditNote" />} iconPosition="start" label="Actions" />
        )}
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
                  <DetailField icon="AssignmentInd" label="Request ID" value={r.requestId} />
                  <DetailField icon="PersonAdd" label="Applicant" value={r.applicant?.name} />
                  <DetailField icon="Mail" label="Mobile" value={r.applicant?.mobile} />
                  <DetailField icon="Mail" label="Alternate mobile" value={r.applicant?.altMobile} />
                  <DetailField icon="Mail" label="Email" value={r.applicant?.email} />
                  <DetailField icon="Place" label="Address" value={r.applicant?.address} />
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="Location" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
              <Divider />
              <CardContent>
                <Stack spacing={2}>
                  <DetailField icon="Apartment" label="Ward" value={r.location?.wardId?.name} />
                  <DetailField icon="Cottage" label="Gram Panchayat" value={r.location?.gramPanchayatId?.name} />
                  <DetailField icon="Place" label="Other (not listed)" value={r.location?.otherPlaceName} />
                  <DetailField icon="Place" label="Address" value={r.location?.addressText} />
                  <DetailField icon="Grass" label="Village" value={r.location?.villageId?.name} />
                  <DetailField icon="Spa" label="Sub-village" value={r.location?.subVillageId?.name} />
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ gridColumn: 'span 12' }}>
            <Card>
              <CardHeader title="Classification & Timing" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
              <Divider />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><DetailField icon="Category" label="Category" value={r.categoryId?.name} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="ListAlt" label="Request type" value={r.requestType} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="Event" label="Created" value={dayjs(r.createdAt).format('DD MMM YYYY, hh:mm A')} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="HourglassEmpty" label="SLA (days)" value={r.slaDays} /></Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <DetailField label="Description" value={r.description} />
              </CardContent>
            </Card>
          </Box>
        </Box>
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
              <Card sx={{ height: '100%' }}>
                <CardHeader
                  avatar={<Icon name="SwapHoriz" sx={{ color: 'primary.main' }} />}
                  title="Change status"
                  titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                />
                <Divider />
                <CardContent>
                  <TextField fullWidth select label="New status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} sx={{ mb: 1 }}>
                    {(statuses.data ?? []).map((s: any) => <MenuItem key={s.id} value={s.code}>{s.name}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth size="small" label="Remark (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} sx={{ mb: 1 }} />
                  <Button variant="contained" disabled={!nextStatus || changeStatus.isPending} onClick={() => changeStatus.mutate()}>Update status</Button>
                </CardContent>
              </Card>
            </Grid>
          )}
          {(can(PERMISSIONS.REQUEST_ASSIGN) || can(PERMISSIONS.REQUEST_FORWARD)) && (
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardHeader
                  avatar={<Icon name="Forward" sx={{ color: 'primary.main' }} />}
                  title="Assign / Forward"
                  titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                />
                <Divider />
                <CardContent>
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
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
      </Box>
    </Box>
  );
}
