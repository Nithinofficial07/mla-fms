import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Shell({ code, title, message }: { code: string; title: string; message: string }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', textAlign: 'center', p: 3 }}>
      <Box>
        <Typography variant="h2" fontWeight={800} color="primary">{code}</Typography>
        <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{message}</Typography>
        <Button variant="contained" onClick={() => navigate('/')}>Go to dashboard</Button>
      </Box>
    </Box>
  );
}

export const ForbiddenPage = () => (
  <Shell code="403" title="Access denied" message="You don't have permission to view this page." />
);
export const NotFoundPage = () => (
  <Shell code="404" title="Page not found" message="The page you're looking for doesn't exist." />
);
