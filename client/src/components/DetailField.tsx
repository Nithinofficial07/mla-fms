import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Icon } from './Icon';

/** One icon + label + value row, used across the detail pages' overview cards. */
export function DetailField({ icon, label, value }: { icon?: string; label: string; value?: ReactNode }) {
  const empty = value == null || value === '';
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      {icon && (
        <Box sx={{ color: empty ? 'text.disabled' : 'primary.main', mt: 0.25 }}>
          <Icon name={icon} fontSize="small" />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {typeof value === 'string' || typeof value === 'number' || empty ? (
          <Typography variant="body2" fontWeight={600} color={empty ? 'text.disabled' : 'text.primary'} sx={{ wordBreak: 'break-word' }}>
            {empty ? '—' : value}
          </Typography>
        ) : (
          <Box sx={{ mt: 0.25 }}>{value}</Box>
        )}
      </Box>
    </Stack>
  );
}
