import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { Icon } from './Icon';
import { useCountUp } from '@/hooks/useCountUp';

export function StatCard({
  label,
  value,
  icon,
  color = '#0B3450',
  loading,
  onClick,
  size = 'default',
}: {
  label: string;
  value?: number | string;
  icon: string;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
  /** 'hero' = larger tile for a bento-grid headline stat. */
  size?: 'default' | 'hero';
}) {
  const numeric = typeof value === 'number' ? value : undefined;
  const animated = useCountUp(numeric);
  const display = numeric != null ? animated : (value ?? 0);
  const hero = size === 'hero';

  return (
    <Card
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default', height: '100%' }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', alignItems: hero ? 'flex-start' : 'center' }}>
        <Stack
          direction={hero ? 'column' : 'row'}
          spacing={hero ? 2.5 : 2}
          alignItems={hero ? 'flex-start' : 'center'}
          sx={{ width: '100%' }}
        >
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ width: hero ? 52 : 44, height: hero ? 52 : 44, borderRadius: 2.5, bgcolor: `${color}1A`, color }}
          >
            <Icon name={icon} fontSize={hero ? 'medium' : 'small'} />
          </Stack>
          <Stack>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={hero ? 88 : 56} height={hero ? 48 : 32} />
            ) : (
              <Typography variant={hero ? 'h4' : 'h5'} fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {display}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
