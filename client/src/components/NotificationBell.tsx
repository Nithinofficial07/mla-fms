import { useState } from 'react';
import {
  Avatar, Badge, Box, Button, Divider, IconButton, List, ListItemButton, ListItemText,
  Popover, Stack, Tooltip, Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { notificationMeta, fromNow } from '@/lib/notificationMeta';

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.count as number),
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  const recent = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get('/notifications', { params: { pageSize: 8 } }).then((r) => r.data),
    enabled: open,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const openItem = (n: any) => {
    if (!n.readAt) api.post(`/notifications/${n.id}/read`).then(refresh);
    setAnchor(null);
    if (n.link) navigate(n.link);
  };

  const items = recent.data?.data ?? [];

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: '#fff' }}>
          <Badge color="error" badgeContent={unread.data ?? 0} max={99}>
            <Icon name="Notifications" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '92vw' } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2">Notifications</Typography>
          <Button
            size="small"
            disabled={!(unread.data ?? 0)}
            onClick={() => api.post('/notifications/read-all').then(refresh)}
          >
            Mark all read
          </Button>
        </Stack>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {recent.isLoading ? 'Loading…' : "You're all caught up."}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {items.map((n: any) => {
              const meta = notificationMeta(n.type);
              return (
                <ListItemButton key={n.id} onClick={() => openItem(n)} sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover', alignItems: 'flex-start', gap: 1.25, py: 1 }}>
                  <Avatar sx={{ bgcolor: `${meta.color}.main`, width: 30, height: 30, mt: 0.25 }}>
                    <Icon name={meta.icon} sx={{ color: '#fff', fontSize: 16 }} />
                  </Avatar>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={n.readAt ? 400 : 700} noWrap>{n.title}</Typography>}
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap component="span">
                        {n.body ? `${n.body} · ` : ''}{fromNow(n.createdAt)}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}

        <Divider />
        <Box sx={{ textAlign: 'center', py: 0.5 }}>
          <Button size="small" fullWidth onClick={() => { setAnchor(null); navigate('/notifications'); }}>
            View all
          </Button>
        </Box>
      </Popover>
    </>
  );
}
