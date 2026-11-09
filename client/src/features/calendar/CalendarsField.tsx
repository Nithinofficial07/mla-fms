import { Box, Chip, Stack, Typography } from '@mui/material';
import { PERMISSIONS, CALENDAR_CODES, CALENDAR_REAL_CODES, CALENDAR_SS_FAMILY } from '@mla/shared';
import { getActivePrincipal } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { usePrincipals } from '@/hooks/useOptions';

const CHIPS = [...CALENDAR_CODES, CALENDAR_SS_FAMILY];

/**
 * Sensible starting `members` for a brand-new event: the office the top-bar
 * switcher is pinned to, or (on "All") the user's own office(s) - never a
 * silent empty array, which would fail validation with no explanation.
 */
export function useDefaultCalendars(): string[] {
  const { user, can } = useAuth();
  const principals = usePrincipals();
  const active = getActivePrincipal();
  const allView = can(PERMISSIONS.PRINCIPAL_ALL_VIEW);
  const list = principals.data ?? [];

  if (active) {
    const p = list.find((x) => x.id === active);
    return p ? [p.code] : [];
  }
  if (allView) return [];
  return list.filter((p) => user?.principalIds?.includes(p.id)).map((p) => p.code);
}

/** The calendars this user can act on behalf of, plus whether they can act on any (viewAll). */
export function useMyCalendarCodes(): { codes: string[]; viewAll: boolean } {
  const { user, can } = useAuth();
  const principals = usePrincipals();
  const active = getActivePrincipal();
  const allView = can(PERMISSIONS.PRINCIPAL_ALL_VIEW) && !active;
  const list = principals.data ?? [];
  if (active) {
    const p = list.find((x) => x.id === active);
    return { codes: p ? [p.code] : [], viewAll: false };
  }
  return { codes: list.filter((p) => user?.principalIds?.includes(p.id)).map((p) => p.code), viewAll: allView };
}

/**
 * Which calendar(s) - chip multi-select. "SS Family" is a shortcut chip that
 * sets/clears all 3 real calendars at once; it's never stored itself
 * (resolved server-side), so it just shows as filled when all 3 are on.
 */
export function CalendarsField({
  value, onChange, label, size = 'medium',
}: { value: string[]; onChange: (codes: string[]) => void; label?: string; size?: 'small' | 'medium' }) {
  const isWholeFamily = CALENDAR_REAL_CODES.every((c) => value.includes(c));

  const toggle = (code: string) => {
    if (code === CALENDAR_SS_FAMILY.code) {
      onChange(isWholeFamily ? [] : [...CALENDAR_REAL_CODES]);
      return;
    }
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  return (
    <Box>
      {label && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>{label}</Typography>}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {CHIPS.map((c) => {
          const selected = c.code === CALENDAR_SS_FAMILY.code ? isWholeFamily : value.includes(c.code);
          return (
            <Chip
              key={c.code}
              size={size}
              label={c.short}
              onClick={() => toggle(c.code)}
              variant={selected ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 700,
                bgcolor: selected ? c.color : 'transparent',
                color: selected ? '#fff' : 'text.secondary',
                borderColor: selected ? c.color : 'divider',
                '&:hover': { bgcolor: selected ? c.color : 'action.hover' },
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

/** Small read-only chip row, for showing an event's calendars in detail views. */
export function CalendarChips({ members, size = 'small' }: { members: string[]; size?: 'small' | 'medium' }) {
  const whole = CALENDAR_REAL_CODES.every((c) => members.includes(c)) && members.length >= CALENDAR_REAL_CODES.length;
  const show = whole ? [CALENDAR_SS_FAMILY] : CALENDAR_CODES.filter((c) => members.includes(c.code));
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {show.map((c) => (
        <Chip key={c.code} size={size} label={c.short} sx={{ bgcolor: `${c.color}24`, color: c.color, fontWeight: 700, height: size === 'small' ? 22 : 26 }} />
      ))}
    </Stack>
  );
}
