import { Box, Button, Card, List, ListItemButton, ListItemText, Stack } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { api } from '@/api/client';

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => api.get('/notifications', { params: { pageSize: 50 } }).then((r) => r.data) });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = list.data?.data ?? [];

  return (
    <Box>
      <PageHeader
        title="Notifications"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]}
        action={<Button onClick={() => readAll.mutate()} disabled={readAll.isPending}>Mark all read</Button>}
      />
      {!list.isLoading && items.length === 0 ? (
        <EmptyState icon="NotificationsNone" title="No notifications" description="You're all caught up." />
      ) : (
        <Card>
          <List>
            {items.map((n: any) => (
              <ListItemButton
                key={n.id}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  if (n.link) navigate(n.link);
                }}
                sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover' }}
              >
                <ListItemText
                  primary={<Stack direction="row" justifyContent="space-between"><span>{n.title}</span><span style={{ opacity: 0.6, fontSize: 12 }}>{dayjs(n.createdAt).format('DD MMM, hh:mm A')}</span></Stack>}
                  secondary={n.body}
                />
              </ListItemButton>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
}
