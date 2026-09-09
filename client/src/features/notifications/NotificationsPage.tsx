import { useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Card, IconButton, List, ListItem, ListItemAvatar, ListItemButton,
  ListItemText, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';
import { notificationMeta, fromNow } from '@/lib/notificationMeta';

const PAGE = 20;

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const q = useInfiniteQuery({
    queryKey: ['notifications', 'list', tab],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api
        .get('/notifications', { params: { page: pageParam, pageSize: PAGE, ...(tab === 'unread' ? { unread: true } : {}) } })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const items = useMemo(() => q.data?.pages.flatMap((p: any) => p.data) ?? [], [q.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const act = (fn: () => Promise<unknown>) =>
    fn().then(invalidate).catch((e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }));

  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: invalidate });
  const clearRead = useMutation({ mutationFn: () => api.post('/notifications/clear-read'), onSuccess: invalidate });

  const open = (n: any) => {
    if (!n.readAt) void act(() => api.post(`/notifications/${n.id}/read`));
    if (n.link) navigate(n.link);
  };

  return (
    <Box>
      <PageHeader
        title="Notifications"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => readAll.mutate()} disabled={readAll.isPending}>Mark all read</Button>
            <Button size="small" color="inherit" onClick={() => clearRead.mutate()} disabled={clearRead.isPending}>Clear read</Button>
          </Stack>
        }
      />

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="all" label="All" />
        <Tab value="unread" label="Unread" />
      </Tabs>

      {!q.isLoading && items.length === 0 ? (
        <EmptyState icon="NotificationsNone" title="Nothing here" description={tab === 'unread' ? "You're all caught up." : 'Notifications about your requests will show up here.'} />
      ) : (
        <Card>
          <List disablePadding>
            {items.map((n: any) => {
              const meta = notificationMeta(n.type);
              return (
                <ListItem
                  key={n.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row">
                      <Tooltip title={n.readAt ? 'Mark unread' : 'Mark read'}>
                        <IconButton edge="end" size="small" onClick={() => act(() => api.post(`/notifications/${n.id}/${n.readAt ? 'unread' : 'read'}`))}>
                          <Icon name={n.readAt ? 'Circle' : 'FiberManualRecord'} fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton edge="end" size="small" onClick={() => act(() => api.delete(`/notifications/${n.id}`))}>
                          <Icon name="Close" fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemButton onClick={() => open(n)} sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover', py: 1.25 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: `${meta.color}.main`, width: 34, height: 34 }}>
                        <Icon name={meta.icon} sx={{ color: '#fff', fontSize: 18 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={n.readAt ? 400 : 700}>{n.title}</Typography>}
                      secondary={
                        <>
                          {n.body && <Typography variant="body2" color="text.secondary" component="span">{n.body} · </Typography>}
                          <Typography variant="caption" color="text.disabled" component="span">{fromNow(n.createdAt)}</Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          {q.hasNextPage && (
            <Box sx={{ p: 1.5, textAlign: 'center' }}>
              <Button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}
