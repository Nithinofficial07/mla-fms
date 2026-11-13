import { useSyncExternalStore } from 'react';
import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { getActivePrincipal, onActivePrincipalChange } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { useBranding } from '@/hooks/useBranding';
import { usePrincipals } from '@/hooks/useOptions';

/** Full cut-out (transparent PNG) and a square face crop, both in client/public. */
export const LEADER_PHOTO = '/leader.png';
export const LEADER_FACE = '/leader-face.png';

/**
 * Principals with their own photo. Anyone not listed (MLA South, and "All")
 * uses the default photo above with the name / title from Settings.
 * To add MLA North: drop leader-mla-n.png + leader-mla-n-face.png in client/public and add an entry.
 */
const LEADER_BY_PRINCIPAL: Record<string, { photo: string; face: string; name: string; title: string; constituency?: string }> = {
  MP: {
    photo: '/leader-mp.png',
    face: '/leader-mp-face.png',
    name: 'Dr. Prabha Mallikarjun',
    title: 'Member of Parliament',
    constituency: 'Davanagere Lok Sabha Constituency',
  },
};

/** Photo, face crop and caption for whichever principal the user is acting as right now. */
export function useActiveLeader() {
  const { user } = useAuth();
  const { data: branding } = useBranding();
  // Re-renders when the "Viewing as" switcher changes the principal.
  const activeId = useSyncExternalStore(onActivePrincipalChange, getActivePrincipal);
  const principals = usePrincipals(!!user);
  const code = user && activeId ? principals.data?.find((p) => p.id === activeId)?.code : undefined;
  const own = code ? LEADER_BY_PRINCIPAL[code] : undefined;
  return {
    code,
    photo: own?.photo ?? LEADER_PHOTO,
    face: own?.face ?? LEADER_FACE,
    name: own ? own.name : branding?.leaderName ?? '',
    title: own ? own.title : branding?.leaderTitle ?? '',
    constituency: own?.constituency ?? branding?.constituencyName ?? '',
  };
}

/** A CSS size, or MUI breakpoint map of sizes (e.g. { xs: 120, sm: 150 }). */
type Size = number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>;

/**
 * Upper-body cut-out that fades out at the waist, for dark brand panels
 * (login page, dashboard banner). `height` is the visible window - the image
 * is anchored to the top so the face is always in frame.
 */
export function LeaderCutout({ height, width }: { height: Size; width: Size }) {
  const leader = useActiveLeader();
  return (
    <Box
      component="img"
      key={leader.photo}
      src={leader.photo}
      alt={leader.name}
      sx={{
        display: 'block',
        height,
        width,
        objectFit: 'cover',
        objectPosition: 'top',
        // No drop-shadow: combined with the mask it paints a faint box around the cut-out.
        maskImage: 'linear-gradient(to bottom, #000 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 85%, transparent 100%)',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    />
  );
}

/** Name over title, in white, for the dark brand panels. Renders nothing until a name is set in Settings. */
export function LeaderCaption({ align = 'left' }: { align?: 'left' | 'center' }) {
  const { name, title } = useActiveLeader();
  if (!name && !title) return null;
  return (
    <Box sx={{ textAlign: align }}>
      {name && <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', lineHeight: 1.2 }}>{name}</Typography>}
      {title && <Typography variant="body2" sx={{ color: '#F2C94C', fontWeight: 600 }}>{title}</Typography>}
    </Box>
  );
}

/** Round headshot + caption for the top of the sidebar; just the headshot when the rail is collapsed. */
export function LeaderSidebarCard({ collapsed = false }: { collapsed?: boolean }) {
  const { face, name, title } = useActiveLeader();
  const avatar = (
    <Avatar
      src={face}
      alt={name}
      sx={(t) => ({
        width: collapsed ? 40 : 46,
        height: collapsed ? 40 : 46,
        bgcolor: alpha(t.palette.primary.main, 0.12),
        border: '2px solid',
        borderColor: 'secondary.main',
        flexShrink: 0,
      })}
    />
  );
  if (collapsed) {
    return (
      <Tooltip title={[name, title].filter(Boolean).join(' – ')} placement="right">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>{avatar}</Box>
      </Tooltip>
    );
  }
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.5 }}>
      {avatar}
      {(name || title) && (
        <Box sx={{ minWidth: 0 }}>
          {name && <Typography variant="body2" fontWeight={700} noWrap>{name}</Typography>}
          {title && <Typography variant="caption" color="text.secondary" noWrap component="div">{title}</Typography>}
        </Box>
      )}
    </Stack>
  );
}
