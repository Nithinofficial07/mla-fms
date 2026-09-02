import { useState } from 'react';
import {
  Autocomplete, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';
import { useResource } from '@/hooks/useResourceList';

export function RolesPage() {
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ permissions: [] });

  const { useList, useCreate, useUpdate } = useResource<{ id: string }>('/roles');
  const list = useList({ page: page.page + 1, pageSize: page.pageSize, includeInactive: 'true' });
  const create = useCreate();
  const update = useUpdate();
  const permMeta = useQuery({ queryKey: ['roles', 'perm-meta'], queryFn: () => api.get('/roles/meta/permissions').then((r) => r.data.permissions as { key: string; value: string }[]) });

  const openCreate = () => { setEditing({}); setForm({ code: '', name: '', description: '', permissions: [] }); };
  const openEdit = (row: any) => { setEditing(row); setForm({ name: row.name, description: row.description, permissions: row.permissions ?? [] }); };

  const save = async () => {
    if (editing?.id) await update.mutateAsync({ id: editing.id, body: { name: form.name, description: form.description, permissions: form.permissions } });
    else await create.mutateAsync(form);
    setEditing(null);
  };

  const columns = [
    { field: 'code', headerName: 'Code', width: 180 },
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'permissions', headerName: 'Permissions', flex: 1, valueGetter: (_v: unknown, r: any) => `${r.permissions?.length ?? 0} granted` },
    { field: 'isSystem', headerName: 'Type', width: 110, renderCell: (p: any) => <Chip size="small" label={p.row.isSystem ? 'System' : 'Custom'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: (p: any) => <Button size="small" onClick={() => openEdit(p.row)}>Edit</Button> },
  ];

  return (
    <Box>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Fine-grained permissions can be attached to any role. SUPER_ADMIN always has everything."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Roles' }]}
        action={<Button variant="contained" startIcon={<Icon name="Add" />} onClick={openCreate}>Add role</Button>}
      />
      <DataTable
        rows={list.data?.data ?? []}
        columns={columns as never}
        loading={list.isFetching}
        rowCount={list.data?.total ?? 0}
        paginationModel={page}
        onPaginationModelChange={setPage}
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editing?.id ? `Edit role: ${editing.code}` : 'Add role'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!editing?.id && <TextField label="Code" value={form.code ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, code: e.target.value.toUpperCase() }))} />}
            <TextField label="Name" value={form.name ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} />
            <TextField label="Description" value={form.description ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))} />
            <Autocomplete
              multiple
              options={(permMeta.data ?? []).map((p) => p.value)}
              value={form.permissions}
              onChange={(_e, v) => setForm((s: any) => ({ ...s, permissions: v }))}
              renderInput={(params) => <TextField {...params} label="Permissions" placeholder="Add permission" />}
              renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)}
            />
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Available: {Object.values(PERMISSIONS).length} permissions across requests, documents, masters, users, reports and audit.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
