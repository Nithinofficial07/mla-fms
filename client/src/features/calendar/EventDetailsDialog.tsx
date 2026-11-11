import { useRef, useState, type ReactNode } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, Divider, IconButton,
  Link, ListItemIcon, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import {
  CALENDAR_ATTACHMENT_LABELS, CALENDAR_CODES, CALENDAR_DEADLINE_COLOR, CALENDAR_RECURRENCE, PERMISSIONS, calendarTypeMeta,
} from '@mla/shared';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  checkClashes, deleteEvent, documentsForEvent, fetchChangeLog, setPrep, updateEvent, uploadEventDocument,
} from './calendarApi';
import { useMyCalendarCodes } from './CalendarsField';
import { CalendarAvatar } from './CalendarAvatar';
import { AttendanceEditor, EventPhotos, ReplySelect, RsvpButtons } from './CalendarPanels';
import { SpeechViewer } from './SpeechEditor';
import { useCalendarReference } from './useCalendarReference';
import { PREP_LABEL, ROLE_LABEL, STATUS_LABEL } from './EventDialog';
import { fmtArrival, googleMapsUrl, rsvpOf, timeLabel, type CalendarItem } from './calendarUtils';

function Row({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Icon name={icon} fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}

const accordionSx = { bgcolor: 'transparent', '&::before': { display: 'none' }, boxShadow: 'none', border: 1, borderColor: 'divider', borderRadius: '8px !important' };

function EventAttachments({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState<string>('Invitation');
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
          <Button size="small" startIcon={<Icon name="UploadFile" />} onClick={() => fileRef.current?.click()} disabled={upload.isPending}>Upload</Button>
          <input
            ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }}
          />
        </Stack>
      )}
    </Stack>
  );
}

