import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useSearchParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import { AuthLayout } from '@/layouts/AuthLayout';
import { api, errorMessage } from '@/api/client';

export function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(sp.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set a new password">
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Reset token" value={token} onChange={(e) => setToken(e.target.value)} required />
          <TextField
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="At least 8 characters, including a letter and a digit."
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Update password
          </Button>
          <Link component={RouterLink} to="/login" variant="body2">Back to sign in</Link>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
