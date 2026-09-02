import { DataGrid, type DataGridProps, type GridColDef } from '@mui/x-data-grid';
import { Paper } from '@mui/material';

/**
 * Thin wrapper over MUI X DataGrid tuned for server-side paginated lists.
 * Pass `rowCount`, `paginationModel`, `onPaginationModelChange`, `loading`.
 */
export function DataTable<R extends { id?: string; _id?: string }>(
  props: Omit<DataGridProps<R>, 'columns'> & { columns: GridColDef<R>[] },
) {
  return (
    <Paper variant="outlined" sx={{ height: 620, width: '100%' }}>
      <DataGrid
        getRowId={(row) => (row.id ?? row._id) as string}
        disableColumnMenu
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50, 100]}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        density="standard"
        sx={{
          border: 0,
          '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
        {...props}
      />
    </Paper>
  );
}
