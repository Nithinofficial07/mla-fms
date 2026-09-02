import { Chip } from '@mui/material';
import { PERMISSIONS } from '@mla/shared';
import { useQuery } from '@tanstack/react-query';
import { MasterCrudPage, type FieldDef } from '@/components/MasterCrudPage';
import { api } from '@/api/client';

const LOC = PERMISSIONS.LOCATION_MANAGE;
const statusCol = {
  field: 'isActive', headerName: 'Status', width: 110,
  renderCell: (p: any) => <Chip size="small" color={p.row.isActive ? 'success' : 'default'} label={p.row.isActive ? 'Active' : 'Inactive'} />,
};

function useConstituencyOptions() {
  const { data } = useQuery({
    queryKey: ['opt', 'constituencies'],
    queryFn: () => api.get('/constituencies', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  return (data ?? []).map((c: any) => ({ value: c.id, label: c.name }));
}
function useGpOptions() {
  const { data } = useQuery({
    queryKey: ['opt', 'gps', 'all'],
    queryFn: () => api.get('/gram-panchayats', { params: { pageSize: 500 } }).then((r) => r.data.data),
  });
  return (data ?? []).map((g: any) => ({ value: g.id, label: g.name }));
}
function useVillageOptions() {
  const { data } = useQuery({
    queryKey: ['opt', 'villages', 'all'],
    queryFn: () => api.get('/villages', { params: { pageSize: 1000 } }).then((r) => r.data.data),
  });
  return (data ?? []).map((v: any) => ({ value: v.id, label: v.name }));
}

export function AreaTypesPage() {
  return (
    <MasterCrudPage
      title="Area Types" path="/area-types" writePermission={LOC}
      crumbs={[{ label: 'Locations' }, { label: 'Area Types' }]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'childLabel', label: 'Child label (e.g. Ward)' },
      ]}
      columns={[
        { field: 'code', headerName: 'Code', width: 120 },
        { field: 'name', headerName: 'Name', flex: 1 },
        { field: 'childLabel', headerName: 'Child label', width: 180 },
        statusCol,
      ]}
    />
  );
}

export function WardsPage() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Ward name', required: true },
    { name: 'number', label: 'Ward number' },
    { name: 'code', label: 'Code' },
    { name: 'description', label: 'Description' },
    { name: 'constituencyId', label: 'Constituency', type: 'select', required: true, options: useConstituencyOptions() },
  ];
  return (
    <MasterCrudPage
      title="Wards" path="/wards" writePermission={LOC}
      crumbs={[{ label: 'Locations' }, { label: 'Wards' }]}
      fields={fields}
      columns={[
        { field: 'name', headerName: 'Ward', flex: 1 },
        { field: 'number', headerName: 'No.', width: 80 },
        { field: 'code', headerName: 'Code', width: 120 },
        statusCol,
      ]}
    />
  );
}

export function GramPanchayatsPage() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Gram Panchayat name', required: true },
    { name: 'code', label: 'Code' },
    { name: 'description', label: 'Description' },
    { name: 'constituencyId', label: 'Constituency', type: 'select', required: true, options: useConstituencyOptions() },
  ];
  return (
    <MasterCrudPage
      title="Gram Panchayats" path="/gram-panchayats" writePermission={LOC}
      crumbs={[{ label: 'Locations' }, { label: 'Gram Panchayats' }]}
      fields={fields}
      columns={[
        { field: 'name', headerName: 'Gram Panchayat', flex: 1 },
        { field: 'code', headerName: 'Code', width: 140 },
        statusCol,
      ]}
    />
  );
}

export function VillagesPage() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Village name', required: true },
    { name: 'code', label: 'Code' },
    { name: 'parentType', label: 'Parent type', type: 'select', required: true, options: [
      { value: 'GRAM_PANCHAYAT', label: 'Gram Panchayat' },
      { value: 'WARD', label: 'Ward' },
    ] },
    { name: 'gramPanchayatId', label: 'Parent Gram Panchayat', type: 'select', options: useGpOptions() },
  ];
  return (
    <MasterCrudPage
      title="Villages" path="/villages" writePermission={LOC}
      crumbs={[{ label: 'Locations' }, { label: 'Villages' }]}
      fields={fields}
      columns={[
        { field: 'name', headerName: 'Village', flex: 1 },
        { field: 'code', headerName: 'Code', width: 120 },
        { field: 'parentType', headerName: 'Parent', width: 150 },
        statusCol,
      ]}
    />
  );
}

export function SubVillagesPage() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Sub-village name', required: true },
    { name: 'code', label: 'Code' },
    { name: 'villageId', label: 'Parent Village', type: 'select', required: true, options: useVillageOptions() },
  ];
  return (
    <MasterCrudPage
      title="Sub-villages" path="/sub-villages" writePermission={LOC}
      crumbs={[{ label: 'Locations' }, { label: 'Sub-villages' }]}
      fields={fields}
      columns={[
        { field: 'name', headerName: 'Sub-village', flex: 1 },
        { field: 'code', headerName: 'Code', width: 120 },
        statusCol,
      ]}
    />
  );
}
