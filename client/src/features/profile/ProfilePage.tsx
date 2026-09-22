import { Avatar, Box, Button, Card, CardContent, CardHeader, Chip, Divider, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { RoleCode } from '@mla/shared';
import { SYSTEM_ROLE_DESCRIPTIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments } from '@/hooks/useOptions';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MLA: 'MLA',
  DEPARTMENT_OFFICER: 'Department Officer',
  DATA_ENTRY_OPERATOR: 'Data Entry Operator',
  VIEWER: 'Viewer',
  REQUEST_DESK: 'Request Desk',
};

/** Groups permission strings like REQUEST_VIEW / DOCUMENT_UPLOAD by their resource prefix. */
function groupPermissions(perms: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const p of perms) {
    const key = p.split('_')[0]!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const departments = useDepartments();
  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.roleCode] ?? user.roleCode;
  const departmentName = departments.data?.find((d) => d.id === user.departmentId)?.name;
  const initial = user.name?.[0]?.toUpperCase() ?? '?';

  return (
    <Box>
      <PageHeader title="My Profile" crumbs={[{ label: 'Home', to: '/' }, { label: 'Profile' }]} />

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {/* Header card - identity at a glance */}
        <Box sx={{ gridColumn: 'span 12' }}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 28, fontWeight: 800 }}>
                  {initial}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5" fontWeight={800}>{user.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" color="secondary" label={roleLabel} />
                    {departmentName && <Chip size="small" variant="outlined" icon={<Icon name="AccountBalance" />} label={departmentName} />}
                  </Stack>
                </Box>
                <Button variant="outlined" startIcon={<Icon name="EditNote" />} onClick={() => navigate('/change-password')}>
                  Change password
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Account details */}
        <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Account" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
            <Divider />
            <CardContent>
              <Stack spacing={2}>
                <Detail icon="AssignmentInd" label="Username" value={user.username} />
                <Detail icon="Mail" label="Email" value={user.email} />
                <Detail icon="AdminPanelSettings" label="Role" value={roleLabel} />
                <Detail icon="AccountBalance" label="Department" value={departmentName ?? 'Not assigned to a department'} />
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* What this role can do */}
        <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="About this role" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {SYSTEM_ROLE_DESCRIPTIONS[user.roleCode as RoleCode] ?? 'Custom role — permissions are set individually.'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'} granted — see below.
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Permissions, grouped by resource */}
        <Box sx={{ gridColumn: 'span 12' }}>
          <Card>
            <CardHeader
              title="Permissions"
              subheader={`${user.permissions.length} total`}
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
            />
            <Divider />
            <CardContent>
              <Stack spacing={2}>
                {groupPermissions(user.permissions).map(([group, perms]) => (
                  <Box key={group}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      {group}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {perms.map((p) => <Chip key={p} size="small" variant="outlined" label={p} />)}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: 'primary.main', mt: 0.25 }}>
        <Icon name={icon} fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{value}</Typography>
      </Box>
    </Stack>
  );
}
