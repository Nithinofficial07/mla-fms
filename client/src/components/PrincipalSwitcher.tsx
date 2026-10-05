import { useEffect, useState } from 'react';
import { MenuItem, TextField, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@mla/shared';
import { getActivePrincipal, setActivePrincipal } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { usePrincipals } from '@/hooks/useOptions';

const ALL = '__ALL__';

/** Short code for the (narrow) dropdown display - "MLA_S" -> "MLA-S". */
const shortLabel = (code: string) => code.replace('_', '-');

/**
 * Lets a user filter/switch which principal (MLA-S / MLA-N / MP) they're
 * viewing. A PRINCIPAL_ALL_VIEW user (e.g. Super Admin) gets every
 * principal plus an "All" option - narrowing to one actually filters their
 * view server-side (the server only ever honors this to narrow, never
 * widen, past what the account is actually allowed to see). Everyone else
 * only ever sees their own assigned principal(s); renders nothing for a
 * single-principal user since there's nothing to switch between.
 *
 * `selected` is local state and the single source of truth for what the
 * dropdown displays, set synchronously on click - it does NOT wait on
 * `getActivePrincipal()` being re-read by some incidental re-render (that
 * was the bug: the old version read the module-level active id directly in
 * the render body, which only happened to refresh when some other query
 * invalidation happened to re-render this component).
 */
export function PrincipalSwitcher({ light = false }: { light?: boolean }) {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const principals = usePrincipals();
  const allView = can(PERMISSIONS.PRINCIPAL_ALL_VIEW);

  const mine = allView
    ? (principals.data ?? [])
    : (principals.data ?? []).filter((p) => user?.principalIds?.includes(p.id));

  const [selected, setSelected] = useState<string>(() => getActivePrincipal() ?? ALL);

  // Once the principal list is known, make sure `selected` (and the stored
  // active id) is actually valid for whoever is logged in right now - picks
  // up a fresh login, a stale id left over from a previous user on the same
  // browser, or a principal that no longer applies.
  useEffect(() => {
    if (mine.length === 0) return;
    const stored = getActivePrincipal();
    const storedIsValid = !!stored && mine.some((p) => p.id === stored);

    if (allView) {
      setSelected(storedIsValid ? stored! : ALL);
      if (stored && !storedIsValid) { setActivePrincipal(null); qc.invalidateQueries(); }
      return;
    }
    if (storedIsValid) {
      setSelected(stored!);
    } else {
      setSelected(mine[0].id);
      setActivePrincipal(mine[0].id);
      qc.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allView, mine.map((p) => p.id).join(',')]);

  if (!allView && mine.length <= 1) return null;
  if (mine.length === 0) return null;

  const onChange = (id: string) => {
    setSelected(id);
    setActivePrincipal(id === ALL ? null : id);
    qc.invalidateQueries();
  };

  return (
    <Tooltip title="Viewing as">
      <TextField
        select
        size="small"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          width: 88,
          '& .MuiSelect-select': { py: 0.5, fontSize: '0.8125rem', fontWeight: 600 },
          '& .MuiOutlinedInput-root': {
            bgcolor: light ? 'rgba(255,255,255,0.12)' : 'background.paper',
            color: light ? '#fff' : 'text.primary',
          },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: light ? 'rgba(255,255,255,0.3)' : undefined },
          '& .MuiSvgIcon-root': { color: light ? '#fff' : undefined },
        }}
      >
        {allView && <MenuItem value={ALL}>All</MenuItem>}
        {mine.map((p) => <MenuItem key={p.id} value={p.id}>{shortLabel(p.code)}</MenuItem>)}
      </TextField>
    </Tooltip>
  );
}
