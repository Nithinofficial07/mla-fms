import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { api } from '@/api/client';

/** Landing page for a scanned QR code: resolves the token then redirects. */
export function FileResolvePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get(`/requests/resolve/${token}`)
      .then(({ data }) => navigate(`/requests/${data.id}`, { replace: true }))
      .catch(() => navigate('/404', { replace: true }));
  }, [token, navigate]);

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
      <CircularProgress />
      <Typography sx={{ mt: 2 }} color="text.secondary">Opening file…</Typography>
    </Box>
  );
}
