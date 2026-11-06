import type { ReactNode } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, IconButton, Link, Stack, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { CALENDAR_DEADLINE_COLOR, CALENDAR_RECURRENCE, calendarTypeMeta } from '@mla/shared';
import { api, errorMessage } from '@/api/client';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import { STATUS_LABEL } from './EventDialog';
import { timeLabel, type CalendarItem } from './calendarUtils';

function Row({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Icon name={icon} fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}

interface Props {
  item: CalendarItem | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (item: CalendarItem) => void;
  onOpenRequest: (requestId: string) => void;
}

export function EventDetailsDialog({ item, canManage, onClose, onEdit, onOpenRequest }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => {
      enqueueSnackbar('Event deleted', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/calendar/events/${id}`, { status }),
    onSuccess: () => {
      enqueueSnackbar('Event updated', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  if (!item) return dialog;
  const isDeadline = item.kind === 'deadline';
  const meta = calendarTypeMeta(item.type);
  const color = isDeadline ? CALENDAR_DEADLINE_COLOR : meta.color;
  const place = item.wardId?.name ? `Ward: ${item.wardId.name}` : item.gramPanchayatId?.name ? `GP: ${item.gramPanchayatId.name}` : '';
  const repeat = item.isRecurring ? CALENDAR_RECURRENCE.find((r) => r.code === item.recurrence)?.label : null;
  const cancelled = item.status === 'CANCELLED';

  const doDelete = async () => {
    const ok = await confirm({
      title: 'Delete event?',
      message: item.isRecurring ? 'This deletes every occurrence of this repeating event.' : `"${item.title}" will be removed from the calendar.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok && item.eventId) remove.mutate(item.eventId);
  };

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <Box sx={{ height: 6, bgcolor: color }} />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={isDeadline ? 'Request deadline' : meta.label} sx={{ bgcolor: `${color}24`, color, height: 22 }} />
                {!isDeadline && item.status && item.status !== 'SCHEDULED' && (
                  <Chip
                    size="small" label={STATUS_LABEL[item.status] ?? item.status} sx={{ height: 22 }}
                    color={item.status === 'COMPLETED' ? 'success' : item.status === 'CANCELLED' ? 'default' : 'warning'}
                  />
                )}
                {isDeadline && item.status && <Chip size="small" label={item.status.replace(/_/g, ' ')} sx={{ height: 22 }} />}
              </Stack>
              <Typography variant="h6" sx={{ lineHeight: 1.3, wordBreak: 'break-word', textDecoration: cancelled ? 'line-through' : 'none' }}>
                {item.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close"><Icon name="Close" fontSize="small" /></IconButton>
          </Stack>

          <Stack spacing={1.5}>
            <Row icon="Event">
              <Typography variant="body2" fontWeight={600}>{dayjs(item.start).format('dddd, D MMMM YYYY')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isDeadline ? 'Due date' : timeLabel(item)}
                {repeat ? ` · ${repeat}` : ''}
                {item.isRecurring && item.recurrenceUntil ? ` until ${dayjs(item.recurrenceUntil).format('D MMM YYYY')}` : ''}
              </Typography>
            </Row>
            {(item.venue || place) && (
              <Row icon="Place">
                {item.venue && <Typography variant="body2">{item.venue}</Typography>}
                {place && <Typography variant="body2" color="text.secondary">{place}</Typography>}
              </Row>
            )}
            {item.organizer && <Row icon="Business"><Typography variant="body2">Organiser: {item.organizer}</Typography></Row>}
            {(item.contactName || item.contactPhone) && (
              <Row icon="Phone">
                <Typography variant="body2">
                  {item.contactName}
                  {item.contactName && item.contactPhone ? ' · ' : ''}
                  {item.contactPhone && <Link href={`tel:${item.contactPhone}`}>{item.contactPhone}</Link>}
                </Typography>
              </Row>
            )}
            {!!item.attendees?.length && (
              <Row icon="Group">
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {item.attendees.map((a) => <Chip key={a} size="small" label={a} variant="outlined" sx={{ height: 22 }} />)}
                </Stack>
              </Row>
            )}
            {item.description && (
              <Row icon="Notes"><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Typography></Row>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          {isDeadline ? (
            <Button variant="contained" startIcon={<Icon name="OpenInNew" />} onClick={() => item.requestId && onOpenRequest(item.requestId)}>
              Open request
            </Button>
          ) : canManage && (
            <>
              <Tooltip title="Delete">
                <IconButton color="error" onClick={doDelete} disabled={remove.isPending}><Icon name="Delete" /></IconButton>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              {item.status !== 'COMPLETED' && !cancelled && (
                <Button
                  variant="outlined" color="success" startIcon={<Icon name="TaskAlt" />}
                  disabled={setStatus.isPending}
                  onClick={() => item.eventId && setStatus.mutate({ id: item.eventId, status: 'COMPLETED' })}
                >
                  Done
                </Button>
              )}
              <Button variant="contained" startIcon={<Icon name="EditNote" />} onClick={() => onEdit(item)}>Edit</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      {dialog}
    </>
  );
}
