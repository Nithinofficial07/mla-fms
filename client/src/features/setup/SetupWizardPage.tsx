import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Step, StepLabel, Stepper, Typography,
} from '@mui/material';
import { AuthLayout } from '@/layouts/AuthLayout';
import { api, errorMessage } from '@/api/client';
import { StepField } from './StepField';

const STEPS = ['Application', 'Constituency', 'Super Admin', 'Finish'];

/**
 * First-run wizard. Only usable while the DB has zero users; afterwards it
 * redirects to /login. Departments / wards / GPs / villages are created after
 * login via Admin > Import, so this stays short.
 */
export function SetupWizardPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    appName: 'MLA File Management System',
    constituencyName: '',
    name: '',
    email: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    api.get('/setup/status')
      .then(({ data }) => {
        if (!data.needsBootstrap) navigate('/login', { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const finish = async () => {
    setError(null);
    try {
      await api.post('/setup/bootstrap', form);
      navigate('/login', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (checking) return null;

  return (
    <AuthLayout title="First-time setup" subtitle="Create your administrator account and constituency.">
      <Stepper activeStep={active} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {active === 0 && <StepField label="Application name" value={form.appName} onChange={(v) => set('appName', v)} />}
      {active === 1 && (
        <StepField label="Constituency name" value={form.constituencyName} onChange={(v) => set('constituencyName', v)} required />
      )}
      {active === 2 && (
        <Box>
          <StepField label="Your full name" value={form.name} onChange={(v) => set('name', v)} required />
          <StepField label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} required />
          <StepField label="Username" value={form.username} onChange={(v) => set('username', v)} required />
          <StepField
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => set('password', v)}
            required
            helper="At least 8 characters, including a letter and a digit."
          />
        </Box>
      )}
      {active === 3 && (
        <Typography variant="body2" color="text.secondary">
          Ready to create <b>{form.username || '—'}</b> as Super Admin for <b>{form.constituencyName || '—'}</b>.
          After signing in you can import departments, wards, Gram Panchayats and villages from spreadsheets.
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={active === 0} onClick={() => setActive((a) => a - 1)}>
          Back
        </Button>
        {active < STEPS.length - 1 ? (
          <Button variant="contained" onClick={() => setActive((a) => a + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={finish}>
            Create & finish
          </Button>
        )}
      </Box>
    </AuthLayout>
  );
}
