import type { ReactNode } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CivicIllustration } from '@/components/illustrations/Illustrations';

const TAGLINES = [
  'Every request tracked, from submission to resolution.',
  'One office, one file room, zero paper trail lost.',
  'Constituents can watch their request move in real time.',
];

export function AuthLayout({
  title,
  subtitle,
  children,
  maxWidth = 420,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Wider cards (e.g. the public tracking page, which shows a result + timeline) can override this. */
  maxWidth?: number;
}) {
  const { palette } = useTheme();
  const isDark = palette.mode === 'dark';
  const navy = isDark ? '#0B1420' : '#0B3450';
  const navy2 = isDark ? '#152238' : '#134169';

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 460px) 1fr' },
      }}
    >
      {/* Brand panel — hidden on mobile, sets the civic tone for every auth-adjacent screen */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: `radial-gradient(900px 500px at -10% -10%, ${alpha('#D4A017', 0.18)} 0%, transparent 55%), linear-gradient(160deg, ${navy} 0%, ${navy2} 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box component="img" src="/favicon.svg" alt="" sx={{ width: 36, height: 36, borderRadius: 1.25, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }} />
          <Typography variant="subtitle1" fontWeight={800}>MLA File Management System</Typography>
        </Stack>

        <Box sx={{ alignSelf: 'center', my: 4, opacity: 0.95 }}>
          <CivicIllustration size={300} />
        </Box>

        <Stack spacing={1.5}>
          {TAGLINES.map((t) => (
            <Stack key={t} direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main', mt: 0.9, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.85) }}>{t}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          p: 2,
          bgcolor: 'background.default',
          backgroundImage: {
            xs: `radial-gradient(1200px 600px at 10% -10%, ${alpha(navy, 0.08)} 0%, transparent 60%), radial-gradient(1000px 500px at 110% 110%, ${alpha('#D4A017', 0.12)} 0%, transparent 55%)`,
            md: 'none',
          },
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth,
            boxShadow: { xs: '0 24px 60px -24px rgba(11,52,80,0.45)', md: 'none' },
            border: { md: 'none' },
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Box
                component="img"
                src="/favicon.svg"
                alt=""
                sx={{ width: 44, height: 44, borderRadius: 1.5, boxShadow: '0 4px 14px rgba(11,52,80,0.35)', display: { md: 'none' } }}
              />
              <Typography variant="h5" fontWeight={800}>{title}</Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Stack>
            {children}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
