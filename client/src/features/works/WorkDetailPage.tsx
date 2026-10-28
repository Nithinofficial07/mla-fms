import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, Dialog, Divider, Grid, IconButton, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { PERMISSIONS, WORK_DOC_TYPES, WORK_PHOTO_LIMIT } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
import { useConfirm } from '@/components/ConfirmDialog';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { workLocationLabel } from './workLocationPayload';

interface WorkDocument {
  id: string;
  documentType: string;
  versions: { fileName: string; mimeType: string }[];
}

const signedUrl = (docId: string, download = false) =>
  api.get(`/documents/${docId}/url`, { params: download ? { download: 1 } : undefined }).then((r) => r.data.url as string);

/** One stage's photo grid (Before or After), with add/remove when permitted. */
function PhotoGallery({
  title, docs, canUpload, canDelete, onAdd, onRemove, busy,
}: {
  title: string;
  docs: WorkDocument[];
  canUpload: boolean;
  canDelete: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (doc: WorkDocument) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const urls = useQueries({
    queries: docs.map((d) => ({ queryKey: ['documents', 'url', d.id], queryFn: () => signedUrl(d.id), staleTime: 4 * 60_000 })),
  });
  const remaining = WORK_PHOTO_LIMIT - docs.length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<Icon name="PhotoLibrary" sx={{ color: 'primary.main' }} />}
        title={`${title} (${docs.length}/${WORK_PHOTO_LIMIT})`}
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
        action={
          canUpload && remaining > 0 && (
            <Button size="small" startIcon={<Icon name="Add" />} disabled={busy} onClick={() => inputRef.current?.click()}>Add</Button>
          )
        }
      />
      <Divider />
      <CardContent>
        {docs.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No photos yet.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {docs.map((d, i) => (
              <Box key={d.id} sx={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                {urls[i]?.data ? (
                  <Box
                    component="img" src={urls[i].data} alt={d.versions.at(-1)?.fileName}
                    onClick={() => setZoom(urls[i].data!)}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                  />
                ) : (
                  <Skeleton variant="rectangular" width="100%" height="100%" />
                )}
                {canDelete && (
                  <Tooltip title="Remove photo">
                    <IconButton
                      size="small" onClick={() => onRemove(d)}
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
                    >
                      <Icon name="Delete" fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        )}
        <input
          ref={inputRef} hidden type="file" accept="image/*" multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, remaining);
            e.target.value = '';
            if (files.length) onAdd(files);
          }}
        />
      </CardContent>
      <Dialog open={!!zoom} onClose={() => setZoom(null)} maxWidth="lg">
        {zoom && <Box component="img" src={zoom} alt="" sx={{ maxWidth: '100%', maxHeight: '85vh', display: 'block' }} />}
      </Dialog>
    </Card>
  );
}

export function WorkDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const estimationRef = useRef<HTMLInputElement>(null);

  const detail = useQuery({ queryKey: ['works', 'one', id], queryFn: () => api.get(`/works/${id}`).then((r) => r.data) });
  const docs = useQuery({
    queryKey: ['documents', 'work', id],
    queryFn: () => api.get<WorkDocument[]>(`/documents/work/${id}`).then((r) => r.data),
  });

  const refreshDocs = () => qc.invalidateQueries({ queryKey: ['documents', 'work', id] });

  const upload = useMutation({
    mutationFn: ({ documentType, files }: { documentType: string; files: File[] }) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('documentType', documentType);
      return api.post(`/documents/work/${id}`, fd);
    },
    onSuccess: () => { enqueueSnackbar('Uploaded', { variant: 'success' }); refreshDocs(); },
    onError: (e) => enqueueSnackbar(errorMessage(e, 'Upload failed'), { variant: 'error' }),
  });

  const removeDoc = useMutation({
    mutationFn: (docId: string) => api.delete(`/documents/${docId}`),
    onSuccess: () => { enqueueSnackbar('Removed', { variant: 'success' }); refreshDocs(); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const removeWork = useMutation({
    mutationFn: () => api.delete(`/works/${id}`),
    onSuccess: () => {
      enqueueSnackbar('Work deleted', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['works'] });
      navigate('/works');
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const w = detail.data;
  if (detail.isLoading) return <Skeleton variant="rounded" height={400} />;
  if (detail.isError || !w) return <Alert severity="error">Unable to load this work.</Alert>;

  const all = docs.data ?? [];
  const ofType = (t: string) => all.filter((d) => d.documentType === t);
  const estimation = ofType(WORK_DOC_TYPES.ESTIMATION)[0];
  const canUpload = can(PERMISSIONS.WORK_EDIT) && can(PERMISSIONS.DOCUMENT_UPLOAD);
  const canDeleteDoc = can(PERMISSIONS.WORK_EDIT) && can(PERMISSIONS.DOCUMENT_DELETE);

  const confirmRemoveDoc = async (doc: WorkDocument) => {
    if (await confirm({ title: 'Remove this file?', message: doc.versions.at(-1)?.fileName ?? '', confirmLabel: 'Remove', destructive: true })) {
      removeDoc.mutate(doc.id);
    }
  };
  const confirmDeleteWork = async () => {
    if (await confirm({ title: `Delete ${w.workId}?`, message: 'The work will be removed from the list.', confirmLabel: 'Delete', destructive: true })) {
      removeWork.mutate();
    }
  };
  const replaceEstimation = async (file: File) => {
    // Upload the new copy first so a failed upload never leaves the work without one.
    await upload.mutateAsync({ documentType: WORK_DOC_TYPES.ESTIMATION, files: [file] });
    if (estimation) removeDoc.mutate(estimation.id);
  };

  const agency = w.implementingAgency === 'Other' ? w.implementingAgencyOther || 'Other' : w.implementingAgency;
  const l = w.location ?? {};

  return (
    <Box>
      <PageHeader
        title={w.workId}
        subtitle={w.nameOfWork}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Works', to: '/works' }, { label: w.workId }]}
        action={
          <Stack direction="row" spacing={1}>
            {can(PERMISSIONS.WORK_EDIT) && (
              <Button variant="outlined" startIcon={<Icon name="EditNote" />} onClick={() => navigate(`/works/${id}/edit`)}>Edit</Button>
            )}
            {can(PERMISSIONS.WORK_DELETE) && (
              <Button variant="outlined" color="error" startIcon={<Icon name="Delete" />} disabled={removeWork.isPending} onClick={confirmDeleteWork}>
                Delete
              </Button>
            )}
          </Stack>
        }
      />

      <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'secondary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Chip size="small" color={w.thirdPartyInspection === 'Completed' ? 'success' : 'default'} label={`TPI: ${w.thirdPartyInspection}`} />
            <Chip size="small" icon={<Icon name="Event" />} label={w.fundingYear} />
            <Chip size="small" icon={<Icon name="AccountBalance" />} label={w.departmentId?.name ?? 'Unknown department'} />
            <Chip size="small" variant="outlined" label={`Added ${dayjs(w.createdAt).format('DD MMM YYYY')}`} />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardHeader
          avatar={<Icon name="Construction" sx={{ color: 'primary.main' }} />}
          title="Work Details"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}><DetailField icon="Description" label="Name of Work" value={w.nameOfWork} /></Grid>
            <Grid item xs={12} sm={6}><DetailField icon="AccountBalance" label="Department" value={w.departmentId?.name} /></Grid>
            <Grid item xs={12} sm={6}><DetailField icon="Business" label="Implementing Agency" value={agency} /></Grid>
            <Grid item xs={12} sm={6}><DetailField icon="Person" label="Agency Inspector" value={w.agencyInspectorName} /></Grid>
            <Grid item xs={12} sm={6}>
              <DetailField
                icon="Phone" label="Agency Inspector Contact"
                value={w.agencyInspectorContact ? <a href={`tel:${w.agencyInspectorContact}`}>{w.agencyInspectorContact}</a> : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}><DetailField icon="AttachMoney" label="Funding Source" value={w.fundingSource} /></Grid>
            <Grid item xs={12} sm={6}><DetailField icon="Event" label="Year of Funding" value={w.fundingYear} /></Grid>
            <Grid item xs={12} sm={6}>
              <DetailField icon="AttachMoney" label="Amount" value={`₹ ${Number(w.amountLakhs).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Lakhs`} />
            </Grid>
            <Grid item xs={12} sm={6}><DetailField icon="TaskAlt" label="Third Party Inspection" value={w.thirdPartyInspection} /></Grid>
            <Grid item xs={12} sm={6}><DetailField icon="Person" label="TPI Officer" value={w.tpiOfficerName} /></Grid>
            <Grid item xs={12} sm={6}>
              <DetailField
                icon="Phone" label="TPI Officer Contact"
                value={w.tpiOfficerContact ? <a href={`tel:${w.tpiOfficerContact}`}>{w.tpiOfficerContact}</a> : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}><DetailField icon="Person" label="Engineer" value={w.engineerName} /></Grid>
            <Grid item xs={12} sm={6}>
              <DetailField icon="Phone" label="Engineer Contact" value={w.engineerContact ? <a href={`tel:${w.engineerContact}`}>{w.engineerContact}</a> : undefined} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField
                icon="Place"
                label={l.locationType === 'CITY' ? 'Ward (City)' : l.locationType === 'GP' ? 'Gram Panchayat / Village' : 'SH / MDR'}
                value={[workLocationLabel(l), l.subVillageId?.name].filter(Boolean).join(' / ')}
              />
            </Grid>
            <Grid item xs={12}><DetailField icon="Home" label="Address" value={w.address} /></Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardHeader
          avatar={<Icon name="PictureAsPdf" sx={{ color: 'primary.main' }} />}
          title="Estimation Copy"
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          action={
            canUpload && (
              <Button size="small" startIcon={<Icon name="UploadFile" />} disabled={upload.isPending} onClick={() => estimationRef.current?.click()}>
                {estimation ? 'Replace' : 'Upload'}
              </Button>
            )
          }
        />
        <Divider />
        <CardContent>
          {estimation ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{estimation.versions.at(-1)?.fileName}</Typography>
              <Button size="small" startIcon={<Icon name="Visibility" />} onClick={async () => window.open(await signedUrl(estimation.id), '_blank')}>View</Button>
              <Button size="small" startIcon={<Icon name="Download" />} onClick={async () => window.open(await signedUrl(estimation.id, true), '_blank')}>Download</Button>
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">Not uploaded yet.</Typography>
          )}
          <input
            ref={estimationRef} hidden type="file" accept="application/pdf,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) replaceEstimation(f).catch(() => undefined); }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {[
          { title: 'Before Work Photos', type: WORK_DOC_TYPES.BEFORE_PHOTO },
          { title: 'After Work Photos', type: WORK_DOC_TYPES.AFTER_PHOTO },
        ].map((s) => (
          <Grid item xs={12} md={6} key={s.type}>
            <PhotoGallery
              title={s.title}
              docs={ofType(s.type)}
              canUpload={canUpload}
              canDelete={canDeleteDoc}
              busy={upload.isPending}
              onAdd={(files) => upload.mutate({ documentType: s.type, files })}
              onRemove={confirmRemoveDoc}
            />
          </Grid>
        ))}
      </Grid>
      {dialog}
    </Box>
  );
}
