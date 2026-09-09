import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Divider, FormControlLabel, Grid, Stack,
  Switch, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { api, errorMessage } from '@/api/client';

export function SettingsPage() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) });
  const backup = useQuery({ queryKey: ['settings', 'backup'], queryFn: () => api.get('/settings/backup-status').then((r) => r.data) });
  const emailStatus = useQuery({ queryKey: ['settings', 'email-status'], queryFn: () => api.get('/settings/email-status').then((r) => r.data) });

  const testEmail = useMutation({
    mutationFn: () => api.post('/settings/test-email').then((r) => r.data),
    onSuccess: (d: any) => enqueueSnackbar(d.message ?? 'Test email sent', { variant: 'success' }),
    onError: (e) => enqueueSnackbar(errorMessage(e, 'Test email failed'), { variant: 'error' }),
  });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: any) => api.patch('/settings', body),
    onSuccess: () => {
      enqueueSnackbar('Settings saved', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });

  const set = (k: string, v: unknown) => setForm((s: any) => ({ ...s, [k]: v }));
  const setNotif = (k: string, v: unknown) =>
    setForm((s: any) => ({ ...s, notifications: { ...(s.notifications ?? {}), [k]: v } }));

  const n = form.notifications ?? {};

  const submit = () =>
    save.mutate({
      appName: form.appName,
      constituencyName: form.constituencyName,
      fileIdFormat: form.fileIdFormat,
      requestIdFormat: form.requestIdFormat,
      documentIdFormat: form.documentIdFormat,
      letterNoFormat: form.letterNoFormat,
      dateFormat: form.dateFormat,
      timezone: form.timezone,
      maxUploadBytes: Number(form.maxUploadBytes),
      allowedFileTypes: typeof form.allowedFileTypes === 'string' ? form.allowedFileTypes.split(',').map((s: string) => s.trim()) : form.allowedFileTypes,
      defaultSlaDays: Number(form.defaultSlaDays),
      ocrEnabled: !!form.ocrEnabled,
      notifications: {
        inApp: n.inApp !== false,
        email: !!n.email,
        sms: !!n.sms,
        dueSoonDays: Number(n.dueSoonDays ?? 2),
      },
    });

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Application-wide configuration" crumbs={[{ label: 'Home', to: '/' }, { label: 'Settings' }]} />
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="General" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Application name" value={form.appName ?? ''} onChange={(e) => set('appName', e.target.value)} />
                <TextField label="Constituency name" value={form.constituencyName ?? ''} onChange={(e) => set('constituencyName', e.target.value)} />
                <Divider />
                <Typography variant="subtitle2">ID formats</Typography>
                <TextField label="File ID format" value={form.fileIdFormat ?? ''} onChange={(e) => set('fileIdFormat', e.target.value)} helperText="Tokens: {YYYY} {YY} {MM} {SEQ:n}. e.g. MLA/{YYYY}/{SEQ:6}" />
                <TextField label="Request ID format" value={form.requestIdFormat ?? ''} onChange={(e) => set('requestIdFormat', e.target.value)} />
                <TextField label="Document ID format" value={form.documentIdFormat ?? ''} onChange={(e) => set('documentIdFormat', e.target.value)} />
                <TextField label="MLA Letter no. format" value={form.letterNoFormat ?? ''} onChange={(e) => set('letterNoFormat', e.target.value)} helperText="e.g. MLA-LTR/{YYYY}/{SEQ:4}" />
                <Divider />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="Date format" value={form.dateFormat ?? ''} onChange={(e) => set('dateFormat', e.target.value)} />
                  <TextField fullWidth label="Timezone" value={form.timezone ?? ''} onChange={(e) => set('timezone', e.target.value)} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth type="number" label="Max upload (bytes)" value={form.maxUploadBytes ?? ''} onChange={(e) => set('maxUploadBytes', e.target.value)} />
                  <TextField fullWidth type="number" label="Default SLA (days)" value={form.defaultSlaDays ?? ''} onChange={(e) => set('defaultSlaDays', e.target.value)} />
                </Stack>
                <TextField
                  label="Allowed file types (comma-separated)"
                  value={Array.isArray(form.allowedFileTypes) ? form.allowedFileTypes.join(', ') : form.allowedFileTypes ?? ''}
                  onChange={(e) => set('allowedFileTypes', e.target.value)}
                />
                <Box>
                  <Button variant="contained" onClick={submit} disabled={save.isPending}>Save settings</Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardHeader title="Notifications" subheader="How departments and officers are alerted when a request is routed to them" />
            <CardContent>
              <Stack spacing={1}>
                <FormControlLabel
                  control={<Switch checked={n.inApp !== false} onChange={(e) => setNotif('inApp', e.target.checked)} />}
                  label="In-app notifications (bell menu)"
                />
                <FormControlLabel
                  control={<Switch checked={!!n.email} onChange={(e) => setNotif('email', e.target.checked)} />}
                  label="Email the department + its officers on assignment / forward"
                />
                <FormControlLabel
                  control={<Switch checked={!!n.sms} onChange={(e) => setNotif('sms', e.target.checked)} />}
                  label="SMS (requires an SMS provider)"
                />
                <TextField
                  type="number"
                  size="small"
                  label="'Due soon' reminder (days before due date)"
                  value={n.dueSoonDays ?? 2}
                  onChange={(e) => setNotif('dueSoonDays', e.target.value)}
                  sx={{ maxWidth: 320 }}
                />
                <Alert severity={emailStatus.data?.configured ? 'success' : 'info'} sx={{ mt: 1 }}>
                  {emailStatus.data?.configured ? (
                    emailStatus.data.provider === 'ses' ? (
                      <>Email via <b>AWS SES</b> ({emailStatus.data.sesRegion}), from <b>{emailStatus.data.from}</b>. Use the test button to confirm delivery.</>
                    ) : (
                      <>Email via <b>SMTP {emailStatus.data.host}:{emailStatus.data.port}</b>{' '}
                        ({emailStatus.data.secure ? 'TLS' : 'STARTTLS'}). Use the test button to confirm delivery.</>
                    )
                  ) : (
                    <>Set <code>EMAIL_PROVIDER</code> to <code>ses</code> (AWS SES, works on Render) or <code>smtp</code> in the server environment. Department emails come from each department&apos;s <b>Email</b> field.</>
                  )}
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="contained" onClick={submit} disabled={save.isPending}>Save settings</Button>
                  <Button variant="outlined" onClick={() => testEmail.mutate()} disabled={testEmail.isPending}>
                    {testEmail.isPending ? 'Sending…' : 'Send test email to me'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Backup status" />
            <CardContent>
              <Typography variant="body2">Last backup: <b>{backup.data?.lastBackupAt ? new Date(backup.data.lastBackupAt).toLocaleString() : 'Never'}</b></Typography>
              <Typography variant="body2">Status: <b>{backup.data?.lastBackupStatus ?? '—'}</b></Typography>
              {!backup.data?.configured && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {backup.data?.note ?? 'Automated backup is not configured.'}
                </Alert>
              )}
            </CardContent>
          </Card>
          <Card sx={{ mt: 2 }}>
            <CardHeader title="Masters" />
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Departments, wards, Gram Panchayats, villages, categories, statuses and priorities are all managed from their own
                pages in the sidebar — nothing here is hard-coded.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
