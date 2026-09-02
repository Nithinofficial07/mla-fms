import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PageHeader } from '@/components/PageHeader';
import { Icon } from '@/components/Icon';
import { api, errorMessage } from '@/api/client';

interface Report {
  totalRows: number;
  validRows: number;
  createdCount: number;
  errors: { row: number; field: string; message: string }[];
}

const CONFIG = {
  LOCATION: {
    title: 'Bulk Import — Locations',
    endpoint: '/imports/locations',
    templateKind: 'LOCATION',
    hint: 'Columns: area_type (URBAN/RURAL), ward_name, ward_code, gram_panchayat_name, gram_panchayat_code, village_name, village_code, sub_village_name, sub_village_code',
  },
  DEPARTMENT: {
    title: 'Bulk Import — Departments',
    endpoint: '/imports/departments',
    templateKind: 'DEPARTMENT',
    hint: 'Columns: code, name, description, head_name, officer_name, officer_designation, contact_number, email, office_address',
  },
} as const;

export function ImportPage({ kind }: { kind: 'LOCATION' | 'DEPARTMENT' }) {
  const cfg = CONFIG[kind];
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`${cfg.endpoint}?dryRun=${dryRun}`, fd);
      setReport(data.report);
      if (!dryRun) enqueueSnackbar(`Imported ${data.report.createdCount} record(s)`, { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(errorMessage(e), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    const res = await api.get(`/imports/template?kind=${cfg.templateKind}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cfg.templateKind.toLowerCase()}_template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <PageHeader title={cfg.title} subtitle="Validate first, then import. Existing rows are matched by name/code and left untouched." />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Button variant="outlined" startIcon={<Icon name="Download" />} onClick={downloadTemplate}>
              Download template
            </Button>
            <Button component="label" variant="contained" startIcon={<Icon name="UploadFile" />}>
              {file ? file.name : 'Choose spreadsheet'}
              <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} />
            </Button>
            <Button disabled={!file || busy} onClick={() => send(true)}>Validate</Button>
            <Button
              variant="contained"
              color="success"
              disabled={!file || busy || !report || report.errors.length > 0}
              onClick={() => send(false)}
            >
              Import
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {cfg.hint}
          </Typography>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip label={`Rows: ${report.totalRows}`} />
              <Chip color="success" label={`Valid: ${report.validRows}`} />
              <Chip color={report.errors.length ? 'error' : 'default'} label={`Errors: ${report.errors.length}`} />
              {report.createdCount > 0 && <Chip color="primary" label={`Created: ${report.createdCount}`} />}
            </Stack>
            {report.errors.length === 0 ? (
              <Alert severity="success">No validation errors. Ready to import.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Row</TableCell><TableCell>Field</TableCell><TableCell>Message</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {report.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.field}</TableCell>
                      <TableCell>{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
