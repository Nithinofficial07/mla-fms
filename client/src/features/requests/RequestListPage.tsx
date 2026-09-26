import { useMemo, useState } from 'react';
import {
  Box, Button, Collapse, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { DateRangeQuickFilter } from '@/components/DateRangeQuickFilter';
import { EmptyState } from '@/components/EmptyState';
import { EmptyBoxIllustration } from '@/components/illustrations/Illustrations';
import { Icon } from '@/components/Icon';
import { StatusChip, PriorityChip } from '@/components/chips';
import { api, errorMessage } from '@/api/client';
import { downloadViaApi } from '@/lib/download';
import { useAuth } from '@/app/AuthProvider';
import { useDepartments, useStatuses, usePriorities } from '@/hooks/useOptions';
import { useViewMode, type ViewMode } from '@/hooks/useViewMode';
import { RequestDetailDialog } from './RequestDetailDialog';
import { RequestKanbanView } from './RequestKanbanView';
import { PERMISSIONS } from '@mla/shared';

const BUCKETS: Record<string, string[]> = {
  pending: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'AWAITING_INFO'],
  'in-progress': ['IN_PROGRESS', 'FORWARDED', 'DEPT_RESPONSE'],
  completed: ['COMPLETED', 'APPROVED', 'CLOSED'],
};

