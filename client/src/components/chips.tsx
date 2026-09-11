import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF', SUBMITTED: '#3B82F6', UNDER_REVIEW: '#0EA5E9', ASSIGNED: '#8B5CF6',
  FORWARDED: '#6366F1', IN_PROGRESS: '#F59E0B', AWAITING_INFO: '#EAB308', DEPT_RESPONSE: '#14B8A6',
  APPROVED: '#10B981', COMPLETED: '#059669', REJECTED: '#E11D48', CLOSED: '#64748B',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10B981', MEDIUM: '#F59E0B', HIGH: '#F97316', URGENT: '#E11D48',
};

export function StatusChip({ code, label }: { code?: string; label?: string }) {
  const c = STATUS_COLORS[code ?? ''] ?? '#64748B';
  return (
    <Chip
      size="small"
      label={label ?? code ?? '—'}
      sx={{ bgcolor: `${c}1F`, color: c, border: `1px solid ${c}55` }}
    />
  );
}

export function PriorityChip({ code, label }: { code?: string; label?: string }) {
  const c = PRIORITY_COLORS[code?.toUpperCase() ?? ''] ?? '#64748B';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label ?? code ?? '—'}
      sx={{ color: c, borderColor: `${c}88` }}
    />
  );
}
