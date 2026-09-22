import { useState } from 'react';
import {
  Box, Card, CardContent, Chip, IconButton, Menu, MenuItem,
  Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import { PriorityChip } from '@/components/chips';

interface RequestItem {
  id: string;
  fileId: string;
  subject: string;
  statusCode: string;
  statusId?: { name: string; code: string };
  priorityId?: { name: string; code: string };
  primaryDepartmentId?: { name: string; code?: string };
  applicant?: { name: string; mobile: string };
  location?: { wardId?: { name: string }; gramPanchayatId?: { name: string } };
  createdAt: string;
  dueDate?: string;
}

interface ColumnDef {
  code: string;
  name: string;
  icon: string;
  color: string;
  acceptedStatuses: string[];
}

const KANBAN_COLUMNS: ColumnDef[] = [
  { code: 'SUBMITTED', name: 'New Submissions', icon: 'FiberNew', color: '#2563EB', acceptedStatuses: ['SUBMITTED', 'DRAFT'] },
  { code: 'UNDER_REVIEW', name: 'Under Review', icon: 'HourglassEmpty', color: '#D97706', acceptedStatuses: ['UNDER_REVIEW', 'AWAITING_INFO'] },
  { code: 'ASSIGNED', name: 'Dept Assigned', icon: 'AssignmentInd', color: '#7C3AED', acceptedStatuses: ['ASSIGNED'] },
  { code: 'IN_PROGRESS', name: 'In Progress', icon: 'Autorenew', color: '#0D9488', acceptedStatuses: ['IN_PROGRESS', 'FORWARDED'] },
  { code: 'DEPT_RESPONSE', name: 'Dept Replied', icon: 'ForwardToInbox', color: '#0284C7', acceptedStatuses: ['DEPT_RESPONSE'] },
  { code: 'COMPLETED', name: 'Resolved', icon: 'TaskAlt', color: '#059669', acceptedStatuses: ['COMPLETED', 'APPROVED', 'CLOSED'] },
];

function SlaBadge({ dueDate, isCompleted }: { dueDate?: string; isCompleted?: boolean }) {
  if (isCompleted) {
    return (
      <Chip
        size="small"
        icon={<Icon name="CheckCircle" sx={{ fontSize: '13px !important' }} />}
        label="Resolved"
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: 'rgba(16, 185, 129, 0.12)',
          color: '#059669',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}
      />
    );
  }
  if (!dueDate) return null;

  const due = dayjs(dueDate);
  const now = dayjs();
  const diffDays = due.diff(now, 'day');

  if (diffDays < 0) {
    return (
      <Chip
        size="small"
        icon={<Icon name="ReportProblem" sx={{ fontSize: '13px !important' }} />}
        label={`${Math.abs(diffDays)}d overdue`}
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: 'rgba(220, 38, 38, 0.12)',
          color: '#DC2626',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          animation: 'pulseGlow 2s infinite ease-in-out',
        }}
      />
    );
  }

  if (diffDays <= 2) {
    return (
      <Chip
        size="small"
        icon={<Icon name="Warning" sx={{ fontSize: '13px !important' }} />}
        label={diffDays === 0 ? 'Due today' : `Due in ${diffDays}d`}
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: 'rgba(245, 158, 11, 0.12)',
          color: '#D97706',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}
      />
    );
  }

  return (
    <Chip
      size="small"
      icon={<Icon name="Event" sx={{ fontSize: '13px !important' }} />}
      label={due.format('DD MMM')}
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: 'action.hover',
        color: 'text.secondary',
      }}
    />
  );
}