export function RequestListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sp, setSp] = useSearchParams();
  const [viewMode, setViewMode] = useViewMode('requests', 'table');
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const departments = useDepartments();
  const statuses = useStatuses();
  const priorities = usePriorities();

  const bucket = sp.get('bucket') ?? '';
  const params = useMemo(() => {
    const p: Record<string, string | number> = {
      page: page.page + 1,
      pageSize: viewMode === 'board' ? 50 : page.pageSize,
      sort: '-createdAt',
    };
    if (search) p.search = search;
    for (const k of ['statusCode', 'priorityId', 'departmentId', 'wardId', 'gramPanchayatId', 'overdue', 'from', 'to']) {
      const v = sp.get(k);
      if (v) p[k] = v;
    }
    if (bucket && BUCKETS[bucket]) p.statusCode = BUCKETS[bucket].join(',');
    return p;
  }, [page, search, sp, bucket, viewMode]);

  const { data, isFetching } = useQuery({
    queryKey: ['requests', params],
    queryFn: () => api.get('/requests', { params }).then((r) => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, toStatusCode }: { id: string; toStatusCode: string }) =>
      api.post(`/requests/${id}/status`, { toStatusCode }),
    onSuccess: () => {
      enqueueSnackbar('Status updated successfully', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => enqueueSnackbar(errorMessage(e, 'Failed to update status'), { variant: 'error' }),
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('bucket');
    setSp(next);
  };

  const FILTER_KEYS = ['statusCode', 'priorityId', 'departmentId', 'wardId', 'gramPanchayatId', 'overdue', 'bucket', 'from', 'to'];
  const activeFilters = FILTER_KEYS.filter((k) => sp.get(k)).length;
  const clearFilters = () => {
    const next = new URLSearchParams(sp);
    FILTER_KEYS.forEach((k) => next.delete(k));
    setSp(next);
  };

  const columns = [
    { field: 'fileId', headerName: 'File ID', width: 150 },
    { field: 'date', headerName: 'Date', width: 110, valueGetter: (_v: unknown, r: any) => dayjs(r.createdAt).format('DD MMM YY') },
    { field: 'applicant', headerName: 'Applicant', width: 160, valueGetter: (_v: unknown, r: any) => r.applicant?.name },
    { field: 'mobile', headerName: 'Mobile', width: 130, valueGetter: (_v: unknown, r: any) => r.applicant?.mobile },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 200 },
    { field: 'department', headerName: 'Department', width: 170, valueGetter: (_v: unknown, r: any) => r.primaryDepartmentId?.name ?? 'Unassigned' },
    { field: 'priority', headerName: 'Priority', width: 120, renderCell: (p: any) => <PriorityChip code={p.row.priorityId?.code} label={p.row.priorityId?.name} /> },
    { field: 'status', headerName: 'Status', width: 160, renderCell: (p: any) => <StatusChip code={p.row.statusCode} label={p.row.statusId?.name} /> },
    { field: 'dueDate', headerName: 'Due', width: 110, valueGetter: (_v: unknown, r: any) => (r.dueDate ? dayjs(r.dueDate).format('DD MMM YY') : '—') },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: (p: any) => (
        <Button size="small" onClick={(e) => { e.stopPropagation(); setDetailId(p.row.id); }}>
          Open
        </Button>
      ),
    },
  ];

  const doExport = async (fmt: string) => {
    setExporting(fmt);
    try {
      await downloadViaApi('/reports/pending', { ...(params as Record<string, string>), format: fmt }, `requests.${fmt}`);
    } catch (e) {
      enqueueSnackbar(errorMessage(e, 'Export failed'), { variant: 'error' });
    } finally {
      setExporting('');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Requests & Casework"
        subtitle="Manage and track constituency files, petitions and departmental assignments"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Requests' }]}
        action={
          can(PERMISSIONS.REQUEST_CREATE) && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/requests/new')}>
              New Request
            </Button>
          )
        }
      />

      {/* Search and Action Bar */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Search file ID, applicant, mobile, subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <Icon name="Search" sx={{ mr: 1, opacity: 0.6 }} /> }}
        />
        {isMobile && (
          <Button
            variant={activeFilters ? 'contained' : 'outlined'}
            onClick={() => setFiltersOpen((o) => !o)}
            startIcon={<Icon name="FilterList" />}
            sx={{ flexShrink: 0 }}
          >
            {activeFilters ? `Filters (${activeFilters})` : 'Filters'}
          </Button>
        )}
        {!isMobile && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_e, v: ViewMode | null) => v && setViewMode(v)}
            sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
          >
            <ToggleButton value="table">
              <Tooltip title="Table View"><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewList" /></Box></Tooltip>
            </ToggleButton>
            <ToggleButton value="cards">
              <Tooltip title="Cards View"><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewModule" /></Box></Tooltip>
            </ToggleButton>
            <ToggleButton value="board">
              <Tooltip title="Kanban Pipeline"><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewKanban" /></Box></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      <Collapse in={!isMobile || filtersOpen}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
          <TextField size="small" select label="Status" value={sp.get('statusCode') ?? ''} onChange={(e) => setFilter('statusCode', e.target.value)} sx={{ minWidth: 150 }} fullWidth={isMobile}>
            <MenuItem value="">All Statuses</MenuItem>
            {(statuses.data ?? []).map((s) => <MenuItem key={s.id} value={(s as any).code}>{s.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Department" value={sp.get('departmentId') ?? ''} onChange={(e) => setFilter('departmentId', e.target.value)} sx={{ minWidth: 170 }} fullWidth={isMobile}>
            <MenuItem value="">All Departments</MenuItem>
            {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Priority" value={sp.get('priorityId') ?? ''} onChange={(e) => setFilter('priorityId', e.target.value)} sx={{ minWidth: 140 }} fullWidth={isMobile}>
            <MenuItem value="">All Priorities</MenuItem>
            {(priorities.data ?? []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <DateRangeQuickFilter
            from={sp.get('from') ?? ''}
            to={sp.get('to') ?? ''}
            onApply={(f, t) => {
              const next = new URLSearchParams(sp);
              if (f) next.set('from', f); else next.delete('from');
              if (t) next.set('to', t); else next.delete('to');
              next.delete('bucket');
              setSp(next);
            }}
          />
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            {activeFilters > 0 && (
              <Button onClick={clearFilters} color="inherit" startIcon={<Icon name="Close" />}>Clear</Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => doExport('xlsx')} disabled={!!exporting} startIcon={<Icon name="TableView" />}>Excel</Button>
            <Button onClick={() => doExport('pdf')} disabled={!!exporting} startIcon={<Icon name="PictureAsPdf" />}>PDF</Button>
          </Stack>
        </Stack>
      </Collapse>

      {data && data.total === 0 ? (
        <EmptyState
          illustration={EmptyBoxIllustration}
          title="No requests found"
          description="Try clearing filters, or create a new request."
          action={can(PERMISSIONS.REQUEST_CREATE) && <Button variant="contained" onClick={() => navigate('/requests/new')}>New Request</Button>}
        />
      ) : viewMode === 'board' && !isMobile ? (
        <RequestKanbanView
          rows={data?.data ?? []}
          loading={isFetching}
          onSelect={(id) => setDetailId(id)}
          onStatusChange={(id, toStatus) => updateStatus.mutate({ id, toStatusCode: toStatus })}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns as never}
          loading={isFetching}
          rowCount={data?.total ?? 0}
          paginationModel={page}
          onPaginationModelChange={setPage}
          onRowClick={(p) => setDetailId(String(p.id))}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      )}

      <RequestDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </Box>
  );
}
