import { useParams } from 'react-router-dom';
import { Alert, Box, Card, CardContent, CardHeader, Chip, Divider, Grid, Skeleton, Stack } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { DetailField } from '@/components/DetailField';
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

      <Card sx={{ mb: 2, borderLeft: '4px solid', borderLeftColor: 'secondary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Chip size="small" color="primary" label={f.status} />
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
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Stack spacing={2}>
        {can(PERMISSIONS.DOCUMENT_UPLOAD) && (
          <Card><CardContent><DocumentUploader owner={{ kind: 'funding', id }} onUploaded={refresh} /></CardContent></Card>
        )}
        <Card><CardContent><DocumentList owner={{ kind: 'funding', id }} /></CardContent></Card>
      </Stack>
    </Box>
  );
}
