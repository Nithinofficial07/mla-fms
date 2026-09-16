import { useState } from 'react';
import { Alert, Box, Button, Divider, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { AuthLayout } from '@/layouts/AuthLayout';
import { TrackingResult } from './TrackingResult';
import type { TrackResult } from './trackTypes';

const schema = z.object({
  fileId: z.string().min(3, 'Enter your File ID'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter the 10-digit mobile number used on the request'),
});
type Form = z.infer<typeof schema>;

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
          <TrackingResult result={result} onReset={() => setResult(null)} />
        </Box>
      )}
    </AuthLayout>
  );
}
