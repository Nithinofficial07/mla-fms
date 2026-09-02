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
        background: 'radial-gradient(1200px 600px at 10% -10%, #dbe6ff 0%, transparent 60%), radial-gradient(1000px 500px at 110% 110%, #d7f2ee 0%, transparent 55%), #f4f6fb',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, boxShadow: '0 20px 50px -20px rgba(11,61,145,0.35)' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Box
              component="img"
              src="/favicon.svg"
              alt=""
              sx={{ width: 44, height: 44 }}
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
