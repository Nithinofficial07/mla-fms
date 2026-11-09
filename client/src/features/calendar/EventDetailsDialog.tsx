import { useRef, useState, type ReactNode } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Dialog, DialogActions, DialogContent, IconButton,
  Link, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import {
  CALENDAR_ATTACHMENT_LABELS, CALENDAR_DEADLINE_COLOR, CALENDAR_RECURRENCE, CALENDAR_SOCIAL_PLATFORMS, PERMISSIONS, calendarTypeMeta,
} from '@mla/shared';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  deleteEvent, documentsForEvent, setAttendance, setPrep, setReply, setRsvp, setSocial, updateEvent, uploadEventDocument,
} from './calendarApi';
import { CalendarChips, useMyCalendarCodes } from './CalendarsField';
import { useCalendarReference } from './useCalendarReference';
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

const RSVP_OPTS: { code: string; label: string; icon: string; color: 'success' | 'warning' | 'error' }[] = [
  { code: 'GOING', label: 'Going', icon: 'CheckCircle', color: 'success' },
  { code: 'UNDECIDED', label: 'Maybe', icon: 'HelpOutline', color: 'warning' },
  { code: 'NOT_GOING', label: 'Not going', icon: 'Cancel', color: 'error' },
];
const ATTENDANCE_OPTS = [
  { code: 'ATTENDED', label: 'Attended' },
  { code: 'REPRESENTATIVE', label: 'Representative went' },
  { code: 'NOT_ATTENDED', label: 'Not attended' },
];

