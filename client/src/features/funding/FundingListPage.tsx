import { useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FUNDING_STATUSES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { EmptyBoxIllustration } from '@/components/illustrations/Illustrations';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments } from '@/hooks/useOptions';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error'> = {
  SUBMITTED: 'default', SENT_TO_MINISTER: 'info', UNDER_REVIEW: 'warning',
  APPROVED: 'primary', REJECTED: 'error', FUNDS_RELEASED: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted', SENT_TO_MINISTER: 'Sent to Minister', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved', REJECTED: 'Rejected', FUNDS_RELEASED: 'Funds Released',
};

export function FundingListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const departments = useDepartments();

  const params: Record<string, string | number> = { page: page.page + 1, pageSize: page.pageSize, sort: '-createdAt' };
  if (departmentId) params.departmentId = departmentId;
  if (status) params.status = status;

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
    { field: 'letterNo', headerName: 'Letter No', width: 150, valueGetter: (_v: unknown, r: any) => r.letterNo || '—' },
    { field: 'pointPersonName', headerName: 'Point Person', width: 160, valueGetter: (_v: unknown, r: any) => r.pointPersonName || '—' },
    { field: 'pointPersonNumber', headerName: 'Number', width: 140, valueGetter: (_v: unknown, r: any) => r.pointPersonNumber || '—' },
    {
      field: 'status', headerName: 'Status', width: 150,
      renderCell: (p: any) => <Chip size="small" color={STATUS_COLOR[p.row.status] ?? 'default'} label={STATUS_LABEL[p.row.status] ?? p.row.status} />,
    },
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
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          {FUNDING_STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
        </TextField>
      </Stack>

      {data && data.total === 0 ? (
        <EmptyState
          illustration={EmptyBoxIllustration}
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
