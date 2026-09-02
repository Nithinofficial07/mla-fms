import { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { useResource } from '@/hooks/useResourceList';
import { useDepartments } from '@/hooks/useOptions';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

export function UsersPage() {
  const { can } = useAuth();
  const canWrite = can(PERMISSIONS.USER_MANAGE);
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  const { useList, useCreate, useUpdate } = useResource<{ id: string }>('/users');
  const list = useList({ page: page.page + 1, pageSize: page.pageSize });
  const create = useCreate();
  const update = useUpdate();
  const departments = useDepartments();
  const roles = useQuery({ queryKey: ['roles', 'all'], queryFn: () => api.get('/roles', { params: { pageSize: 100 } }).then((r) => r.data.data) });

  const openCreate = () => { setEditing({}); setForm({ mustChangePassword: true }); };
  const openEdit = (row: any) => { setEditing(row); setForm({ name: row.name, email: row.email, mobile: row.mobile, designation: row.designation, roleId: row.roleId?.id ?? row.roleId, departmentId: row.departmentId?.id ?? row.departmentId ?? '' }); };

  const save = async () => {
    const body = { ...form };
    if (!body.departmentId) delete body.departmentId;
    if (editing?.id) { delete body.password; delete body.username; await update.mutateAsync({ id: editing.id, body }); }
    else await create.mutateAsync(body);
    setEditing(null);
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'username', headerName: 'Username', width: 140 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'roleCode', headerName: 'Role', width: 170 },
    { field: 'department', headerName: 'Department', width: 170, valueGetter: (_v: unknown, r: any) => r.departmentId?.name ?? '—' },
    { field: 'isActive', headerName: 'Status', width: 100, renderCell: (p: any) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: (p: any) => <Button size="small" disabled={!canWrite} onClick={() => openEdit(p.row)}>Edit</Button> },
  ];

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle="Admins, MLA users, department officers, operators and viewers"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Users' }]}
        action={canWrite && <Button variant="contained" startIcon={<Icon name="PersonAdd" />} onClick={openCreate}>Add user</Button>}
      />
      <DataTable
        rows={list.data?.data ?? []}
        columns={columns as never}
        loading={list.isFetching}
        rowCount={list.data?.total ?? 0}
        paginationModel={page}
        onPaginationModelChange={setPage}
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? 'Edit user' : 'Add user'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" value={form.name ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} required />
            {!editing?.id && <TextField label="Username" value={form.username ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, username: e.target.value }))} required />}
            <TextField label="Email" value={form.email ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, email: e.target.value }))} required />
            <TextField label="Mobile" value={form.mobile ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, mobile: e.target.value }))} />
            <TextField label="Designation" value={form.designation ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, designation: e.target.value }))} />
            <TextField select label="Role" value={form.roleId ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, roleId: e.target.value }))} required>
              {(roles.data ?? []).map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </TextField>
            <TextField select label="Department (required for officers)" value={form.departmentId ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, departmentId: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            {!editing?.id && <TextField label="Temporary password" type="text" value={form.password ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, password: e.target.value }))} required helperText="User must change it at first login" />}
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
