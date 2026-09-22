import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { Icon } from './Icon';

export function EmptyState({
  icon = 'Inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 2, color: 'text.secondary' }}>
      <Box
        sx={{
          width: 64, height: 64, mx: 'auto', mb: 1.5, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          bgcolor: (t) => `${t.palette.primary.main}14`, color: 'primary.main',
        }}
      >
        <Icon name={icon} sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="h6" sx={{ color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
