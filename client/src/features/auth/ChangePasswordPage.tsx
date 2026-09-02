import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import { AuthLayout } from '@/layouts/AuthLayout';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

export function ChangePasswordPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Change password" subtitle="You'll be signed out and asked to log in again.">
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            required
            helperText="At least 8 characters, including a letter and a digit."
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Update password
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
