import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useBranding } from '@/hooks/useBranding';

/** Full cut-out (transparent PNG) and a square face crop, both in client/public. */
export const LEADER_PHOTO = '/leader.png';
export const LEADER_FACE = '/leader-face.png';

/** A CSS size, or MUI breakpoint map of sizes (e.g. { xs: 120, sm: 150 }). */
type Size = number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>;

/**
 * Upper-body cut-out that fades out at the waist, for dark brand panels
 * (login page, dashboard banner). `height` is the visible window - the image
 * is anchored to the top so the face is always in frame.
 */
export function LeaderCutout({ height, width }: { height: Size; width: Size }) {
  const { data } = useBranding();
  return (
    <Box
      component="img"
      src={LEADER_PHOTO}
      alt={data?.leaderName || ''}
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
  const { data } = useBranding();
  if (!data?.leaderName && !data?.leaderTitle) return null;
  return (
    <Box sx={{ textAlign: align }}>
      {data.leaderName && <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', lineHeight: 1.2 }}>{data.leaderName}</Typography>}
      {data.leaderTitle && <Typography variant="body2" sx={{ color: '#F2C94C', fontWeight: 600 }}>{data.leaderTitle}</Typography>}
    </Box>
  );
}

/** Round headshot + caption for the top of the sidebar; just the headshot when the rail is collapsed. */
export function LeaderSidebarCard({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useBranding();
  const name = data?.leaderName || '';
  const avatar = (
    <Avatar
      src={LEADER_FACE}
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
      <Tooltip title={[name, data?.leaderTitle].filter(Boolean).join(' – ')} placement="right">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>{avatar}</Box>
      </Tooltip>
    );
  }
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.5 }}>
      {avatar}
      {(name || data?.leaderTitle) && (
        <Box sx={{ minWidth: 0 }}>
          {name && <Typography variant="body2" fontWeight={700} noWrap>{name}</Typography>}
          {data?.leaderTitle && <Typography variant="caption" color="text.secondary" noWrap component="div">{data.leaderTitle}</Typography>}
        </Box>
      )}
    </Stack>
  );
}
