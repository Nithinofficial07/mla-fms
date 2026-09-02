import { useState } from 'react';
import { Box, MenuItem, Stack, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { api } from '@/api/client';
import { AUDIT_ACTIONS } from '@mla/shared';

export function AuditLogPage() {
  const [page, setPage] = useState({ page: 0, pageSize: 50 });
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');

  const params: Record<string, string | number> = { page: page.page + 1, pageSize: page.pageSize };
  if (action) params.action = action;
  if (entity) params.entity = entity;
  if (search) params.search = search;

  const { data, isFetching } = useQuery({
    queryKey: ['audit', params],
    queryFn: () => api.get('/audit-logs', { params }).then((r) => r.data),
  });

  const columns = [
    { field: 'createdAt', headerName: 'Time', width: 170, valueGetter: (_v: unknown, r: any) => dayjs(r.createdAt).format('DD MMM YYYY, hh:mm:ss A') },
    { field: 'actorName', headerName: 'Actor', width: 160 },
    { field: 'actorRole', headerName: 'Role', width: 150 },
    { field: 'action', headerName: 'Action', width: 150 },
    { field: 'entity', headerName: 'Entity', width: 140 },
    { field: 'entityId', headerName: 'Entity ID', width: 200 },
    { field: 'message', headerName: 'Message', flex: 1, minWidth: 160 },
    { field: 'ip', headerName: 'IP', width: 130 },
  ];

  return (
    <Box>
      <PageHeader title="Audit Logs" subtitle="Every sensitive action is recorded here — append-only." crumbs={[{ label: 'Home', to: '/' }, { label: 'Audit Logs' }]} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search actor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <TextField size="small" select label="Action" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          {AUDIT_ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ minWidth: 160 }} />
      </Stack>
      <DataTable
        rows={data?.data ?? []}
        columns={columns as never}
        loading={isFetching}
        rowCount={data?.total ?? 0}
        paginationModel={page}
        onPaginationModelChange={setPage}
      />
    </Box>
  );
}
