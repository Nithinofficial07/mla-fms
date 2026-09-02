import { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Stack, Switch, TextField,
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { useConfirm } from './ConfirmDialog';
import { useResource } from '@/hooks/useResourceList';
import { useAuth } from '@/app/AuthProvider';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'switch' | 'multiselect';
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  helperText?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  path: string;
  columns: GridColDef[];
  fields: FieldDef[];
  writePermission: string;
  baseFilter?: Record<string, string>;
  crumbs?: { label: string; to?: string }[];
}

export function MasterCrudPage({
  title, subtitle, path, columns, fields, writePermission, baseFilter = {}, crumbs,
}: Props) {
  const { can } = useAuth();
  const canWrite = can(writePermission);
  const [sp] = useSearchParams();
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const { confirm, dialog } = useConfirm();

  const { useList, useCreate, useUpdate, useRemove } = useResource<{ id: string }>(path);
  const params = {
    ...baseFilter,
    ...Object.fromEntries(sp.entries()),
    page: page.page + 1,
    pageSize: page.pageSize,
    search: search || undefined,
    includeInactive: 'true',
  };
  const list = useList(params);
  const create = useCreate();
  const update = useUpdate();
  const remove = useRemove();

  const openCreate = () => {
    setEditing({});
    setForm(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'switch' ? true : '')])));
  };
  const openEdit = (row: Record<string, any>) => {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [f.name, row[f.name] ?? (f.type === 'switch' ? false : '')])));
  };

  const save = async () => {
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      let v = form[f.name];
      if (f.type === 'number') v = v === '' ? undefined : Number(v);
      if (v !== '' && v !== undefined) body[f.name] = v;
    }
    if (editing?.id) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    setEditing(null);
  };

  const actionCol: GridColDef = {
    field: '__actions',
    headerName: 'Actions',
    sortable: false,
    width: 140,
    renderCell: (p) => (
      <Stack direction="row" spacing={0.5}>
        <Button size="small" disabled={!canWrite} onClick={() => openEdit(p.row)}>
          Edit
        </Button>
        <Button
          size="small"
          color="error"
          disabled={!canWrite}
          onClick={async () => {
            if (await confirm({ title: 'Deactivate', message: `Deactivate "${p.row.name ?? p.row.code}"?`, destructive: true, confirmLabel: 'Deactivate' })) {
              remove.mutate(p.row.id);
            }
          }}
        >
          Off
        </Button>
      </Stack>
    ),
  };

  const gridColumns = useMemo(() => [...columns, actionCol], [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        crumbs={crumbs}
        action={
          canWrite && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={openCreate}>
              Add {title.replace(/s$/, '')}
            </Button>
          )
        }
      />

      <TextField
        size="small"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{ startAdornment: <Icon name="Search" sx={{ mr: 1, opacity: 0.6 }} /> }}
      />

      {list.data && list.data.total === 0 && !search ? (
        <EmptyState
          icon="Inbox"
          title={`No ${title.toLowerCase()} yet`}
          description="Add the first record, or use bulk import where available."
          action={canWrite && <Button variant="contained" onClick={openCreate}>Add {title.replace(/s$/, '')}</Button>}
        />
      ) : (
        <DataTable
          rows={list.data?.data ?? []}
          columns={gridColumns}
          loading={list.isFetching}
          rowCount={list.data?.total ?? 0}
          paginationModel={page}
          onPaginationModelChange={setPage}
        />
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {fields.map((f) => {
              if (f.type === 'switch') {
                return (
                  <FormControlLabel
                    key={f.name}
                    control={<Switch checked={!!form[f.name]} onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.checked }))} />}
                    label={f.label}
                  />
                );
              }
              return (
                <TextField
                  key={f.name}
                  select={f.type === 'select'}
                  type={f.type === 'number' ? 'number' : 'text'}
                  label={f.label}
                  required={f.required}
                  helperText={f.helperText}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                  fullWidth
                >
                  {f.options?.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={create.isPending || update.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {dialog}
    </Box>
  );
}
