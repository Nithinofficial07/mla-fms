import { Chip } from '@mui/material';
import { PERMISSIONS } from '@mla/shared';
import { MasterCrudPage } from '@/components/MasterCrudPage';

const statusCol = {
  field: 'isActive', headerName: 'Status', width: 110,
  renderCell: (p: any) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} />,
};

export function CategoriesPage() {
  return (
    <MasterCrudPage
      title="Request Categories" path="/request-categories" writePermission={PERMISSIONS.CATEGORY_MANAGE}
      crumbs={[{ label: 'Configuration' }, { label: 'Categories' }]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code' },
        { name: 'description', label: 'Description' },
        { name: 'order', label: 'Sort order', type: 'number' },
      ]}
      columns={[
        { field: 'name', headerName: 'Category', flex: 1 },
        { field: 'code', headerName: 'Code', width: 120 },
        { field: 'order', headerName: 'Order', width: 90 },
        statusCol,
      ]}
    />
  );
}

export function StatusesPage() {
  return (
    <MasterCrudPage
      title="Statuses / Workflow" path="/request-statuses" writePermission={PERMISSIONS.STATUS_MANAGE}
      subtitle="Configure workflow states and their allowed transitions (comma-separated status codes)."
      crumbs={[{ label: 'Configuration' }, { label: 'Statuses' }]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'order', label: 'Order', type: 'number' },
        { name: 'color', label: 'Colour (hex)' },
        { name: 'isInitial', label: 'Is initial (new draft) state', type: 'switch', defaultValue: false },
        { name: 'isTerminal', label: 'Is closed / terminal state', type: 'switch', defaultValue: false },
      ]}
      columns={[
        { field: 'order', headerName: '#', width: 60 },
        { field: 'code', headerName: 'Code', width: 150 },
        { field: 'name', headerName: 'Name', flex: 1 },
        { field: 'isInitial', headerName: 'Initial', width: 90, renderCell: (p: any) => (p.row.isInitial ? '✓' : '') },
        { field: 'isTerminal', headerName: 'Terminal', width: 90, renderCell: (p: any) => (p.row.isTerminal ? '✓' : '') },
        statusCol,
      ]}
    />
  );
}

export function PrioritiesPage() {
  return (
    <MasterCrudPage
      title="Priorities" path="/priorities" writePermission={PERMISSIONS.STATUS_MANAGE}
      crumbs={[{ label: 'Configuration' }, { label: 'Priorities' }]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'slaDays', label: 'Default SLA (days)', type: 'number' },
        { name: 'color', label: 'Colour (hex)' },
        { name: 'order', label: 'Order', type: 'number' },
      ]}
      columns={[
        { field: 'name', headerName: 'Priority', flex: 1 },
        { field: 'code', headerName: 'Code', width: 120 },
        { field: 'slaDays', headerName: 'SLA days', width: 110 },
        statusCol,
      ]}
    />
  );
}

export function LookupsPage() {
  return (
    <MasterCrudPage
      title="Lookups" path="/lookups" writePermission={PERMISSIONS.SETTINGS_MANAGE}
      subtitle="Request types, document types and ID types used across forms."
      crumbs={[{ label: 'Configuration' }, { label: 'Lookups' }]}
      fields={[
        { name: 'group', label: 'Group', type: 'select', required: true, options: [
          { value: 'REQUEST_TYPE', label: 'Request type' },
          { value: 'DOCUMENT_TYPE', label: 'Document type' },
          { value: 'ID_TYPE', label: 'ID type' },
        ] },
        { name: 'name', label: 'Name', required: true },
        { name: 'order', label: 'Order', type: 'number' },
      ]}
      columns={[
        { field: 'group', headerName: 'Group', width: 170 },
        { field: 'name', headerName: 'Name', flex: 1 },
        { field: 'order', headerName: 'Order', width: 90 },
        statusCol,
      ]}
    />
  );
}