function HistoryPanel({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['calendar', 'changes', 'event', eventId], queryFn: () => fetchChangeLog({ eventId, limit: 100 }) });
  if (isLoading) return <Typography variant="body2" color="text.secondary">Loading…</Typography>;
  if (!data?.length) return <Typography variant="body2" color="text.secondary">No history recorded.</Typography>;
  return (
    <Stack divider={<Divider />} sx={{ maxHeight: 260, overflowY: 'auto' }}>
      {data.map((c) => (
        <Box key={c.id} sx={{ py: 0.75 }}>
          <Typography variant="body2"><b>{c.byName}</b> {c.action}</Typography>
          <Typography variant="caption" color="text.secondary">{dayjs(c.at).format('D MMM YYYY, h:mm A')}{c.detail.length ? ` · ${c.detail.join('; ')}` : ''}</Typography>
        </Box>
      ))}
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

export function EventDetailsDialog(props: Props) {
  // Keyed so per-event state (menus, queries) resets when a different event opens.
  if (!props.item) return null;
  return <Details key={props.item.id} {...props} item={props.item} />;
}

function Details({ item, canManage, onClose, onEdit, onOpenRequest }: Props & { item: CalendarItem }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const { tCal } = useCalendarReference();
  const { codes: myCodes, viewAll } = useMyCalendarCodes();
  const { can } = useAuth();
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['calendar'] });
  const onErr = (e: unknown) => enqueueSnackbar(errorMessage(e), { variant: 'error' });

  const isDeadline = item.kind === 'deadline';
  const eventId = item.eventId;
  const meta = calendarTypeMeta(item.type);
  const color = isDeadline ? CALENDAR_DEADLINE_COLOR : meta.color;
  const repeat = item.isRecurring ? CALENDAR_RECURRENCE.find((r) => r.code === item.recurrence)?.label : null;
  const cancelled = item.status === 'CANCELLED';
  const myOwn = isDeadline ? [] : (viewAll ? item.members : item.members.filter((m) => myCodes.includes(m)));
  const isPast = dayjs(item.end).isBefore(dayjs());
  const isAway = item.type === 'UNAVAILABLE';
  const going = item.members.filter((m) => rsvpOf(item, m) === 'GOING');

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => { enqueueSnackbar('Event deleted', { variant: 'success' }); invalidate(); onClose(); },
    onError: onErr,
  });
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateEvent(eventId!, body),
    onSuccess: () => { enqueueSnackbar('Event updated', { variant: 'success' }); invalidate(); onClose(); },
    onError: onErr,
  });
  const prep = useMutation({
    mutationFn: (prepDone: string[]) => setPrep(eventId!, { prepDone }),
    onSuccess: invalidate, onError: onErr,
  });
  // Upcoming: does anyone who is going already have something else at this time?
  const clashQ = useQuery({
    queryKey: ['calendar', 'clashes', 'details', item.id, going.join(',')],
    queryFn: () => checkClashes({ members: going, start: item.start, end: item.end, excludeId: eventId }),
    enabled: !isDeadline && !isPast && !cancelled && going.length > 0 && !!eventId,
  });
  const history = useQuery({ queryKey: ['calendar', 'changes', 'event', eventId], queryFn: () => fetchChangeLog({ eventId: eventId!, limit: 100 }), enabled: !!eventId && !isDeadline });
  const createdEntry = history.data?.length ? history.data[history.data.length - 1] : undefined;
  const lastEntry = history.data?.[0];

  const doDelete = async () => {
    const ok = await confirm({
      title: 'Delete event?',
      message: item.isRecurring ? 'This deletes every occurrence of this repeating event.' : `"${item.title}" will be removed from the calendar.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok && eventId) remove.mutate(eventId);
  };
  const moveTo = (code: string) => {
    setMoveAnchor(null);
    patch.mutate({ members: [code], rsvp: { [code]: going.length ? 'GOING' : rsvpOf(item, item.members[0] ?? code) } });
  };

  // Multi-day: list every session of the series.
  const allSessions = item.dayCount
    ? [{ start: item.seriesStart ?? item.start, end: item.seriesEnd ?? item.end, arrival: item.seriesArrival ?? item.arrival }, ...(item.sessions ?? [])]
    : [];
  const contacts = [
    { name: item.contactName, phone: item.contactPhone },
    { name: item.contact2Name, phone: item.contact2Phone },
  ].filter((c) => c.name || c.phone);

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <Box sx={{ height: 6, bgcolor: color, backgroundImage: isAway ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 6px, transparent 6px 12px)' : 'none' }} />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip
                  size="small" label={isDeadline ? 'Request deadline' : tCal(meta.label)}
                  icon={isAway ? <Icon name="FlightTakeoff" sx={{ fontSize: 14, color: `${color} !important` }} /> : undefined}
                  sx={{ bgcolor: `${color}24`, color, height: 22, fontWeight: 700 }}
                />
                {!isDeadline && item.status && item.status !== 'SCHEDULED' && (
                  <Chip size="small" label={STATUS_LABEL[item.status] ?? item.status} sx={{ height: 22 }} color={item.status === 'COMPLETED' ? 'success' : item.status === 'CANCELLED' ? 'default' : 'warning'} />
                )}
                {isDeadline && item.status && <Chip size="small" label={item.status.replace(/_/g, ' ')} sx={{ height: 22 }} />}
                {item.role && <Chip size="small" label={tCal(ROLE_LABEL[item.role] ?? item.role)} color="secondary" variant="outlined" sx={{ height: 22 }} />}
                {item.dayCount && <Chip size="small" label={`Day ${item.dayNo} of ${item.dayCount}`} sx={{ height: 22, fontWeight: 700 }} />}
              </Stack>
              <Typography variant="h6" sx={{ lineHeight: 1.3, wordBreak: 'break-word', textDecoration: cancelled ? 'line-through' : 'none' }}>{item.title}</Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close"><Icon name="Close" fontSize="small" /></IconButton>
          </Stack>

          <Stack spacing={1.75}>
            {item.draft && (
              <Alert severity="error" variant="outlined" action={canManage ? <Button color="inherit" size="small" onClick={() => onEdit(item)}>Fill in</Button> : undefined}>
                Quick event - the details still need to be filled in.
              </Alert>
            )}
            {!!clashQ.data?.length && (
              <Alert severity="warning">
                <b>Clash:</b> {clashQ.data.map((c) => `${CALENDAR_CODES.find((x) => x.code === c.memberCode)?.title ?? c.memberCode} is also ${c.reason === 'AWAY' ? 'away' : `going to "${c.event.title}"`} (${dayjs(c.event.start).format('h:mm A')}).`).join(' ')}
              </Alert>
            )}

            {/* attendance - past events */}
            {!isDeadline && !isAway && isPast && !item.draft && !!myOwn.length && eventId && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}><Icon name="FactCheck" fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />Did they go?</Typography>
                <AttendanceEditor item={item} />
                <Box sx={{ mt: 1 }}><EventPhotos eventId={eventId} size={60} /></Box>
              </Box>
            )}

            {/* invited / who is going */}
            {!isDeadline && !isAway && !!item.members.length && (
              <Row icon="Groups">
                {myOwn.length && eventId ? (
                  <RsvpButtons item={item} codes={item.members.filter((m) => myOwn.includes(m))} disabled={!canManage} />
                ) : (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {item.members.map((m) => {
                      const c = CALENDAR_CODES.find((x) => x.code === m);
                      const r = rsvpOf(item, m);
                      return <Chip key={m} size="small" avatar={<CalendarAvatar code={m} size={20} />} label={`${c?.title ?? m}: ${r === 'GOING' ? 'going' : r === 'NOT_GOING' ? 'not going' : 'not decided'}`} />;
                    })}
                  </Stack>
                )}
              </Row>
            )}
            {isAway && (
              <Row icon="FlightTakeoff">
                <Stack direction="row" spacing={1}>{item.members.map((m) => <Chip key={m} size="small" avatar={<CalendarAvatar code={m} size={20} />} label={CALENDAR_CODES.find((x) => x.code === m)?.title ?? m} />)}</Stack>
              </Row>
            )}

            <Row icon="Event">
              <Typography variant="body2" fontWeight={600}>{dayjs(item.start).format('dddd, D MMMM YYYY')}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                  {isDeadline ? 'Due date' : timeLabel(item)}
                  {!item.allDay && !dayjs(item.end).isSame(dayjs(item.start), 'day') && !item.dayCount ? ` (ends ${dayjs(item.end).format('ddd D MMM')})` : ''}
                  {repeat ? ` · ${tCal(repeat)}` : ''}
                  {item.isRecurring && item.recurrenceUntil ? ` until ${dayjs(item.recurrenceUntil).format('D MMM YYYY')}` : ''}
                </Typography>
                {item.arrival && !item.allDay && <Chip size="small" color="warning" icon={<Icon name="Timeline" sx={{ fontSize: 14 }} />} label={`Arrive by ${fmtArrival(item.arrival)}`} sx={{ height: 22, fontWeight: 700 }} />}
              </Stack>
              {allSessions.length > 1 && (
                <Stack spacing={0.25} sx={{ mt: 0.75, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                  {allSessions.map((s, i) => (
                    <Typography key={i} variant="caption" sx={{ fontWeight: i + 1 === item.dayNo ? 800 : 400 }}>
                      Day {i + 1}: {dayjs(s.start).format('ddd D MMM')}, {dayjs(s.start).format('h:mm A')} – {dayjs(s.end).format('h:mm A')}
                      {!dayjs(s.end).isSame(dayjs(s.start), 'day') ? ' (next day)' : ''}{s.arrival ? ` · arrive ${fmtArrival(s.arrival)}` : ''}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Row>

            {(item.venue || item.area) && (
              <Row icon="Place">
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {item.venue && <Typography variant="body2">{item.venue}</Typography>}
                    {item.area && <Typography variant="body2" color="text.secondary">{item.area}</Typography>}
                  </Box>
                  <Button size="small" href={googleMapsUrl(item.venue, item.area)} target="_blank" rel="noopener noreferrer" startIcon={<Icon name="OpenInNew" fontSize="small" />}>Maps</Button>
                </Stack>
              </Row>
            )}
            {item.organizer && (
              <Row icon="Business">
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2">{item.organizer}</Typography>
                  <Chip size="small" variant="outlined" label={item.organizerKind === 'SANGA' ? 'Sanga' : 'Ind'} sx={{ height: 20, fontSize: 11 }} />
                </Stack>
                {!isDeadline && eventId && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Reply:</Typography>
                    <ReplySelect item={item} disabled={!canManage} />
                  </Stack>
                )}
              </Row>
            )}
            {contacts.map((c, i) => (
              <Row key={i} icon="Phone">
                <Typography variant="body2">
                  {c.name}{c.name && c.phone ? ' · ' : ''}
                  {c.phone && <Link href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</Link>}
                </Typography>
              </Row>
            ))}

            {!isDeadline && (!!item.prep?.length || item.prepNote) && (
              <Row icon="Checklist">
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {(item.prep ?? []).map((p) => {
                    const done = item.prepDone?.includes(p);
                    return (
                      <Chip
                        key={p} size="small" label={tCal(PREP_LABEL[p] ?? p)}
                        icon={<Icon name={done ? 'TaskAlt' : 'RadioButtonUnchecked'} fontSize="small" />}
                        onClick={canManage && eventId ? () => prep.mutate(done ? (item.prepDone ?? []).filter((x) => x !== p) : [...(item.prepDone ?? []), p]) : undefined}
                        color={done ? 'success' : 'default'} variant={done ? 'filled' : 'outlined'}
                      />
                    );
                  })}
                </Stack>
                {item.prepNote && <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}><b>Other needs:</b> {item.prepNote}</Typography>}
              </Row>
            )}

            {!isDeadline && item.speech?.needed && (
              <Accordion disableGutters defaultExpanded={!isPast} sx={accordionSx}>
                <AccordionSummary expandIcon={<Icon name="ExpandMore" />}><Typography variant="subtitle2">Speech</Typography></AccordionSummary>
                <AccordionDetails><SpeechViewer kn={item.speech.kn} en={item.speech.en} title={item.title} /></AccordionDetails>
              </Accordion>
            )}

            {item.writeup && <Row icon="Share"><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.writeup}</Typography></Row>}
            {!!item.attendees?.length && (
              <Row icon="Group">
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {item.attendees.map((a) => <Chip key={a} size="small" label={a} variant="outlined" sx={{ height: 22 }} />)}
                </Stack>
              </Row>
            )}
            {item.description && <Row icon="Notes"><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Typography></Row>}

            {!isDeadline && eventId && (
              <Accordion disableGutters sx={accordionSx}>
                <AccordionSummary expandIcon={<Icon name="ExpandMore" />}><Typography variant="subtitle2">Attachments</Typography></AccordionSummary>
                <AccordionDetails><EventAttachments eventId={eventId} canManage={canManage && can(PERMISSIONS.DOCUMENT_UPLOAD)} /></AccordionDetails>
              </Accordion>
            )}

            {!isDeadline && eventId && (
              <>
                {createdEntry && (
                  <Typography variant="caption" color="text.secondary">
                    Added by {createdEntry.byName} · {dayjs(createdEntry.at).format('D MMM YYYY')}
                    {lastEntry && lastEntry.id !== createdEntry.id ? ` · last edited by ${lastEntry.byName}, ${dayjs(lastEntry.at).format('D MMM, h:mm A')}` : ''}
                  </Typography>
                )}
                <Accordion disableGutters sx={accordionSx}>
                  <AccordionSummary expandIcon={<Icon name="ExpandMore" />}><Typography variant="subtitle2"><Icon name="History" fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />History</Typography></AccordionSummary>
                  <AccordionDetails><HistoryPanel eventId={eventId} /></AccordionDetails>
                </Accordion>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          {isDeadline ? (
            <Button variant="contained" startIcon={<Icon name="OpenInNew" />} onClick={() => item.requestId && onOpenRequest(item.requestId)}>Open request</Button>
          ) : canManage && (
            <>
              <Tooltip title="Delete">
                <IconButton color="error" onClick={doDelete} disabled={remove.isPending}><Icon name="Delete" /></IconButton>
              </Tooltip>
              <Tooltip title="Move to another calendar">
                <IconButton onClick={(e) => setMoveAnchor(e.currentTarget)} disabled={patch.isPending}><Icon name="DriveFileMove" /></IconButton>
              </Tooltip>
              <Menu anchorEl={moveAnchor} open={!!moveAnchor} onClose={() => setMoveAnchor(null)}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>Move to</Typography>
                {CALENDAR_CODES.filter((c) => viewAll || myCodes.includes(c.code)).map((c) => (
                  <MenuItem key={c.code} onClick={() => moveTo(c.code)} disabled={item.members.length === 1 && item.members[0] === c.code}>
                    <ListItemIcon><CalendarAvatar code={c.code} size={24} /></ListItemIcon>{tCal(c.title)}
                  </MenuItem>
                ))}
              </Menu>
              <Box sx={{ flex: 1 }} />
              {item.status !== 'COMPLETED' && !cancelled && isPast && (
                <Button variant="outlined" color="success" startIcon={<Icon name="TaskAlt" />} disabled={patch.isPending} onClick={() => patch.mutate({ status: 'COMPLETED' })}>Done</Button>
              )}
              <Button variant="contained" startIcon={<Icon name="Edit" />} onClick={() => onEdit(item)}>Edit</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      {dialog}
    </>
  );
}