function EventAttachments({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState<string>('Photo');
  const { data } = useQuery({
    queryKey: ['calendar', 'documents', eventId],
    queryFn: () => documentsForEvent(eventId) as Promise<{ id: string; documentId: string; documentType: string; versions: { fileName: string }[] }[]>,
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadEventDocument(eventId, file, label),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar', 'documents', eventId] }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar', 'documents', eventId] }); },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const download = async (id: string) => {
    const { data: sig } = await api.get(`/documents/${id}/url`);
    window.open(sig.url, '_blank');
  };

  return (
    <Stack spacing={1}>
      {(data ?? []).map((d) => (
        <Stack key={d.id} direction="row" alignItems="center" spacing={1}>
          <Chip size="small" label={d.documentType} sx={{ height: 20, fontSize: 11 }} />
          <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{d.versions[0]?.fileName}</Typography>
          <IconButton size="small" onClick={() => download(d.id)}><Icon name="Download" fontSize="small" /></IconButton>
          {canManage && <IconButton size="small" onClick={() => remove.mutate(d.id)}><Icon name="Delete" fontSize="small" /></IconButton>}
        </Stack>
      ))}
      {!data?.length && <Typography variant="body2" color="text.secondary">No attachments yet.</Typography>}
      {canManage && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
          <TextField select size="small" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ minWidth: 130 }}>
            {CALENDAR_ATTACHMENT_LABELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
          </TextField>
          <Button size="small" startIcon={<Icon name="UploadFile" />} onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            Upload
          </Button>
          <input
            ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }}
          />
        </Stack>
      )}
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
  const { tCal } = useCalendarReference();
  const { codes: myCodes, viewAll } = useMyCalendarCodes();
  const { can } = useAuth();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['calendar'] });
  const onErr = (e: unknown) => enqueueSnackbar(errorMessage(e), { variant: 'error' });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => { enqueueSnackbar('Event deleted', { variant: 'success' }); invalidate(); onClose(); },
    onError: onErr,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateEvent(id, { status }),
    onSuccess: () => { enqueueSnackbar('Event updated', { variant: 'success' }); invalidate(); onClose(); },
    onError: onErr,
  });
  const rsvp = useMutation({
    mutationFn: ({ id, code, status }: { id: string; code: string; status: string }) => setRsvp(id, code, status),
    onSuccess: invalidate, onError: onErr,
  });
  const attendance = useMutation({
    mutationFn: ({ id, code, status }: { id: string; code: string; status: string }) => setAttendance(id, { code, status }),
    onSuccess: invalidate, onError: onErr,
  });
  const prep = useMutation({
    mutationFn: ({ id, prepDone }: { id: string; prepDone: string[] }) => setPrep(id, { prepDone }),
    onSuccess: invalidate, onError: onErr,
  });
  const reply = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => setReply(id, value),
    onSuccess: invalidate, onError: onErr,
  });
  const social = useMutation({
    mutationFn: ({ id, code, status, platforms }: { id: string; code: string; status: string; platforms?: string[] }) =>
      setSocial(id, { code, status, platforms }),
    onSuccess: invalidate, onError: onErr,
  });

  if (!item) return dialog;
  const isDeadline = item.kind === 'deadline';
  const meta = calendarTypeMeta(item.type);
  const color = isDeadline ? CALENDAR_DEADLINE_COLOR : meta.color;
  const repeat = item.isRecurring ? CALENDAR_RECURRENCE.find((r) => r.code === item.recurrence)?.label : null;
  const cancelled = item.status === 'CANCELLED';
  const myOwn = isDeadline ? [] : (viewAll ? item.members : item.members.filter((m) => myCodes.includes(m)));
  const isPast = dayjs(item.end).isBefore(dayjs());

  const doDelete = async () => {
    const ok = await confirm({
      title: 'Delete event?',
      message: item.isRecurring ? 'This deletes every occurrence of this repeating event.' : `"${item.title}" will be removed from the calendar.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok && item.eventId) remove.mutate(item.eventId);
  };

  const copyWhatsapp = () => {
    const text = `*${item.title}*\n${dayjs(item.start).format('D MMM, h:mm A')}${item.venue ? ` — ${item.venue}` : ''}${item.writeup ? `\n${item.writeup}` : ''}`;
    navigator.clipboard?.writeText(text).then(() => enqueueSnackbar('Copied', { variant: 'success' })).catch(() => {});
  };

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <Box sx={{ height: 6, bgcolor: color }} />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip size="small" label={isDeadline ? 'Request deadline' : tCal(meta.label)} sx={{ bgcolor: `${color}24`, color, height: 22 }} />
                {!isDeadline && item.status && item.status !== 'SCHEDULED' && (
                  <Chip
                    size="small" label={STATUS_LABEL[item.status] ?? item.status} sx={{ height: 22 }}
                    color={item.status === 'COMPLETED' ? 'success' : item.status === 'CANCELLED' ? 'default' : 'warning'}
                  />
                )}
                {isDeadline && item.status && <Chip size="small" label={item.status.replace(/_/g, ' ')} sx={{ height: 22 }} />}
                {!isDeadline && <CalendarChips members={item.members} />}
                {item.draft && <Chip size="small" label="Quick / draft" sx={{ height: 22 }} />}
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
                {repeat ? ` · ${tCal(repeat)}` : ''}
                {item.isRecurring && item.recurrenceUntil ? ` until ${dayjs(item.recurrenceUntil).format('D MMM YYYY')}` : ''}
              </Typography>
            </Row>
            {(item.venue || item.area) && (
              <Row icon="Place">
                {item.venue && <Typography variant="body2">{item.venue}</Typography>}
                {item.area && <Typography variant="body2" color="text.secondary">{item.area}</Typography>}
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

            {!isDeadline && !!myOwn.length && item.eventId && (
              <Row icon="EventAvailable">
                <Stack spacing={0.75}>
                  {myOwn.map((code) => (
                    <Stack key={code} direction="row" spacing={0.5} alignItems="center">
                      <Chip size="small" label={code.replace('MLA_', '')} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                      {RSVP_OPTS.map((o) => {
                        const active = (item.rsvp?.[code] ?? 'UNDECIDED') === o.code;
                        return (
                          <Tooltip key={o.code} title={o.label}>
                            <IconButton size="small" color={active ? o.color : 'default'} onClick={() => item.eventId && rsvp.mutate({ id: item.eventId, code, status: o.code })}>
                              <Icon name={o.icon} fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        );
                      })}
                    </Stack>
                  ))}
                </Stack>
              </Row>
            )}

            {!isDeadline && isPast && !!myOwn.length && item.eventId && (
              <Row icon="FactCheck">
                <Stack spacing={0.5}>
                  {myOwn.map((code) => (
                    <TextField
                      key={code} select size="small" label={`Attendance (${code.replace('MLA_', '')})`}
                      value={item.attendance?.[code]?.status ?? ''}
                      onChange={(e) => item.eventId && attendance.mutate({ id: item.eventId, code, status: e.target.value })}
                      sx={{ maxWidth: 220 }}
                    >
                      <MenuItem value="">—</MenuItem>
                      {ATTENDANCE_OPTS.map((o) => <MenuItem key={o.code} value={o.code}>{o.label}</MenuItem>)}
                    </TextField>
                  ))}
                </Stack>
              </Row>
            )}

            {!isDeadline && !!item.prep?.length && (
              <Row icon="Checklist">
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {item.prep.map((p) => {
                    const done = item.prepDone?.includes(p);
                    return (
                      <Chip
                        key={p} size="small" label={tCal(p.replace(/_/g, ' '))}
                        icon={<Icon name={done ? 'TaskAlt' : 'RadioButtonUnchecked'} fontSize="small" />}
                        onClick={canManage && item.eventId ? () => {
                          const next = done ? (item.prepDone ?? []).filter((x) => x !== p) : [...(item.prepDone ?? []), p];
                          prep.mutate({ id: item.eventId!, prepDone: next });
                        } : undefined}
                        sx={{ height: 24, bgcolor: done ? 'success.main' : 'transparent', color: done ? '#fff' : 'text.secondary' }}
                        variant={done ? 'filled' : 'outlined'}
                      />
                    );
                  })}
                </Stack>
              </Row>
            )}

            {!isDeadline && item.organizer && (
              <Row icon="MarkEmailRead">
                <TextField
                  select size="small" label="Organiser's reply" value={item.reply ?? 'PENDING'}
                  onChange={(e) => item.eventId && reply.mutate({ id: item.eventId, value: e.target.value })}
                  disabled={!canManage} sx={{ maxWidth: 220 }}
                >
                  <MenuItem value="PENDING">Awaiting reply</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                  <MenuItem value="REGRET">Regret / declined</MenuItem>
                </TextField>
              </Row>
            )}

            {!isDeadline && item.publicSchedule && (
              <Accordion disableGutters sx={{ bgcolor: 'transparent', '&::before': { display: 'none' }, boxShadow: 'none', border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <AccordionSummary expandIcon={<Icon name="ExpandMore" />}><Typography variant="subtitle2">Social media</Typography></AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    {item.writeup && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.writeup}</Typography>}
                    <Button size="small" startIcon={<Icon name="ContentCopy" />} onClick={copyWhatsapp} sx={{ alignSelf: 'flex-start' }}>Copy for WhatsApp</Button>
                    {myOwn.map((code) => {
                      const s = item.social?.[code];
                      return (
                        <Stack key={code} direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={code.replace('MLA_', '')} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                          <Typography variant="caption" color="text.secondary">{s?.status === 'POSTED' ? `Posted (${s.platforms?.join(', ') || 'platform not noted'})` : s?.status === 'SKIPPED' ? 'Skipped' : 'Not posted yet'}</Typography>
                          {canManage && item.eventId && s?.status !== 'POSTED' && (
                            <Button size="small" onClick={() => item.eventId && social.mutate({ id: item.eventId, code, status: 'POSTED', platforms: CALENDAR_SOCIAL_PLATFORMS.slice(0, 1) })}>Mark posted</Button>
                          )}
                        </Stack>
                      );
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {!isDeadline && item.eventId && (
              <Accordion disableGutters sx={{ bgcolor: 'transparent', '&::before': { display: 'none' }, boxShadow: 'none', border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <AccordionSummary expandIcon={<Icon name="ExpandMore" />}><Typography variant="subtitle2">Attachments</Typography></AccordionSummary>
                <AccordionDetails>
                  <EventAttachments eventId={item.eventId} canManage={canManage && can(PERMISSIONS.DOCUMENT_UPLOAD)} />
                </AccordionDetails>
              </Accordion>
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
