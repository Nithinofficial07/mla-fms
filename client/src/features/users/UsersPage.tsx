import { useState } from 'react';
import {
  Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { IMPLEMENTING_AGENCIES, PERMISSIONS, ROLES } from '@mla/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { useResource } from '@/hooks/useResourceList';
import { useDepartments, usePrincipals } from '@/hooks/useOptions';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

export function UsersPage() {
  const { can } = useAuth();
  const canWrite = can(PERMISSIONS.USER_MANAGE);
  const [page, setPage] = useState({ page: 0, pageSize: 25 });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [resetting, setResetting] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { enqueueSnackbar } = useSnackbar();
  const resetPassword = useMutation({
    mutationFn: () => api.post(`/users/${resetting.id}/reset-password`, { password: newPassword }),
    onSuccess: () => {
      enqueueSnackbar(`Password reset for ${resetting.username}. They must change it at next login.`, { variant: 'success' });
      setResetting(null);
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const newPasswordValid = newPassword.length >= 8 && /\d/.test(newPassword) && /[a-zA-Z]/.test(newPassword);

  const { useList, useCreate, useUpdate } = useResource<{ id: string }>('/users');
  const list = useList({ page: page.page + 1, pageSize: page.pageSize });
  const create = useCreate();
  const update = useUpdate();
  const departments = useDepartments();
  const principals = usePrincipals();
  const roles = useQuery({ queryKey: ['roles', 'all'], queryFn: () => api.get('/roles', { params: { pageSize: 100 } }).then((r) => r.data.data) });

  const isAgencyRole = (roles.data ?? []).find((r: any) => r.id === form.roleId)?.code === ROLES.IMPLEMENTING_AGENCY;

  const openCreate = () => { setEditing({}); setForm({ mustChangePassword: true, principalIds: [] }); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      name: row.name, email: row.email, mobile: row.mobile, designation: row.designation,
      roleId: row.roleId?.id ?? row.roleId, departmentId: row.departmentId?.id ?? row.departmentId ?? '',
      principalIds: (row.principalIds ?? []).map((p: any) => p.id ?? p),
      implementingAgencies: row.implementingAgencies ?? [],
    });
  };

  const save = async () => {
    const body = { ...form };
    if (!body.departmentId) delete body.departmentId;
    // Only agency logins carry agencies; clear them if the role changed away.
    if (!isAgencyRole) body.implementingAgencies = [];
    if (editing?.id) { delete body.password; delete body.username; await update.mutateAsync({ id: editing.id, body }); }
    else await create.mutateAsync(body);
    setEditing(null);
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'username', headerName: 'Username', width: 140 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'roleCode', headerName: 'Role', width: 170 },
    { field: 'department', headerName: 'Department / Agency', width: 170, valueGetter: (_v: unknown, r: any) => r.departmentId?.name ?? (r.implementingAgencies?.join(', ') || '—') },
    {
      field: 'principals', headerName: 'Principals', width: 180, sortable: false,
      renderCell: (p: any) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
          {(p.row.principalIds ?? []).length === 0
            ? <Chip size="small" color="warning" variant="outlined" label="None (no access)" />
            : (p.row.principalIds ?? []).map((pr: any) => <Chip key={pr.id ?? pr} size="small" label={pr.code ?? pr} />)}
        </Stack>
      ),
    },
    { field: 'isActive', headerName: 'Status', width: 100, renderCell: (p: any) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} /> },
    {
      field: 'actions', headerName: '', width: 190, sortable: false,
      renderCell: (p: any) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" disabled={!canWrite} onClick={() => openEdit(p.row)}>Edit</Button>
          <Button size="small" disabled={!canWrite} onClick={() => { setResetting(p.row); setNewPassword(''); }}>Reset password</Button>
        </Stack>
      ),
    },
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
            {isAgencyRole && (
              <Autocomplete
                multiple
                options={IMPLEMENTING_AGENCIES.filter((a) => a !== 'Other')}
                value={form.implementingAgencies ?? []}
                onChange={(_e, v) => setForm((s: any) => ({ ...s, implementingAgencies: v }))}
                renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required label="Implementing Agencies"
                    helperText="This login will only see, add and update works of these agencies"
                  />
                )}
              />
            )}
            <TextField select label="Department (required for officers)" value={form.departmentId ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, departmentId: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <Autocomplete
              multiple
              options={principals.data ?? []}
              getOptionLabel={(p) => p.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={(principals.data ?? []).filter((p) => (form.principalIds ?? []).includes(p.id))}
              onChange={(_e, v) => setForm((s: any) => ({ ...s, principalIds: v.map((p) => p.id) }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Principals"
                  placeholder="Add principal"
                  helperText="Which office(s) this user can see/act on. None means no access, even for staff roles."
                />
              )}
              renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option.label} {...getTagProps({ index })} key={option.id} />)}
            />
            {!editing?.id && <TextField label="Temporary password" type="text" value={form.password ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, password: e.target.value }))} required helperText="At least 8 characters with a letter and a number. User must change it at first login." inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!resetting} onClose={() => setResetting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="User" value={resetting ? `${resetting.name} (${resetting.username})` : ''} disabled />
            <TextField
              autoFocus label="New temporary password" type="text" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={!!newPassword && !newPasswordValid}
              helperText="At least 8 characters with a letter and a number. Give it to the user exactly as typed - they'll set their own at next login."
              inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetting(null)}>Cancel</Button>
          <Button variant="contained" disabled={!newPasswordValid || resetPassword.isPending} onClick={() => resetPassword.mutate()}>Reset</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
