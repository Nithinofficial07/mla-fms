import { useState } from 'react';
import {
  Box, Button, Card, CardContent, CardHeader, Chip, Divider, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';
import { downloadViaApi } from '@/lib/download';
import { useDepartments } from '@/hooks/useOptions';

const REPORTS = [
  { key: 'department', label: 'Department', icon: 'AccountBalance' },
  { key: 'ward', label: 'Ward', icon: 'Apartment' },
  { key: 'gram-panchayat', label: 'Gram Panchayat', icon: 'Cottage' },
  { key: 'village', label: 'Village', icon: 'Grass' },
  { key: 'status', label: 'Status', icon: 'SwapHoriz' },
  { key: 'priority', label: 'Priority', icon: 'Flag' },
  { key: 'monthly', label: 'Monthly', icon: 'Today' },
  { key: 'officer', label: 'Officer performance', icon: 'AssignmentInd' },
  { key: 'pending', label: 'Pending files', icon: 'HourglassEmpty' },
  { key: 'overdue', label: 'Overdue files', icon: 'ReportProblem' },
];

export function ReportsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [key, setKey] = useState('department');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [exporting, setExporting] = useState('');
  const departments = useDepartments();

  const params: Record<string, string> = { format: 'json' };
  if (from) params.from = from;
  if (to) params.to = to;
  if (departmentId) params.departmentId = departmentId;

  const report = useQuery({
    queryKey: ['report', key, params],
    queryFn: () => api.get(`/reports/${key}`, { params }).then((r) => r.data),
  });

  const doExport = async (fmt: string) => {
    setExporting(fmt);
    try {
      await downloadViaApi(`/reports/${key}`, { ...params, format: fmt }, `${key}-report.${fmt}`);
    } catch (e) {
      enqueueSnackbar(errorMessage(e, 'Export failed'), { variant: 'error' });
    } finally {
      setExporting('');
    }
  };

  return (
    <Box>
      <PageHeader title="Reports" subtitle="Filter, view and export. Exports respect the active filters." crumbs={[{ label: 'Home', to: '/' }, { label: 'Reports' }]} />

      <Card sx={{ mb: 2 }}>
        <CardHeader title="Choose a report" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
        <Divider />
        <CardContent>
          <ToggleButtonGroup exclusive value={key} onChange={(_e, v) => v && setKey(v)} size="small" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {REPORTS.map((r) => (
              <ToggleButton key={r.key} value={r.key} sx={{ border: '1px solid', borderColor: 'divider !important', borderRadius: '8px !important' }}>
                <Icon name={r.icon} sx={{ mr: 0.75 }} fontSize="small" />
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
            <TextField select size="small" label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">All</MenuItem>
              {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => doExport('csv')} disabled={!!exporting} startIcon={<Icon name="Description" />}>CSV</Button>
            <Button onClick={() => doExport('xlsx')} disabled={!!exporting} startIcon={<Icon name="TableView" />}>Excel</Button>
            <Button onClick={() => doExport('pdf')} disabled={!!exporting} startIcon={<Icon name="PictureAsPdf" />}>PDF</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          avatar={<Icon name={REPORTS.find((r) => r.key === key)?.icon ?? 'BarChart'} sx={{ color: 'primary.main' }} />}
          title={`${REPORTS.find((r) => r.key === key)?.label ?? key} report`}
          action={report.data && <Chip size="small" label={`${report.data.rows.length} row${report.data.rows.length === 1 ? '' : 's'}`} sx={{ mr: 1, mt: 1 }} />}
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
        />
        <Divider />
        <CardContent>
          {report.data && report.data.rows.length === 0 ? (
            <EmptyState icon="BarChart" title="No data for this report" description="Adjust the date range or filters." />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {(report.data?.columns ?? []).map((c: string) => (
                      <TableCell key={c} sx={{ textTransform: 'capitalize' }}>{c}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report.data?.rows ?? []).map((row: Record<string, unknown>, i: number) => (
                    <TableRow key={i} sx={{ bgcolor: i % 2 ? 'action.hover' : 'transparent' }}>
                      {(report.data?.columns ?? []).map((c: string) => (
                        <TableCell key={c}>{String(row[c] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
