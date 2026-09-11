import { useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LETTER_STATUSES, PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments } from '@/hooks/useOptions';
import { LetterQuickView } from './LetterQuickView';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success' | 'warning'> = {
  DRAFT: 'default', ISSUED: 'info', DISPATCHED: 'primary', REPLIED: 'warning', CLOSED: 'success',
};

export function LetterListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const departments = useDepartments();

  const params: Record<string, string | number> = { page: page.page + 1, pageSize: page.pageSize, sort: '-date' };
  if (search) params.search = search;
  if (status) params.status = status;
  if (departmentId) params.departmentId = departmentId;

  const { data, isFetching } = useQuery({
    queryKey: ['letters', params],
    queryFn: () => api.get('/letters', { params }).then((r) => r.data),
  });

  const columns = [
    { field: 'letterNo', headerName: 'Letter No', width: 170 },
    { field: 'date', headerName: 'Date', width: 110, valueGetter: (_v: unknown, r: any) => dayjs(r.date).format('DD MMM YY') },
    { field: 'applicant', headerName: 'Applicant', width: 160, valueGetter: (_v: unknown, r: any) => r.applicant?.name },
    { field: 'mobile', headerName: 'Phone', width: 130, valueGetter: (_v: unknown, r: any) => r.applicant?.mobile },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 200 },
    { field: 'referredBy', headerName: 'Referred by', width: 150 },
    { field: 'department', headerName: 'Department', width: 170, valueGetter: (_v: unknown, r: any) => r.departmentId?.name ?? '—' },
    { field: 'departmentLetterNo', headerName: 'Dept. Letter No', width: 150 },
    { field: 'status', headerName: 'Status', width: 130, renderCell: (p: any) => <Chip size="small" color={STATUS_COLOR[p.row.status] ?? 'default'} label={p.row.status} /> },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: (p: any) => (
        <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/letters/${p.row.id}`); }}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="MLA Letters"
        subtitle="Letters issued / tracked by the office"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'MLA Letters' }]}
        action={can(PERMISSIONS.LETTER_CREATE) && (
          <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/letters/new')}>New Letter</Button>
        )}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search letter no, applicant, phone, subject…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }} InputProps={{ startAdornment: <Icon name="Search" sx={{ mr: 1, opacity: 0.6 }} /> }} />
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All</MenuItem>
          {LETTER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
        </TextField>
      </Stack>

      {data && data.total === 0 ? (
        <EmptyState icon="Drafts" title="No letters yet" description="Create the first MLA letter." action={can(PERMISSIONS.LETTER_CREATE) && <Button variant="contained" onClick={() => navigate('/letters/new')}>New Letter</Button>} />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns as never}
          loading={isFetching}
          rowCount={data?.total ?? 0}
          paginationModel={page}
          onPaginationModelChange={setPage}
          onRowClick={(p) => setQuickViewId(String(p.id))}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      )}

      <LetterQuickView id={quickViewId} onClose={() => setQuickViewId(null)} />
    </Box>
  );
}
