import { useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, CardHeader, Divider,
  Grid, IconButton, MenuItem, Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
import { StatusChip, PriorityChip } from '@/components/chips';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { TimelineView } from '@/components/TimelineView';
import { Confetti } from '@/components/Confetti';
import { api, errorMessage } from '@/api/client';
import { openViaApi } from '@/lib/download';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments, useStatuses } from '@/hooks/useOptions';
import { PERMISSIONS } from '@mla/shared';

const CELEBRATE_STATUSES = ['COMPLETED', 'APPROVED', 'CLOSED'];

const MILESTONES = [
  { key: 'submitted', label: 'Registered', icon: 'NoteAdd' },
  { key: 'scrutiny', label: 'Office Scrutiny', icon: 'HourglassEmpty' },
  { key: 'assigned', label: 'Dept Assigned', icon: 'AssignmentInd' },
  { key: 'action', label: 'Action in Progress', icon: 'Autorenew' },
  { key: 'resolved', label: 'Resolved', icon: 'CheckCircle' },
];

interface DocRow {
  id: string;
}

/** Shows the document list once something's uploaded; otherwise leads straight with the scan/photo uploader. */
function DocumentsSection({ id, canUpload, onUploaded }: { id: string; canUpload: boolean; onUploaded: () => void }) {
  const [showUploader, setShowUploader] = useState(false);
  const docs = useQuery({
    queryKey: ['documents', 'request', id],
    queryFn: () => api.get<DocRow[]>(`/documents/request/${id}`).then((r) => r.data),
  });

  if (docs.isLoading) return <Skeleton variant="rounded" height={160} />;

  const hasDocs = (docs.data ?? []).length > 0;

  if (!hasDocs) {
    return canUpload ? (
      <Card>
        <CardHeader
          title="Scan or Upload the First Document"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          avatar={<Icon name="CloudUpload" sx={{ color: 'primary.main' }} />}
        />
        <Divider />
        <CardContent>
          <DocumentUploader owner={{ kind: 'request', id }} onUploaded={onUploaded} />
        </CardContent>
      </Card>
    ) : (
      <DocumentList owner={{ kind: 'request', id }} />
    );
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardHeader
          title="Document Dossier"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          action={
            canUpload && (
              <Button size="small" startIcon={<Icon name={showUploader ? 'Close' : 'Add'} />} onClick={() => setShowUploader((s) => !s)}>
                {showUploader ? 'Close' : 'Add more'}
              </Button>
            )
          }
        />
        <Divider />
        <CardContent>
          <DocumentList owner={{ kind: 'request', id }} />
        </CardContent>
      </Card>
      {showUploader && canUpload && (
        <Card>
          <CardHeader
            title="Scan or Upload Another Document"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
            avatar={<Icon name="CloudUpload" sx={{ color: 'primary.main' }} />}
          />
          <Divider />
          <CardContent>
            <DocumentUploader owner={{ kind: 'request', id }} onUploaded={onUploaded} />
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function getMilestoneIndex(code: string): number {
  switch (code) {
    case 'DRAFT':
    case 'SUBMITTED':
      return 0;
    case 'UNDER_REVIEW':
    case 'AWAITING_INFO':
      return 1;
    case 'ASSIGNED':
      return 2;
    case 'IN_PROGRESS':
    case 'FORWARDED':
    case 'DEPT_RESPONSE':
      return 3;
    case 'COMPLETED':
    case 'APPROVED':
    case 'CLOSED':
      return 4;
    default:
      return 0;
  }
}

/**
 * The full request dossier: milestone stepper, tabbed workspace (activity,
 * documents, petition details, workflow actions) and a sticky applicant /
 * location sidebar. Used both as the routed detail page and embedded in
 * `RequestDetailDialog` - pass `onClose` only for the dialog case, which
 * swaps the internal header's own title/actions for a close button.
 *
 * `compact` (used by the dialog) drops the Documents / Petition Details /
 * Workflow Actions tabs entirely, leaving just Activity & Notes - the
 * routed page always gets the full tab set.
 */
export function RequestDetailContent({ id, onClose, compact }: { id: string; onClose?: () => void; compact?: boolean }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [remark, setRemark] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [assignDept, setAssignDept] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  const departments = useDepartments();
  const statuses = useStatuses();

  const detail = useQuery({ queryKey: ['requests', 'one', id], queryFn: () => api.get(`/requests/${id}`).then((r) => r.data) });
  const timeline = useQuery({ queryKey: ['requests', id, 'timeline'], queryFn: () => api.get(`/requests/${id}/timeline`).then((r) => r.data) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['requests', 'one', id] });
    qc.invalidateQueries({ queryKey: ['requests', id, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['requests', id, 'remarks'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const useAct = (fn: () => Promise<unknown>, ok: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { enqueueSnackbar(ok, { variant: 'success' }); refresh(); },
      onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
    });

  const addRemark = useMutation({
    mutationFn: () => api.post(`/requests/${id}/remarks`, { body: remark }),
    onSuccess: () => {
      enqueueSnackbar('Remark added successfully', { variant: 'success' });
      setRemark('');
      refresh();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const changeStatus = useMutation({
    mutationFn: () => api.post(`/requests/${id}/status`, { toStatusCode: nextStatus, remark: remark || undefined }),
    onSuccess: () => {
      enqueueSnackbar('Status updated successfully', { variant: 'success' });
      if (CELEBRATE_STATUSES.includes(nextStatus)) setCelebrate(true);
      setRemark('');
      refresh();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const assign = useAct(() => api.post(`/requests/${id}/assign`, { departmentId: assignDept, remark: remark || undefined }), 'Assigned to department');
  const forward = useAct(() => api.post(`/requests/${id}/forward`, { departmentId: assignDept, remark: remark || undefined }), 'Forwarded to department');

  const r = detail.data;

  if (detail.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (detail.isError || !r) return <Alert severity="error">Unable to load this request.</Alert>;

  const overdue = r.dueDate && dayjs(r.dueDate).isBefore(dayjs()) && !['COMPLETED', 'CLOSED', 'REJECTED'].includes(r.statusCode);
  const isRejected = r.statusCode === 'REJECTED';
  const currentStep = getMilestoneIndex(r.statusCode);

  const cleanMobile = r.applicant?.mobile?.replace(/\D/g, '') ?? '';
  const waUrl = cleanMobile ? `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(`Namaste ${r.applicant?.name}, regarding your MLA file ${r.fileId}: `)}` : '';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={800} sx={{ wordBreak: 'break-word' }}>{r.fileId}</Typography>
          <Typography variant="body2" color="text.secondary">{r.subject}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Icon name="Print" />}
            onClick={() =>
              openViaApi(`/requests/${id}/cover.pdf`).catch((e) =>
                enqueueSnackbar(errorMessage(e, 'Could not open the cover sheet'), { variant: 'error' }),
              )
            }
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Print Cover Sheet
          </Button>
          {!compact && (can(PERMISSIONS.REQUEST_STATUS_CHANGE) || can(PERMISSIONS.REQUEST_ASSIGN)) && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Icon name="EditNote" />}
              onClick={() => setTab(3)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Action File
            </Button>
          )}
          {onClose && (
            <IconButton onClick={onClose}>
              <Icon name="Close" />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* Visual Milestone Stepper Header */}
      {!isRejected ? (
        <Card sx={{ mb: 2.5, p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflowX: 'auto', pb: { xs: 1, sm: 0 } }}>
            {MILESTONES.map((m, idx) => {
              const isPassed = currentStep > idx;
              const isCurrent = currentStep === idx;
              const stepColor = isPassed ? '#059669' : isCurrent ? '#2563EB' : 'text.disabled';

              return (
                <Stack key={m.key} direction="row" alignItems="center" sx={{ flexGrow: 1, minWidth: 120 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: isPassed
                          ? 'rgba(16, 185, 129, 0.15)'
                          : isCurrent
                          ? 'rgba(37, 99, 235, 0.15)'
                          : 'action.hover',
                        color: stepColor,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        border: '1.5px solid',
                        borderColor: isPassed ? '#059669' : isCurrent ? '#2563EB' : 'divider',
                        animation: isCurrent ? 'pulseGlow 2s infinite ease-in-out' : 'none',
                      }}
                    >
                      <Icon name={isPassed ? 'CheckCircle' : m.icon} fontSize="small" />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        fontWeight={isCurrent ? 700 : 600}
                        color={isCurrent ? 'text.primary' : isPassed ? 'success.main' : 'text.secondary'}
                        noWrap
                      >
                        {m.label}
                      </Typography>
                      {isCurrent && (
                        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', color: 'primary.main', fontWeight: 700 }}>
                          Current Stage
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  {idx < MILESTONES.length - 1 && (
                    <Box
                      sx={{
                        flexGrow: 1,
                        height: 2,
                        mx: 1.5,
                        bgcolor: isPassed ? '#059669' : 'divider',
                        minWidth: 24,
                      }}
                    />
                  )}
                </Stack>
              );
            })}
          </Box>
        </Card>
      ) : (
        <Alert severity="error" icon={<Icon name="Cancel" />} sx={{ mb: 2.5, borderRadius: 2 }}>
          This petition has been marked as <strong>REJECTED / INELIGIBLE</strong>.
        </Alert>
      )}

      {/* Two-Column Master Dossier Layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 2.5, alignItems: 'start' }}>
        {/* Left Column: Dossier Workspace (Timeline, Documents, Details, Actions) */}
        <Box sx={{ minWidth: 0 }}>
          {!compact && (
            <Tabs
              value={tab}
              onChange={(_e, v) => setTab(v)}
              variant="scrollable"
              sx={{
                mb: 2,
                bgcolor: 'background.paper',
                p: 0.5,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Tab icon={<Icon name="Timeline" />} iconPosition="start" label="Activity & Notes" />
              <Tab icon={<Icon name="AttachFile" />} iconPosition="start" label="Attached Documents" />
              <Tab icon={<Icon name="Description" />} iconPosition="start" label="Petition Details" />
              {(can(PERMISSIONS.REQUEST_STATUS_CHANGE) || can(PERMISSIONS.REQUEST_ASSIGN) || can(PERMISSIONS.REQUEST_FORWARD)) && (
                <Tab icon={<Icon name="EditNote" />} iconPosition="start" label="Workflow Actions" />
              )}
            </Tabs>
          )}

          {/* TAB 0: Activity Feed & Remarks */}
          {(compact || tab === 0) && (() => {
            const remarkComposer = can(PERMISSIONS.REMARK_ADD) && (
              <Card>
                <CardContent sx={{ pb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                      ✍️
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        placeholder="Record an official caseworker note, phone call record, or departmental update…"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        size="small"
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!remark.trim() || addRemark.isPending}
                          onClick={() => addRemark.mutate()}
                          startIcon={<Icon name="Send" />}
                        >
                          Add Note
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );

            const timelineCard = (
              <Card>
                <CardHeader
                  title="Constituency File History & Audit Trail"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                  avatar={<Icon name="History" sx={{ color: 'primary.main' }} />}
                />
                <Divider />
                <CardContent>
                  <TimelineView entries={timeline.data ?? []} />
                </CardContent>
              </Card>
            );

            return (
            <Stack spacing={2}>
              {/* Routed page keeps its original order; the dialog reorders everything below */}
              {!compact && remarkComposer}
              {!compact && timelineCard}

              {/* Photos / scanned documents - shown inline since the dialog has no separate Documents tab */}
              {compact && (
                <DocumentsSection id={id} canUpload={can(PERMISSIONS.DOCUMENT_UPLOAD)} onUploaded={refresh} />
              )}

              {/* Assign department - last, since the dialog has no separate Workflow Actions tab */}
              {compact && can(PERMISSIONS.REQUEST_ASSIGN) && (
                <Card>
                  <CardHeader
                    avatar={<Icon name="Forward" sx={{ color: 'primary.main' }} />}
                    title="Assign Department"
                    titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                  />
                  <Divider />
                  <CardContent>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Department"
                        value={assignDept}
                        onChange={(e) => setAssignDept(e.target.value)}
                      >
                        {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                      </TextField>
                      <Button variant="contained" disabled={!assignDept || assign.isPending} onClick={() => assign.mutate()}>
                        Assign
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Note composer, then activity history - last in the dialog */}
              {compact && remarkComposer}
              {compact && timelineCard}
            </Stack>
            );
          })()}

          {/* TAB 1: Attached Documents */}
          {!compact && tab === 1 && (
            <DocumentsSection id={id} canUpload={can(PERMISSIONS.DOCUMENT_UPLOAD)} onUploaded={refresh} />
          )}

          {/* TAB 2: Petition Details */}
          {!compact && tab === 2 && (
            <Card>
              <CardHeader
                title="Grievance / Request Subject & Background"
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
              />
              <Divider />
              <CardContent>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 3, lineHeight: 1.6 }}>
                  {r.description || 'No detailed description provided.'}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><DetailField icon="Category" label="Category" value={r.categoryId?.name} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="ListAlt" label="Request Type" value={r.requestType} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="Event" label="Filed Date" value={dayjs(r.createdAt).format('DD MMM YYYY, hh:mm A')} /></Grid>
                  <Grid item xs={6} sm={3}><DetailField icon="HourglassEmpty" label="SLA Target" value={r.slaDays ? `${r.slaDays} Days` : 'Standard'} /></Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: Workflow Actions */}
          {!compact && tab === 3 && (
            <Grid container spacing={2}>
              {can(PERMISSIONS.REQUEST_STATUS_CHANGE) && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardHeader
                      avatar={<Icon name="SwapHoriz" sx={{ color: 'primary.main' }} />}
                      title="Update Workflow Stage"
                      titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                    />
                    <Divider />
                    <CardContent>
                      <TextField
                        fullWidth
                        select
                        label="New Workflow Status"
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value)}
                        sx={{ mb: 1.5 }}
                      >
                        {(statuses.data ?? []).map((s: any) => <MenuItem key={s.id} value={s.code}>{s.name}</MenuItem>)}
                      </TextField>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label="Reason / Remark (Optional)"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <Button
                        variant="contained"
                        disabled={!nextStatus || changeStatus.isPending}
                        onClick={() => changeStatus.mutate()}
                      >
                        Commit Status Change
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              {(can(PERMISSIONS.REQUEST_ASSIGN) || can(PERMISSIONS.REQUEST_FORWARD)) && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardHeader
                      avatar={<Icon name="Forward" sx={{ color: 'primary.main' }} />}
                      title="Department Assignment & Forward"
                      titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                    />
                    <Divider />
                    <CardContent>
                      <TextField
                        fullWidth
                        select
                        label="Line Department"
                        value={assignDept}
                        onChange={(e) => setAssignDept(e.target.value)}
                        sx={{ mb: 1.5 }}
                      >
                        {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                      </TextField>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label="Instructions to Officer"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <Stack direction="row" spacing={1}>
                        {can(PERMISSIONS.REQUEST_ASSIGN) && (
                          <Button variant="contained" disabled={!assignDept || assign.isPending} onClick={() => assign.mutate()}>
                            Assign Primary
                          </Button>
                        )}
                        {can(PERMISSIONS.REQUEST_FORWARD) && (
                          <Button variant="outlined" disabled={!assignDept || forward.isPending} onClick={() => forward.mutate()}>
                            Forward Copy
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </Box>

        {/* Right Sticky Column: Inspector & Contact Card */}
        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 16 }}>
          {/* Status & Priority Badge Card */}
          <Card sx={{ borderLeft: '4px solid', borderLeftColor: overdue ? 'error.main' : 'primary.main' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <StatusChip code={r.statusCode} label={r.statusId?.name} />
                <PriorityChip code={r.priorityId?.code} label={r.priorityId?.name} />
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Responsible Department</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {r.primaryDepartmentId?.name ?? 'Unassigned'}
                  </Typography>
                </Box>
                {r.dueDate && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">SLA Resolution Target</Typography>
                    <Typography variant="body2" fontWeight={700} color={overdue ? 'error.main' : 'text.primary'}>
                      {overdue ? `Overdue by ${dayjs().diff(dayjs(r.dueDate), 'day')} day(s)` : dayjs(r.dueDate).format('DD MMM YYYY')}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Applicant & Citizen Contact Card */}
          <Card>
            <CardHeader
              title="Applicant Profile"
              titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
              avatar={<Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32, fontSize: '0.85rem' }}>{r.applicant?.name?.[0] ?? 'C'}</Avatar>}
            />
            <Divider />
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body1" fontWeight={700}>{r.applicant?.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {r.applicant?.mobile || 'No phone recorded'}
              </Typography>

              {cleanMobile && (
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button
                    component="a"
                    href={`tel:${cleanMobile}`}
                    size="small"
                    variant="outlined"
                    fullWidth
                    startIcon={<Icon name="Phone" />}
                  >
                    Call
                  </Button>
                  <Button
                    component="a"
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    size="small"
                    variant="outlined"
                    color="success"
                    fullWidth
                    startIcon={<Icon name="Send" />}
                  >
                    WhatsApp
                  </Button>
                </Stack>
              )}

              <Stack spacing={1} sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                {r.applicant?.email && <DetailField icon="Mail" label="Email" value={r.applicant.email} />}
                {r.applicant?.address && <DetailField icon="Place" label="Applicant Address" value={r.applicant.address} />}
                {r.applicant?.idType && (
                  <DetailField icon="AssignmentInd" label={r.applicant.idType} value={r.applicant.idNumber} />
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Location Hierarchy Card */}
          <Card>
            <CardHeader
              title="Constituency Location"
              titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
              avatar={<Icon name="Place" sx={{ color: 'primary.main' }} />}
            />
            <Divider />
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1}>
                {r.location?.wardId && <DetailField icon="Apartment" label="Ward" value={r.location.wardId.name} />}
                {r.location?.gramPanchayatId && <DetailField icon="Cottage" label="Gram Panchayat" value={r.location.gramPanchayatId.name} />}
                {r.location?.villageId && <DetailField icon="Grass" label="Village" value={r.location.villageId.name} />}
                {r.location?.subVillageId && <DetailField icon="Spa" label="Sub-Village / Hamlet" value={r.location.subVillageId.name} />}
                {r.location?.otherPlaceName && <DetailField icon="Place" label="Other Place" value={r.location.otherPlaceName} />}
                {r.location?.addressText && <DetailField icon="Place" label="Incident Address" value={r.location.addressText} />}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </Box>
  );
}
