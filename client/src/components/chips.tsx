import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#78716C', SUBMITTED: '#1565C0', UNDER_REVIEW: '#0277BD', ASSIGNED: '#B8860B',
  FORWARDED: '#5E7C99', IN_PROGRESS: '#E65100', AWAITING_INFO: '#F9A825', DEPT_RESPONSE: '#00695C',
  APPROVED: '#2E7D32', COMPLETED: '#1B5E20', REJECTED: '#B71C1C', CLOSED: '#455A64',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#2E7D32', MEDIUM: '#E65100', HIGH: '#D84315', URGENT: '#B71C1C',
};

export function StatusChip({ code, label }: { code?: string; label?: string }) {
  const c = STATUS_COLORS[code ?? ''] ?? '#607D8B';
  return (
    <Chip
      size="small"
      label={label ?? code ?? '—'}
      sx={{ bgcolor: `${c}1A`, color: c, border: `1px solid ${c}55` }}
    />
  );
}

export function PriorityChip({ code, label }: { code?: string; label?: string }) {
  const c = PRIORITY_COLORS[code?.toUpperCase() ?? ''] ?? '#607D8B';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label ?? code ?? '—'}
      sx={{ color: c, borderColor: `${c}88` }}
    />
  );
}
