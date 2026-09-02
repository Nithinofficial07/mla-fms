import { Box, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

interface Entry {
  id: string;
  action: string;
  label: string;
  actorName: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remark?: string | null;
  createdAt: string;
}

const ICONS: Record<string, string> = {
  FILE_CREATED: 'NoteAdd',
  REQUEST_SUBMIT: 'Send',
  STATUS_CHANGE: 'SwapHoriz',
  REQUEST_ASSIGN: 'AssignmentInd',
  REQUEST_FORWARD: 'Forward',
  REMARK_ADD: 'Comment',
  DOCUMENT_UPLOADED: 'UploadFile',
  DOCUMENT_SCAN: 'DocumentScanner',
};

export function TimelineView({ entries }: { entries: Entry[] }) {
  if (!entries.length) {
    return <EmptyState icon="Timeline" title="No activity yet" />;
  }
  return (
    <Box sx={{ pl: 1 }}>
      {entries.map((e, i) => (
        <Stack key={e.id} direction="row" spacing={2} sx={{ position: 'relative', pb: 3 }}>
          {i < entries.length - 1 && (
            <Box sx={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, bgcolor: 'divider' }} />
          )}
          <Box
            sx={{
              width: 32, height: 32, flexShrink: 0, borderRadius: '50%',
              bgcolor: 'primary.light', color: 'primary.contrastText',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Icon name={ICONS[e.action] ?? 'FiberManualRecord'} />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={600}>{e.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {dayjs(e.createdAt).format('DD MMM YYYY, hh:mm A')} · {e.actorName}
              {e.fromStatus && e.toStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ''}
            </Typography>
            {e.remark && (
              <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                “{e.remark}”
              </Typography>
            )}
          </Box>
        </Stack>
      ))}
    </Box>
  );
}
