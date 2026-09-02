import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import { AuthLayout } from '@/layouts/AuthLayout';
import { api, errorMessage } from '@/api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDone(
        data.devToken
          ? `Dev mode: use this reset link → /reset-password?token=${data.devToken}`
          : data.message,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a reset link if the account exists.">
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {done && <Alert severity="success">{done}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={loading}>
            Send reset link
          </Button>
          <Link href="/login" variant="body2">Back to sign in</Link>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
