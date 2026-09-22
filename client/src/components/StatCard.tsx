import { Box, Card, CardContent, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from './Icon';
import { useCountUp } from '@/hooks/useCountUp';

/** Helper to generate smooth SVG path from a series of numbers */
function generateSparkline(data: number[], width = 90, height = 30) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return [x, y];
  });

  const linePath = points.reduce((acc, [x, y], i) => (i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`), '');
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return { linePath, areaPath };
}

export interface StatTrend {
  value: string;
  positive?: boolean;
  neutral?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  color = '#0A2540',
  loading,
  onClick,
  size = 'default',
  trend,
  sparkline,
  sublabel,
  progress,
}: {
  label: string;
  value?: number | string;
  icon: string;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
  /** 'hero' = larger tile for a bento-grid headline stat. */
  size?: 'default' | 'hero';
  trend?: StatTrend;
  sparkline?: number[];
  sublabel?: string;
  progress?: number;
}) {
  const numeric = typeof value === 'number' ? value : undefined;
  const animated = useCountUp(numeric);
  const display = numeric != null ? animated : (value ?? 0);
  const hero = size === 'hero';

  const paths = sparkline && sparkline.length >= 2 ? generateSparkline(sparkline, hero ? 110 : 80, hero ? 36 : 28) : null;
  const sparkId = `spark-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&:hover .stat-icon-badge': {
          transform: 'scale(1.08)',
          boxShadow: `0 4px 14px ${alpha(color, 0.3)}`,
        },
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Stack
          direction={hero ? 'column' : 'row'}
          spacing={hero ? 2 : 1.75}
          alignItems={hero ? 'flex-start' : 'center'}
          justifyContent="space-between"
          sx={{ width: '100%' }}
        >
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Stack
              className="stat-icon-badge"
              alignItems="center"
              justifyContent="center"
              sx={{
                width: hero ? 48 : 42,
                height: hero ? 48 : 42,
                borderRadius: 2.5,
                bgcolor: `${color}18`,
                color,
                transition: 'all .2s ease',
                flexShrink: 0,
              }}
            >
              <Icon name={icon} fontSize={hero ? 'medium' : 'small'} />
            </Stack>
            <Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, fontSize: '0.72rem' }}
              >
                {label}
              </Typography>
              {loading ? (
                <Skeleton width={hero ? 80 : 54} height={hero ? 44 : 30} />
              ) : (
                <Typography variant={hero ? 'h4' : 'h5'} fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, mt: 0.25 }}>
                  {display}
                </Typography>
              )}
            </Stack>
          </Stack>

          {/* Mini Sparkline graph */}
          {paths && !loading && (
            <Box sx={{ width: hero ? 110 : 80, height: hero ? 36 : 28, flexShrink: 0, alignSelf: hero ? 'flex-end' : 'center' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${hero ? 110 : 80} ${hero ? 36 : 28}`} style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <path d={paths.areaPath} fill={`url(#${sparkId})`} />
                <path d={paths.linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Box>
          )}
        </Stack>

        {/* Footer / Trend pill or Progress indicator */}
        {(trend || sublabel || progress != null) && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              {trend && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.75,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      bgcolor: trend.neutral
                        ? 'action.hover'
                        : trend.positive
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                      color: trend.neutral
                        ? 'text.secondary'
                        : trend.positive
                        ? '#059669'
                        : '#DC2626',
                    }}
                  >
                    <Icon
                      name={trend.neutral ? 'Remove' : trend.positive ? 'ArrowUpward' : 'ArrowDownward'}
                      sx={{ fontSize: '0.8rem' }}
                    />
                    {trend.value}
                  </Box>
                  {sublabel && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                      {sublabel}
                    </Typography>
                  )}
                </Stack>
              )}
              {!trend && sublabel && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                  {sublabel}
                </Typography>
              )}
              {progress != null && (
                <Typography variant="caption" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progress}%
                </Typography>
              )}
            </Stack>
            {progress != null && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mt: 0.75,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: `${color}18`,
                  '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
                }}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
