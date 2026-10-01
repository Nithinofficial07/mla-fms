import { useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/layouts/AuthLayout';
import { TrackingResult } from './TrackingResult';
import type { TrackResult } from './trackTypes';

/**
 * Landing page for a scanned file-cover QR code. Public, no login - resolves
 * the signed token fresh against the server on every load, so it always
 * shows the request's current status and full update history, never a
 * snapshot baked into the QR at print time.
 */
export function QrTrackPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();

  const query = useQuery({
    queryKey: ['public', 'qr', token],
    queryFn: () => axios.get<TrackResult>(`/api/public/qr/${token}`).then((r) => r.data),
    retry: false,
  });

  return (
    <AuthLayout title={t('track.title')} subtitle={t('track.qrSubtitle')} maxWidth={560}>
      {query.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }} color="text.secondary">{t('track.fetchingUpdate')}</Typography>
        </Box>
      )}

      {query.isError && (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            {axios.isAxiosError(query.error)
              ? (query.error.response?.data as { message?: string })?.message ?? t('track.qrInvalid')
              : t('track.somethingWrong')}
          </Alert>
          <Button href="/track" variant="outlined" fullWidth>
            {t('track.trackWithFileId')}
          </Button>
        </Box>
      )}

      {query.data && <TrackingResult result={query.data} />}
    </AuthLayout>
  );
}
