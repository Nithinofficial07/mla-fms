import { useMemo, useState } from 'react';
import {
  Box, Button, Collapse, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  // All flex, no fixed widths - the grid distributes the full row width across
  // these 8 columns so nothing ever needs horizontal scroll to see at a
  // glance. Clicking a row opens the full detail (File ID, date, principal,
  // etc. live there instead of as their own columns here).
  const columns = [
    { field: 'applicant', headerName: t('requests.applicant'), flex: 1.1, minWidth: 110, valueGetter: (_v: unknown, r: any) => r.applicant?.name },
    { field: 'mobile', headerName: t('requests.mobile'), flex: 1, minWidth: 100, valueGetter: (_v: unknown, r: any) => r.applicant?.mobile },
    { field: 'subject', headerName: t('requests.subject'), flex: 1.8, minWidth: 160 },
    {
      field: 'location', headerName: 'Ward / GP', flex: 1, minWidth: 100,
      valueGetter: (_v: unknown, r: any) => r.location?.wardId?.name ?? r.location?.gramPanchayatId?.name ?? r.location?.otherPlaceName ?? r.location?.otherLocationPlace ?? '—',
    },
    { field: 'department', headerName: t('requests.department'), flex: 1.1, minWidth: 110, valueGetter: (_v: unknown, r: any) => r.primaryDepartmentId?.name ?? t('common.unassigned') },
    { field: 'priority', headerName: t('requests.priority'), flex: 0.8, minWidth: 90, renderCell: (p: any) => <PriorityChip code={p.row.priorityId?.code} label={p.row.priorityId?.name} /> },
    { field: 'status', headerName: t('requests.status'), flex: 1, minWidth: 110, renderCell: (p: any) => <StatusChip code={p.row.statusCode} label={p.row.statusId?.name} /> },
    { field: 'dueDate', headerName: t('requests.due'), flex: 0.7, minWidth: 80, valueGetter: (_v: unknown, r: any) => (r.dueDate ? dayjs(r.dueDate).format('DD MMM YY') : '—') },
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
        title={t('requests.title')}
        subtitle={t('requests.subtitle')}
        crumbs={[{ label: t('common.home'), to: '/' }, { label: t('nav.requests') }]}
        action={
          can(PERMISSIONS.REQUEST_CREATE) && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/requests/new')}>
              {t('requests.newRequest')}
            </Button>
          )
        }
      />

      {/* Search and Action Bar */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          placeholder={t('requests.searchPlaceholder')}
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
            {activeFilters ? `${t('requests.filters')} (${activeFilters})` : t('requests.filters')}
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
              <Tooltip title={t('requests.tableView')}><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewList" /></Box></Tooltip>
            </ToggleButton>
            <ToggleButton value="cards">
              <Tooltip title={t('requests.cardsView')}><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewModule" /></Box></Tooltip>
            </ToggleButton>
            <ToggleButton value="board">
              <Tooltip title={t('requests.kanbanPipeline')}><Box sx={{ display: 'flex', alignItems: 'center' }}><Icon name="ViewKanban" /></Box></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      <Collapse in={!isMobile || filtersOpen}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
          <TextField size="small" select label={t('requests.status')} value={sp.get('statusCode') ?? ''} onChange={(e) => setFilter('statusCode', e.target.value)} sx={{ minWidth: 150 }} fullWidth={isMobile}>
            <MenuItem value="">{t('requests.allStatuses')}</MenuItem>
            {(statuses.data ?? []).map((s) => <MenuItem key={s.id} value={(s as any).code}>{s.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t('requests.department')} value={sp.get('departmentId') ?? ''} onChange={(e) => setFilter('departmentId', e.target.value)} sx={{ minWidth: 170 }} fullWidth={isMobile}>
            <MenuItem value="">{t('requests.allDepartments')}</MenuItem>
            {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t('requests.priority')} value={sp.get('priorityId') ?? ''} onChange={(e) => setFilter('priorityId', e.target.value)} sx={{ minWidth: 140 }} fullWidth={isMobile}>
            <MenuItem value="">{t('requests.allPriorities')}</MenuItem>
            {(priorities.data ?? []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <DateRangeQuickFilter
            from={sp.get('from') ?? ''}
            to={sp.get('to') ?? ''}
            onApply={(from, to) => {
              const next = new URLSearchParams(sp);
              if (from) next.set('from', from); else next.delete('from');
              if (to) next.set('to', to); else next.delete('to');
              next.delete('bucket');
              setSp(next);
            }}
          />
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            {activeFilters > 0 && (
              <Button onClick={clearFilters} color="inherit" startIcon={<Icon name="Close" />}>{t('requests.clear')}</Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => doExport('xlsx')} disabled={!!exporting} startIcon={<Icon name="TableView" />}>{t('common.excel')}</Button>
            <Button onClick={() => doExport('pdf')} disabled={!!exporting} startIcon={<Icon name="PictureAsPdf" />}>{t('common.pdf')}</Button>
          </Stack>
        </Stack>
      </Collapse>

      {data && data.total === 0 ? (
        <EmptyState
          illustration={EmptyBoxIllustration}
          title={t('requests.noRequestsFound')}
          description={t('requests.tryClearingFilters')}
          action={can(PERMISSIONS.REQUEST_CREATE) && <Button variant="contained" onClick={() => navigate('/requests/new')}>{t('requests.newRequest')}</Button>}
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
