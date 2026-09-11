import type { ReactNode } from 'react';
import {
  Box, Button, Divider, Drawer, IconButton, Skeleton, Stack, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { Icon } from './Icon';

export interface RecordField {
  label: string;
  value: ReactNode;
}

/**
 * Slide-over quick view: click a row anywhere in the app, see its key
 * details without leaving the list. "Open full file" hands off to the
 * real detail page (actions, documents, remarks, etc. all live there).
 */
export function RecordDrawer({
  open,
  onClose,
  loading,
  eyebrow,
  title,
  subtitle,
  chips,
  fields,
  fullHref,
  fullLabel = 'Open full file',
  footerExtra,
}: {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  eyebrow: string;
  title?: string;
  subtitle?: string;
  chips?: ReactNode;
  fields: RecordField[];
  fullHref?: string;
  fullLabel?: string;
  footerExtra?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 440 }, display: 'flex', flexDirection: 'column' } }}
    >
      <Box
        sx={{
          bgcolor: (t) => alpha(t.palette.primary.main, 0.86),
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#fff',
          px: 3,
          py: 2.5,
          borderBottom: '3px solid',
          borderBottomColor: 'secondary.main',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>{eyebrow}</Typography>
            {loading ? (
              <Skeleton variant="text" width={140} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.25)' }} />
            ) : (
              <Typography variant="h6" fontWeight={800} sx={{ wordBreak: 'break-word' }}>{title}</Typography>
            )}
            {subtitle && !loading && (
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#fff', ml: 1 }}>
            <Icon name="Close" />
          </IconButton>
        </Stack>
        {chips && !loading && <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>{chips}</Box>}
      </Box>

      <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Stack spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={20} />)}
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(96px, auto) 1fr', columnGap: 2, rowGap: 1.5 }}>
            {fields.map((f, i) => (
              <Box key={i} sx={{ display: 'contents' }}>
                <Typography variant="caption" color="text.secondary" sx={{ pt: 0.25 }}>{f.label}</Typography>
                {typeof f.value === 'string' || typeof f.value === 'number' ? (
                  <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                    {f.value === '' || f.value == null ? '—' : f.value}
                  </Typography>
                ) : (
                  <Box sx={{ minWidth: 0 }}>{f.value ?? '—'}</Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {(fullHref || footerExtra) && (
        <>
          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 2 }}>
            {footerExtra}
            {fullHref && (
              <Button
                fullWidth
                variant="contained"
                endIcon={<Icon name="ArrowBack" sx={{ transform: 'rotate(180deg)' }} />}
                onClick={() => navigate(fullHref)}
              >
                {fullLabel}
              </Button>
            )}
          </Stack>
        </>
      )}
    </Drawer>
  );
}
