import { Box, Card, CardContent, Chip, Grid, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/app/AuthProvider';

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Box>
      <PageHeader title="My Profile" crumbs={[{ label: 'Home', to: '/' }, { label: 'Profile' }]} />
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Row k="Name" v={user.name} />
                <Row k="Username" v={user.username} />
                <Row k="Email" v={user.email} />
                <Row k="Role" v={user.roleCode} />
                <Row k="Department" v={user.departmentId ?? '—'} />
              </Stack>
              <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/change-password')}>
                Change password
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Permissions ({user.permissions.length})</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {user.permissions.map((p) => <Chip key={p} size="small" label={p} />)}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{k}</Typography>
      <Typography variant="body2" fontWeight={600}>{v}</Typography>
    </Box>
  );
}
