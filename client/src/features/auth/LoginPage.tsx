import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useAuth } from '@/app/AuthProvider';
import { errorMessage } from '@/api/client';

const schema = z.object({
  usernameOrEmail: z.string().min(3, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      const user = await login(data.usernameOrEmail, data.password);
      navigate(user.mustChangePassword ? '/change-password' : '/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Login failed'));
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="MLA File Management System">
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username or email"
            autoFocus
            autoComplete="username"
            {...register('usernameOrEmail')}
            error={!!formState.errors.usernameOrEmail}
            helperText={formState.errors.usernameOrEmail?.message}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message}
          />
          <Button type="submit" size="large" variant="contained" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Stack direction="row" justifyContent="space-between">
            <Link href="/forgot-password" variant="body2">Forgot password?</Link>
            <Link href="/setup" variant="body2">First-time setup</Link>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
