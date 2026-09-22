import { useState } from 'react';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments } from '@/hooks/useOptions';
import { PERMISSIONS } from '@mla/shared';

export function FundingListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [departmentId, setDepartmentId] = useState('');
  const departments = useDepartments();

  const params: Record<string, string | number> = { page: page.page + 1, pageSize: page.pageSize, sort: '-createdAt' };
  if (departmentId) params.departmentId = departmentId;

  const { data, isFetching } = useQuery({
    queryKey: ['funding', params],
    queryFn: () => api.get('/funding', { params }).then((r) => r.data),
  });

  const columns = [
    { field: 'fundingRequestId', headerName: 'Funding ID', width: 160 },
    { field: 'date', headerName: 'Date', width: 110, valueGetter: (_v: unknown, r: any) => dayjs(r.createdAt).format('DD MMM YY') },
    { field: 'department', headerName: 'Department', width: 220, valueGetter: (_v: unknown, r: any) => r.departmentId?.name ?? '—' },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 200 },
    { field: 'address', headerName: 'Address', flex: 1, minWidth: 200 },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: (p: any) => (
        <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/funding/${p.row.id}`); }}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Funding Requests"
        subtitle="All funding requests submitted to line-department ministries"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Funding', to: '/funding' }, { label: 'All Requests' }]}
        action={
          can(PERMISSIONS.LETTER_CREATE) && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/funding')}>
              New Funding Request
            </Button>
          )
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">All</MenuItem>
          {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
        </TextField>
      </Stack>

      {data && data.total === 0 ? (
        <EmptyState
          icon="AttachMoney"
          title="No funding requests yet"
          description="Pick a department from the Funding page to submit the first one."
          action={<Button variant="contained" onClick={() => navigate('/funding')}>Go to Funding</Button>}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns as never}
          loading={isFetching}
          rowCount={data?.total ?? 0}
          paginationModel={page}
          onPaginationModelChange={setPage}
          onRowClick={(p) => navigate(`/funding/${p.id}`)}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          viewStorageKey="funding"
        />
      )}
    </Box>
  );
}
