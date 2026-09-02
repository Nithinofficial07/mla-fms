import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { Icon } from './Icon';

export function StatCard({
  label,
  value,
  icon,
  color = '#0b3d91',
  loading,
  onClick,
}: {
  label: string;
  value?: number | string;
  icon: string;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 4, transform: 'translateY(-2px)' } : undefined,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}1A`, color }}
          >
            <Icon name={icon} />
          </Stack>
          <Stack>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={56} height={32} />
            ) : (
              <Typography variant="h5">{value ?? 0}</Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