function KanbanCard({
  item,
  onSelect,
  onStatusChange,
}: {
  item: RequestItem;
  onSelect: (id: string) => void;
  onStatusChange?: (id: string, toStatus: string) => void;
}) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isCompleted = ['COMPLETED', 'APPROVED', 'CLOSED'].includes(item.statusCode);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, currentStatus: item.statusCode }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(item.id)}
      sx={{
        cursor: 'grab',
        mb: 1.5,
        borderRadius: 2.5,
        transition: 'all .18s ease',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            color="primary.main"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/requests/${item.id}`);
            }}
            sx={{
              cursor: 'pointer',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
              letterSpacing: '0.02em',
            }}
          >
            {item.fileId}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {item.priorityId && (
              <PriorityChip code={item.priorityId.code} label={item.priorityId.name} />
            )}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setAnchorEl(e.currentTarget);
              }}
              sx={{ p: 0.5 }}
            >
              <Icon name="MoreVert" fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {item.subject}
        </Typography>

        {item.applicant && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
            <Icon name="Person" sx={{ fontSize: '0.85rem', color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 500 }}>
              {item.applicant.name}
            </Typography>
          </Stack>
        )}

        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between" sx={{ pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
          <Chip
            size="small"
            icon={<Icon name="AccountBalance" sx={{ fontSize: '12px !important' }} />}
            label={item.primaryDepartmentId?.name ?? 'Unassigned'}
            sx={{
              maxWidth: 130,
              height: 22,
              fontSize: '0.675rem',
              fontWeight: 500,
              bgcolor: 'action.hover',
            }}
          />
          <SlaBadge dueDate={item.dueDate} isCompleted={isCompleted} />
        </Stack>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => { setAnchorEl(null); navigate(`/requests/${item.id}`); }}>
            <Icon name="OpenInNew" fontSize="small" sx={{ mr: 1 }} /> Open Full Dossier
          </MenuItem>
          <MenuItem onClick={() => { setAnchorEl(null); onSelect(item.id); }}>
            <Icon name="Visibility" fontSize="small" sx={{ mr: 1 }} /> Quick View
          </MenuItem>
          {onStatusChange && (
            <>
              {item.statusCode !== 'IN_PROGRESS' && (
                <MenuItem onClick={() => { setAnchorEl(null); onStatusChange(item.id, 'IN_PROGRESS'); }}>
                  <Icon name="Autorenew" fontSize="small" sx={{ mr: 1 }} /> Move to In Progress
                </MenuItem>
              )}
              {item.statusCode !== 'COMPLETED' && (
                <MenuItem onClick={() => { setAnchorEl(null); onStatusChange(item.id, 'COMPLETED'); }}>
                  <Icon name="CheckCircle" fontSize="small" sx={{ mr: 1 }} /> Mark as Completed
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      </CardContent>
    </Card>
  );
}

export function RequestKanbanView({
  rows = [],
  loading,
  onSelect,
  onStatusChange,
}: {
  rows: RequestItem[];
  loading?: boolean;
  onSelect: (id: string) => void;
  onStatusChange?: (id: string, toStatus: string) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragOver = (colCode: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(colCode);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (colCode: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data?.id && data.currentStatus !== colCode && onStatusChange) {
        onStatusChange(data.id, colCode);
      }
    } catch {
      /* ignore invalid drop data */
    }
  };

  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {KANBAN_COLUMNS.map((col) => (
          <Box key={col.code} sx={{ width: 300, minWidth: 280, flexShrink: 0 }}>
            <Skeleton variant="rounded" height={48} sx={{ mb: 1.5 }} />
            <Skeleton variant="rounded" height={140} sx={{ mb: 1.5 }} />
            <Skeleton variant="rounded" height={140} />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 3,
        pt: 0.5,
        minHeight: '70vh',
        '&::-webkit-scrollbar': { height: 8 },
        '&::-webkit-scrollbar-thumb': { borderRadius: 4 },
      }}
    >
      {KANBAN_COLUMNS.map((col) => {
        const items = rows.filter((r) => col.acceptedStatuses.includes(r.statusCode));
        const isTarget = dragOverColumn === col.code;

        return (
          <Box
            key={col.code}
            onDragOver={(e) => handleDragOver(col.code, e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(col.code, e)}
            sx={{
              width: 300,
              minWidth: 280,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: isTarget
                ? alpha(col.color, 0.12)
                : isDark
                ? alpha('#111827', 0.65)
                : alpha('#F1F5F9', 0.75),
              border: '1.5px solid',
              borderColor: isTarget ? col.color : 'divider',
              borderRadius: 3,
              p: 1.5,
              transition: 'all .2s ease',
            }}
          >
            {/* Column Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, px: 0.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    bgcolor: alpha(col.color, 0.15),
                    color: col.color,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name={col.icon} sx={{ fontSize: '1rem' }} />
                </Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {col.name}
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={items.length}
                sx={{
                  fontWeight: 700,
                  height: 22,
                  bgcolor: items.length > 0 ? alpha(col.color, 0.12) : 'action.hover',
                  color: items.length > 0 ? col.color : 'text.secondary',
                }}
              />
            </Stack>

            {/* Column Cards */}
            <Box sx={{ flexGrow: 1, minHeight: 120, overflowY: 'auto', pr: 0.5 }}>
              {items.length === 0 ? (
                <Box
                  sx={{
                    py: 4,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="caption">Drop files here</Typography>
                </Box>
              ) : (
                items.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                  />
                ))
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

