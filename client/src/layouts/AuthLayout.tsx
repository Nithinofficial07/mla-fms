import type { ReactNode } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: 'radial-gradient(1200px 600px at 10% -10%, #dde6ee 0%, transparent 60%), radial-gradient(1000px 500px at 110% 110%, #f3e6c8 0%, transparent 55%), #F4F5F7',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, boxShadow: '0 24px 60px -24px rgba(11,52,80,0.45)', borderTop: '4px solid', borderTopColor: 'secondary.main' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Box
              component="img"
              src="/favicon.svg"
              alt=""
              sx={{ width: 44, height: 44, borderRadius: 1.5, boxShadow: '0 4px 14px rgba(11,52,80,0.35)' }}
            />
            <Typography variant="h5">{title}</Typography>
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
  );
}
