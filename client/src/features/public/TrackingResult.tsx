import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { StatusChip } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import type { TrackResult } from './trackTypes';

const ICONS: Record<string, string> = {
  FILE_CREATED: 'NoteAdd',
  REQUEST_SUBMIT: 'Send',
  STATUS_CHANGE: 'SwapHoriz',
  REQUEST_ASSIGN: 'AssignmentInd',
  REQUEST_FORWARD: 'Forward',
};

/** Renders a request's public-safe status + timeline. Shared by the manual /track form and the QR scan landing page, so both always show the same live data. */
export function TrackingResult({ result, onReset }: { result: TrackResult; onReset?: () => void }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{result.fileId}</Typography>
          <Typography variant="body2" color="text.secondary">{result.subject}</Typography>
        </Box>
        <StatusChip code={result.statusCode} label={result.statusName} />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2, mb: 3 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Department</Typography>
          <Typography variant="body2" fontWeight={600}>{result.department ?? 'Not yet assigned'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Submitted</Typography>
          <Typography variant="body2" fontWeight={600}>{dayjs(result.submittedAt).format('DD MMM YYYY')}</Typography>
        </Box>
        {result.dueDate && (
          <Box>
            <Typography variant="caption" color="text.secondary">Expected by</Typography>
            <Typography variant="body2" fontWeight={600}>{dayjs(result.dueDate).format('DD MMM YYYY')}</Typography>
          </Box>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">Last updated</Typography>
          <Typography variant="body2" fontWeight={600}>{dayjs(result.updatedAt).format('DD MMM YYYY')}</Typography>
        </Box>
      </Box>

      <Typography variant="subtitle2" gutterBottom>Progress</Typography>
      {result.timeline.length === 0 ? (
        <EmptyState icon="Timeline" title="No updates yet" />
      ) : (
        <Box sx={{ pl: 1 }}>
          {result.timeline.map((e, i) => (
            <Stack key={i} direction="row" spacing={2} sx={{ position: 'relative', pb: 3 }}>
              {i < result.timeline.length - 1 && (
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
                  {dayjs(e.at).format('DD MMM YYYY, hh:mm A')}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      )}

      {onReset && (
        <>
          <Divider sx={{ mt: 1, mb: 2 }} />
          <Chip
            size="small"
            variant="outlined"
            icon={<Icon name="ArrowBack" />}
            label="Check another request"
            onClick={onReset}
          />
        </>
      )}
    </Box>
  );
}
