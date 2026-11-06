import { useEffect } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { PERMISSIONS } from '@mla/shared';
import { getActivePrincipal } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { usePrincipals } from '@/hooks/useOptions';

/**
 * Which office (principal) a new record belongs to. When the top-bar switcher
 * is on one office, that office is used silently and nothing is shown. When
 * it's on "All" (Super Admin), the user picks one here - defaulting to
 * MLA - South - instead of the save failing with "Validation failed".
 */
export function useOfficeChoice(value: string, onChange: (id: string) => void) {
  const { user, can } = useAuth();
  const principals = usePrincipals();
  const active = getActivePrincipal();
  const allView = can(PERMISSIONS.PRINCIPAL_ALL_VIEW);
  const options = (principals.data ?? []).filter((p) => allView || user?.principalIds?.includes(p.id));
  const needsPick = !active;

  useEffect(() => {
    if (!needsPick || value || !options.length) return;
    const def = options.find((p) => p.code === 'MLA_S') ?? options[0];
    onChange(def.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPick, value, options.length]);

  return { principalId: active ?? value, needsPick, options };
}

export function OfficeField({
  value, onChange, options,
}: { value: string; onChange: (id: string) => void; options: { id: string; label: string }[] }) {
  return (
    <TextField fullWidth size="small" select label="Office" value={value} onChange={(e) => onChange(e.target.value)} required>
      {options.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
    </TextField>
  );
}
