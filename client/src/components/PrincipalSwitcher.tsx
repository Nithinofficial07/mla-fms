import { useEffect } from 'react';
import { MenuItem, TextField, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { getActivePrincipal, setActivePrincipal } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { usePrincipals } from '@/hooks/useOptions';

/**
 * Lets a user scoped to more than one principal (MLA-S / MLA-N / MP) pick
 * which one they're currently viewing/acting as. Renders nothing for a
 * single-principal user - they're implicitly scoped to their one principal,
 * no control needed. The choice is sent as the X-Principal-Id header (see
 * api/client.ts), which the server only ever uses to narrow access, never
 * widen it.
 */
export function PrincipalSwitcher({ light = false }: { light?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const principals = usePrincipals();

  const mine = (principals.data ?? []).filter((p) => user?.principalIds?.includes(p.id));
  const active = getActivePrincipal();

  // Keep the stored active principal valid for whoever is actually logged
  // in right now (a stale id from a previous user on the same browser must
  // not silently carry over).
  useEffect(() => {
    if (mine.length === 0) return;
    if (!active || !mine.some((p) => p.id === active)) {
      setActivePrincipal(mine[0].id);
      qc.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.map((p) => p.id).join(','), active]);

  if (mine.length <= 1) return null;

  return (
    <Tooltip title="Viewing as">
      <TextField
        select
        size="small"
        value={mine.some((p) => p.id === active) ? active : mine[0].id}
        onChange={(e) => { setActivePrincipal(e.target.value); qc.invalidateQueries(); }}
        sx={{
          minWidth: 150,
          '& .MuiOutlinedInput-root': {
            bgcolor: light ? 'rgba(255,255,255,0.12)' : 'background.paper',
            color: light ? '#fff' : 'text.primary',
          },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: light ? 'rgba(255,255,255,0.3)' : undefined },
          '& .MuiSvgIcon-root': { color: light ? '#fff' : undefined },
        }}
      >
        {mine.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
      </TextField>
    </Tooltip>
  );
}
