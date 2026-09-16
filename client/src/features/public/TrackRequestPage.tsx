import { useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import axios from 'axios';
import { AuthLayout } from '@/layouts/AuthLayout';
import { StatusChip } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';

const schema = z.object({
  fileId: z.string().min(3, 'Enter your File ID'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter the 10-digit mobile number used on the request'),
});
type Form = z.infer<typeof schema>;

interface TimelineEntry {
  action: string;
  label: string;
  toStatus: string | null;
  at: string;
}
interface TrackResult {
  fileId: string;
  requestId: string;
  subject: string;
  statusCode: string;
  statusName: string;
  department: string | null;
  submittedAt: string;
  dueDate: string | null;
  updatedAt: string;
  timeline: TimelineEntry[];
}

const ICONS: Record<string, string> = {
  FILE_CREATED: 'NoteAdd',
  REQUEST_SUBMIT: 'Send',
  STATUS_CHANGE: 'SwapHoriz',
  REQUEST_ASSIGN: 'AssignmentInd',
  REQUEST_FORWARD: 'Forward',
};

/**
 * Public, unauthenticated page - anyone with a File ID + the applicant's
 * mobile number can check status here. Hits /api/public/track directly
 * with a plain axios call (not the shared `api` instance) so it never
 * carries a staff Authorization header or triggers the refresh interceptor.
 */
export function TrackRequestPage() {
  const [result, setResult] = useState<TrackResult | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const track = useMutation({
    mutationFn: (data: Form) => axios.post<TrackResult>('/api/public/track', data).then((r) => r.data),
    onSuccess: setResult,
    onError: () => setResult(null),
  });

  const onSubmit = (data: Form) => track.mutate(data);

  return (
    <AuthLayout title="Track your request" subtitle="Enter your File ID and the mobile number you registered with" maxWidth={560}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <TextField
            label="File ID"
            placeholder="MLA/2026/000123"
            autoFocus
            {...register('fileId')}
            error={!!formState.errors.fileId}
            helperText={formState.errors.fileId?.message}
          />
          <TextField
            label="Mobile number"
            placeholder="10-digit number"
            {...register('mobile')}
            error={!!formState.errors.mobile}
            helperText={formState.errors.mobile?.message}
          />
          {track.isError && (
            <Alert severity="error">
              {axios.isAxiosError(track.error)
                ? (track.error.response?.data as { message?: string })?.message ?? 'No matching request found.'
                : 'Something went wrong. Try again.'}
            </Alert>
          )}
          <Button type="submit" size="large" variant="contained" disabled={track.isPending}>
            {track.isPending ? 'Checking…' : 'Check status'}
          </Button>
        </Stack>
      </Box>

      {result && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
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

          <Chip
            size="small"
            variant="outlined"
            icon={<Icon name="ArrowBack" />}
            label="Check another request"
            onClick={() => setResult(null)}
            sx={{ mt: 1 }}
          />
        </Box>
      )}
    </AuthLayout>
  );
}
