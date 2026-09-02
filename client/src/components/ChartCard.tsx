import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, Skeleton } from '@mui/material';

export function ChartCard({
  title,
  loading,
  height = 280,
  children,
}: {
  title: string;
  loading?: boolean;
  height?: number;
  children: ReactNode;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title={title} titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
      <CardContent sx={{ height, pt: 0 }}>
        {loading ? <Skeleton variant="rounded" height={height - 24} /> : children}
      </CardContent>
    </Card>
  );
}
