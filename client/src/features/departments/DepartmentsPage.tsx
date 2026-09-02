import { Chip } from '@mui/material';
import { PERMISSIONS } from '@mla/shared';
import { MasterCrudPage, type FieldDef } from '@/components/MasterCrudPage';

const fields: FieldDef[] = [
  { name: 'code', label: 'Department code', required: true },
  { name: 'name', label: 'Department name', required: true },
  { name: 'description', label: 'Description' },
  { name: 'headName', label: 'Department head' },
  { name: 'officerName', label: 'Officer name' },
  { name: 'officerDesignation', label: 'Officer designation' },
  { name: 'contactNumber', label: 'Contact number' },
  { name: 'email', label: 'Email' },
  { name: 'officeAddress', label: 'Office address' },
];

export function DepartmentsPage() {
  return (
    <MasterCrudPage
      title="Departments"
      subtitle="Line departments — add, edit, deactivate. Deletion is blocked while requests reference a department."
      path="/departments"
      writePermission={PERMISSIONS.DEPARTMENT_MANAGE}
      crumbs={[{ label: 'Home', to: '/' }, { label: 'Departments' }]}
      fields={fields}
      columns={[
        { field: 'code', headerName: 'Code', width: 110 },
        { field: 'name', headerName: 'Department', flex: 1, minWidth: 200 },
        { field: 'headName', headerName: 'Head', width: 160 },
        { field: 'contactNumber', headerName: 'Contact', width: 140 },
        {
          field: 'isActive', headerName: 'Status', width: 110,
          renderCell: (p) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} />,
        },
        { field: 'isDemo', headerName: 'Demo', width: 80, renderCell: (p) => (p.row.isDemo ? <Chip size="small" color="warning" label="DEMO" /> : null) },
      ]}
    />
  );
}
