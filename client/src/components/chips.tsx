import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9e9e9e', SUBMITTED: '#1976d2', UNDER_REVIEW: '#0288d1', ASSIGNED: '#7b1fa2',
  FORWARDED: '#5e35b1', IN_PROGRESS: '#ed6c02', AWAITING_INFO: '#fbc02d', DEPT_RESPONSE: '#00897b',
  APPROVED: '#2e7d32', COMPLETED: '#388e3c', REJECTED: '#c62828', CLOSED: '#455a64',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#2e7d32', MEDIUM: '#ed6c02', HIGH: '#d32f2f', URGENT: '#7b1fa2',
};

export function StatusChip({ code, label }: { code?: string; label?: string }) {
  const c = STATUS_COLORS[code ?? ''] ?? '#607d8b';
  return (
    <Chip
      size="small"
      label={label ?? code ?? '—'}
      sx={{ bgcolor: `${c}1A`, color: c, border: `1px solid ${c}55` }}
    />
  );
}

export function PriorityChip({ code, label }: { code?: string; label?: string }) {
  const c = PRIORITY_COLORS[code?.toUpperCase() ?? ''] ?? '#607d8b';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label ?? code ?? '—'}
      sx={{ color: c, borderColor: `${c}88` }}
    />
  );
}
