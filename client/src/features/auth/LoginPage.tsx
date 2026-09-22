import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, InputAdornment, Link, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/app/AuthProvider';
import { errorMessage } from '@/api/client';

const REMEMBER_KEY = 'mla-fms:remember-user';

const schema = z.object({
  usernameOrEmail: z.string().min(3, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { register, handleSubmit, formState, setValue } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setValue('usernameOrEmail', saved);
        setRemember(true);
      }
    } catch {
      /* localStorage unavailable — remember-me just won't prefill */
    }
  }, [setValue]);

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      const user = await login(data.usernameOrEmail, data.password);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, data.usernameOrEmail);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore storage failures */
      }
      navigate(user.mustChangePassword ? '/change-password' : '/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Login failed'));
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to the MLA File Management System">
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
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="PersonAdd" fontSize="small" sx={{ opacity: 0.6 }} /></InputAdornment> }}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Icon name="Lock" fontSize="small" sx={{ opacity: 0.6 }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" size="small" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    <Icon name={showPassword ? 'VisibilityOff' : 'Visibility'} fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
            label="Remember my username"
            sx={{ mt: -1, ml: 0 }}
          />
          <Button type="submit" size="large" variant="contained" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Stack direction="row" justifyContent="space-between">
            <Link href="/forgot-password" variant="body2">Forgot password?</Link>
            <Link href="/setup" variant="body2">First-time setup</Link>
          </Stack>
          <Stack alignItems="center" sx={{ pt: 1 }}>
            <Link href="/track" variant="body2" underline="hover">
              Not staff? Track your request here
            </Link>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
