import { useParams } from 'react-router-dom';
import { Alert, Box, Card, CardContent, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentList } from '@/components/DocumentList';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { PERMISSIONS } from '@mla/shared';

export function FundingDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['funding', 'one', id],
    queryFn: () => api.get(`/funding/${id}`).then((r) => r.data),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['documents'] });

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

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip size="small" color="primary" label={f.status} />
        <Chip size="small" icon={<Icon name="AccountBalance" />} label={f.departmentId?.name ?? 'Unknown department'} />
        <Chip size="small" variant="outlined" label={dayjs(f.createdAt).format('DD MMM YYYY')} />
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Addressed to</Typography>
              <Typography variant="body2" fontWeight={600}>
                {f.departmentId?.ministryName || 'Respected Minister, Government of Karnataka'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Subject</Typography>
              <Typography variant="body2" fontWeight={600}>{f.subject}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Submitted by</Typography>
              <Typography variant="body2" fontWeight={600}>{f.createdBy?.name ?? '—'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Address</Typography>
              <Typography variant="body2">{f.address}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
          <Card><CardContent><DocumentUploader owner={{ kind: 'funding', id }} onUploaded={refresh} /></CardContent></Card>
        )}
        <Card><CardContent><DocumentList owner={{ kind: 'funding', id }} /></CardContent></Card>
      </Stack>
    </Box>
  );
}
