import { Chip } from '@mui/material';
import { PERMISSIONS } from '@mla/shared';
import { MasterCrudPage, type FieldDef } from '@/components/MasterCrudPage';

const fields: FieldDef[] = [
  {
    name: 'code', label: 'Code', required: true, type: 'select',
    options: [
      { value: 'MLA_S', label: 'MLA – South' },
      { value: 'MLA_N', label: 'MLA – North' },
      { value: 'MP', label: 'Member of Parliament' },
    ],
    helperText: 'Fixed at creation — cannot be changed afterward',
  },
  { name: 'label', label: 'Display label', required: true },
  { name: 'idPrefix', label: 'ID prefix', required: true, helperText: 'Used in generated file/letter/funding IDs, e.g. "MLA-S"' },
];

export function PrincipalsPage() {
  return (
    <MasterCrudPage
      title="Principals"
      subtitle="The office's principals — every request, letter and funding request belongs to exactly one."
      path="/principals"
      writePermission={PERMISSIONS.PRINCIPAL_MANAGE}
      crumbs={[{ label: 'Home', to: '/' }, { label: 'Principals' }]}
      fields={fields}
      columns={[
        { field: 'label', headerName: 'Principal', flex: 1, minWidth: 200 },
        { field: 'code', headerName: 'Code', width: 120 },
        { field: 'idPrefix', headerName: 'ID prefix', width: 140 },
        {
          field: 'isActive', headerName: 'Status', width: 110,
          renderCell: (p) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} />,
        },
      ]}
    />
  );
}
