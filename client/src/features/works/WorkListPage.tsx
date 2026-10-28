import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Grid, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { IMPLEMENTING_AGENCIES, PERMISSIONS, THIRD_PARTY_INSPECTION_STATUSES, financialYears } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { EmptyBoxIllustration } from '@/components/illustrations/Illustrations';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { downloadViaApi } from '@/lib/download';
import { useDepartments, useGramPanchayats, useVillages, useWards } from '@/hooks/useOptions';
import { toAlpha, toRoman } from '../requests/locationPayload';
import { workLocationLabel } from './workLocationPayload';

const FILTER_KEYS = ['fundingYear', 'gramPanchayatId', 'villageId', 'wardId', 'departmentId', 'implementingAgency', 'thirdPartyInspection', 'search'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const lakhs = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * All Works. Every filter lives in the URL so a filtered view (e.g. one GP
 * in 2025-26) can be bookmarked or shared. Village options depend on the
 * picked GP; picking a Ward clears GP/Village and vice versa, since a work
 * is in exactly one of the two.
 */
export function WorkListPage() {
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const myAgency = user?.implementingAgency ?? null;
  const { enqueueSnackbar } = useSnackbar();
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [searchText, setSearchText] = useState(sp.get('search') ?? '');
  const [exporting, setExporting] = useState(false);

  const years = useMemo(() => financialYears(), []);
  const departments = useDepartments();
  const gps = useGramPanchayats();
  const wards = useWards();
  const get = (k: FilterKey) => sp.get(k) ?? '';
  const villages = useVillages({ gramPanchayatId: get('gramPanchayatId') || undefined });

  const setFilters = (patch: Partial<Record<FilterKey, string>>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setSp(next, { replace: true });
    setPage((p) => ({ ...p, page: 0 }));
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== get('search')) setFilters({ search: searchText.trim() }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    for (const k of FILTER_KEYS) { const v = sp.get(k); if (v) f[k] = v; }
    return f;
  }, [sp]);
  const activeCount = Object.keys(filters).length;

  const params = { ...filters, page: page.page + 1, pageSize: page.pageSize, sort: '-createdAt' };
  const { data, isFetching } = useQuery({
    queryKey: ['works', params],
    queryFn: () => api.get('/works', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ['works', 'summary', filters],
    queryFn: () => api.get('/works/summary', { params: filters }).then((r) => r.data as { count: number; totalAmountLakhs: number }),
    placeholderData: keepPreviousData,
  });

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await downloadViaApi('/works/export.xlsx', filters, 'works.xlsx');
    } catch (e) {
      enqueueSnackbar(errorMessage(e, 'Export failed'), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { field: 'workId', headerName: 'Work ID', width: 105 },
    { field: 'nameOfWork', headerName: 'Name of Work', flex: 2, minWidth: 180 },
    { field: 'department', headerName: 'Department', flex: 1, minWidth: 120, valueGetter: (_v: unknown, r: any) => r.departmentId?.name ?? '—' },
    {
      field: 'implementingAgency', headerName: 'Agency', width: 120,
      valueGetter: (_v: unknown, r: any) => (r.implementingAgency === 'Other' ? r.implementingAgencyOther || 'Other' : r.implementingAgency),
    },
    { field: 'fundingYear', headerName: 'Year', width: 80 },
    { field: 'location', headerName: 'Location', flex: 1.2, minWidth: 140, valueGetter: (_v: unknown, r: any) => workLocationLabel(r.location) },
    {
      field: 'amountLakhs', headerName: 'Amount (L)', width: 100, align: 'right', headerAlign: 'right',
      valueGetter: (_v: unknown, r: any) => lakhs(r.amountLakhs ?? 0),
    },
    {
      field: 'thirdPartyInspection', headerName: 'TPI', width: 125,
      renderCell: (p: any) => (
        <Chip size="small" color={p.row.thirdPartyInspection === 'Completed' ? 'success' : 'default'} label={p.row.thirdPartyInspection} />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Works"
        subtitle={myAgency ? `Works implemented by ${myAgency}` : 'Sanctioned development works across the constituency'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Works' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Icon name="Download" />} disabled={exporting} onClick={exportXlsx}>
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            {can(PERMISSIONS.WORK_CREATE) && (
              <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/works/new')}>New Work</Button>
            )}
          </Stack>
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Year" value={get('fundingYear')} onChange={(e) => setFilters({ fundingYear: e.target.value })}>
                <MenuItem value="">All years</MenuItem>
                {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Gram Panchayat" value={get('gramPanchayatId')}
                onChange={(e) => setFilters({ gramPanchayatId: e.target.value, villageId: '', wardId: '' })}
              >
                <MenuItem value="">All GPs</MenuItem>
                {(gps.data ?? []).map((g) => <MenuItem key={g.id} value={g.id}>{`${toAlpha(g.order ?? 0)} – ${g.name}`}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Village" value={get('villageId')} disabled={!get('gramPanchayatId')}
                helperText={!get('gramPanchayatId') ? 'Pick a GP first' : undefined}
                onChange={(e) => setFilters({ villageId: e.target.value })}
              >
                <MenuItem value="">All villages</MenuItem>
                {(villages.data ?? []).map((v) => <MenuItem key={v.id} value={v.id}>{v.order ? `${toRoman(v.order)} – ${v.name}` : v.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Ward (City)" value={get('wardId')}
                onChange={(e) => setFilters({ wardId: e.target.value, gramPanchayatId: '', villageId: '' })}
              >
                <MenuItem value="">All wards</MenuItem>
                {(wards.data ?? []).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Department" value={get('departmentId')} onChange={(e) => setFilters({ departmentId: e.target.value })}>
                <MenuItem value="">All departments</MenuItem>
                {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
            {!myAgency && <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Agency" value={get('implementingAgency')} onChange={(e) => setFilters({ implementingAgency: e.target.value })}>
                <MenuItem value="">All agencies</MenuItem>
                {IMPLEMENTING_AGENCIES.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </TextField>
            </Grid>}
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Third Party Inspection" value={get('thirdPartyInspection')} onChange={(e) => setFilters({ thirdPartyInspection: e.target.value })}>
                <MenuItem value="">All</MenuItem>
                {THIRD_PARTY_INSPECTION_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Search" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="Work ID, name, engineer, address"
                InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="Search" fontSize="small" /></InputAdornment> }}
              />
            </Grid>
          </Grid>
          {activeCount > 0 && (
            <Button size="small" sx={{ mt: 1 }} onClick={() => { setSearchText(''); setSp(new URLSearchParams(), { replace: true }); }}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={3} sx={{ mb: 2, px: 0.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Total works</Typography>
          <Typography variant="h6" fontWeight={700}>{summary.data?.count ?? '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Total amount</Typography>
          <Typography variant="h6" fontWeight={700}>
            {summary.data ? `₹ ${lakhs(summary.data.totalAmountLakhs)} L` : '—'}
          </Typography>
        </Box>
      </Stack>

      {data && data.total === 0 ? (
        <EmptyState
          illustration={EmptyBoxIllustration}
          title={activeCount ? 'No works match these filters' : 'No works yet'}
          description={activeCount ? 'Try a different year, GP or village.' : 'Add the first sanctioned work.'}
          action={
            activeCount
              ? <Button variant="outlined" onClick={() => { setSearchText(''); setSp(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>
              : can(PERMISSIONS.WORK_CREATE) && <Button variant="contained" onClick={() => navigate('/works/new')}>New Work</Button>
          }
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns as never}
          loading={isFetching}
          rowCount={data?.total ?? 0}
          paginationModel={page}
          onPaginationModelChange={setPage}
          onRowClick={(p) => navigate(`/works/${p.id}`)}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          viewStorageKey="works"
        />
      )}
    </Box>
  );
}
