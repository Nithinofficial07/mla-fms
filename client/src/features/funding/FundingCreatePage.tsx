import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';
import { useDepartments } from '@/hooks/useOptions';

export function FundingCreatePage() {
  const { departmentId = '' } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const departments = useDepartments();
  const [subject, setSubject] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const department = departments.data?.find((d) => d.id === departmentId);

  const create = useMutation({
    mutationFn: () => api.post('/funding', { departmentId, subject, address }).then((r) => r.data),
    onSuccess: (data) => {
      enqueueSnackbar(`Created ${data.fundingRequestId}`, { variant: 'success' });
      navigate(`/funding/${data.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const valid = subject.trim().length > 2 && address.trim().length > 2 && !!department;

  return (
    <Box>
      <PageHeader
        title="New Funding Request"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Funding', to: '/funding' }, { label: 'New' }]}
      />

      {!departments.isLoading && !department ? (
        <Alert severity="error">Unknown department. Go back and pick one from the Funding page.</Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                <Icon name="AttachMoney" />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Addressed to</Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {department?.ministryName || 'Respected Minister, Government of Karnataka'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {department?.name}
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            <Stack spacing={2}>
              <TextField
                label="Subject"
                required
                fullWidth
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Funding request for bridge repair near Anagodu"
              />
              <TextField
                label="Address"
                required
                fullWidth
                multiline
                minRows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Site / location address this funding request is for"
              />
              <Alert severity="info">
                Photos and scanned supporting documents are attached on the next page, right after this.
              </Alert>
              <Box>
                <Button
                  variant="contained"
                  startIcon={<Icon name="Send" />}
                  disabled={!valid || create.isPending}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? 'Submitting…' : 'Submit funding request'}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
