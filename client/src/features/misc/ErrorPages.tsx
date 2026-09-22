import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';

function Shell({ icon, code, title, message }: { icon: string; code: string; title: string; message: string }) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        p: 2,
        background: 'radial-gradient(1200px 600px at 10% -10%, #dde6ee 0%, transparent 60%), radial-gradient(1000px 500px at 110% 110%, #f3e6c8 0%, transparent 55%), #F4F5F7',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, textAlign: 'center', borderTop: '4px solid', borderTopColor: 'secondary.main' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} alignItems="center">
            <Box
              sx={{
                width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center',
                bgcolor: (t) => `${t.palette.primary.main}1A`, color: 'primary.main',
              }}
            >
              <Icon name={icon} sx={{ fontSize: 34 }} />
            </Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>Error {code}</Typography>
            <Typography variant="h5" fontWeight={800}>{title}</Typography>
            <Typography color="text.secondary">{message}</Typography>
            <Button variant="contained" startIcon={<Icon name="Dashboard" />} onClick={() => navigate('/')} sx={{ mt: 1 }}>
              Go to dashboard
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export const ForbiddenPage = () => (
  <Shell
    icon="Lock"
    code="403"
    title="This area is locked"
    message="Your account doesn't have permission to view this page. If that seems wrong, ask an admin to check your role."
  />
);
export const NotFoundPage = () => (
  <Shell
    icon="SearchOff"
    code="404"
    title="This page wandered off"
    message="Nothing lives at this address. It may have moved, or the link might just be off — try the dashboard instead."
  />
);
