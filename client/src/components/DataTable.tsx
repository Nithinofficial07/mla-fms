import { Fragment, type ReactNode } from 'react';
import { DataGrid, type DataGridProps, type GridColDef } from '@mui/x-data-grid';
import {
  Box, Card, CardActionArea, CardActions, CardContent, Divider, Paper, Skeleton,
  Stack, TablePagination, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from './Icon';
import { useViewMode, type ViewMode } from '@/hooks/useViewMode';

type Row = { id?: string; _id?: string } & Record<string, unknown>;

/** True for the "buttons only" column that every list appends. */
const isActionColumn = (c: GridColDef) =>
  /action/i.test(c.field) || (c.sortable === false && !!c.renderCell && !c.headerName);

function rowId(row: Row): string {
  return (row.id ?? row._id ?? '') as string;
}

/** Resolve one cell to a renderable node, reusing the grid's own renderers. */
function cell(col: GridColDef, row: Row): ReactNode {
  const value = row[col.field];
  if (col.renderCell) {
    // Callers only read `params.row`; the rest is filled to keep types happy.
    return col.renderCell({ row, value, field: col.field, id: rowId(row) } as never);
  }
  if (col.valueGetter) {
    return col.valueGetter(value as never, row as never, col as never, {} as never) as ReactNode;
  }
  return (value ?? '') as ReactNode;
}

/**
 * Renders rows as tap-through cards instead of a grid: the first column is
 * the title, the rest are label/value pairs, and any action column drops to
 * a footer. Used unconditionally on phones (a horizontally-scrolling grid is
 * unusable there) and as the opt-in "Cards" view everywhere else - a
 * responsive CSS grid gives one column on a narrow viewport and several on
 * a wide one, so the same rendering serves both cases.
 */
function CardListView<R extends Row>({
  rows, columns, loading, hideFooter, rowCount, paginationModel, onPaginationModelChange, onRowClick,
}: {
  rows: R[];
  columns: GridColDef<R>[];
  loading?: boolean;
  hideFooter?: boolean;
  rowCount?: number;
  paginationModel?: { page: number; pageSize: number };
  onPaginationModelChange?: (m: { page: number; pageSize: number }) => void;
  onRowClick?: DataGridProps<R>['onRowClick'];
}) {
  const dataCols = columns.filter((c) => !isActionColumn(c) && c.field !== '__check__');
  const actionCols = columns.filter(isActionColumn);
  const [titleCol, ...restCols] = dataCols;

  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={104} />)}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No records.</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
        {rows.map((row) => {
          const id = rowId(row);
          const body = (
            <CardContent sx={{ pb: actionCols.length ? 1 : 1.5, height: '100%' }}>
              {titleCol && (
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: restCols.length ? 1 : 0, wordBreak: 'break-word' }}>
                  {cell(titleCol, row) || '—'}
                </Typography>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(84px, auto) 1fr', columnGap: 1.5, rowGap: 0.75 }}>
                {restCols.map((col) => {
                  const v = cell(col, row);
                  if (v == null || v === '' || v === '—') return null;
                  return (
                    <Fragment key={col.field}>
                      <Typography variant="caption" color="text.secondary" sx={{ pt: 0.25 }}>
                        {col.headerName || col.field}
                      </Typography>
                      {typeof v === 'object' ? (
                        <Box sx={{ minWidth: 0 }}>{v}</Box>
                      ) : (
                        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, wordBreak: 'break-word' }}>
                          {String(v)}
                        </Typography>
                      )}
                    </Fragment>
                  );
                })}
              </Box>
            </CardContent>
          );

          return (
            <Card key={id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
              {onRowClick ? (
                <CardActionArea onClick={() => onRowClick({ id, row } as never, {} as never, {} as never)} sx={{ flex: 1 }}>
                  {body}
                </CardActionArea>
              ) : (
                body
              )}
              {actionCols.length > 0 && (
                <>
                  <Divider />
                  <CardActions sx={{ px: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {actionCols.map((col) => (
                      <Box key={col.field}>{cell(col, row)}</Box>
                    ))}
                  </CardActions>
                </>
              )}
            </Card>
          );
        })}
      </Box>

      {!hideFooter && paginationModel && onPaginationModelChange && (
        <TablePagination
          component="div"
          count={rowCount ?? rows.length}
          page={paginationModel.page}
          onPageChange={(_e, page) => onPaginationModelChange({ ...paginationModel, page })}
          rowsPerPage={paginationModel.pageSize}
          onRowsPerPageChange={(e) => onPaginationModelChange({ page: 0, pageSize: parseInt(e.target.value, 10) })}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Rows"
          sx={{ mt: 1, '.MuiTablePagination-toolbar': { pl: 0 } }}
        />
      )}
    </Box>
  );
}

/**
 * Thin wrapper over MUI X DataGrid tuned for server-side paginated lists.
 * Pass `rowCount`, `paginationModel`, `onPaginationModelChange`, `loading`.
 * On screens below `sm` it always renders a stacked card list instead of the
 * grid. Pass `viewStorageKey` to also offer a Table/Cards toggle on wider
 * screens (persisted per-browser under that key) - omit it to keep a list
 * table-only above the mobile breakpoint, as before.
 */
export function DataTable<R extends Row>(
  props: Omit<DataGridProps<R>, 'columns'> & { columns: GridColDef<R>[]; viewStorageKey?: string },
) {
  const { viewStorageKey, ...gridProps } = props;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [viewMode, setViewMode] = useViewMode(viewStorageKey ?? 'unset');

  const showCards = isMobile || (!!viewStorageKey && viewMode === 'cards');

  const toggle = viewStorageKey && !isMobile && (
    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={viewMode}
        onChange={(_e, v: ViewMode | null) => v && setViewMode(v)}
      >
        <ToggleButton value="table">
          <Tooltip title="Table view"><Icon name="ViewList" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="cards">
          <Tooltip title="Card view"><Icon name="ViewModule" /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  if (showCards) {
    return (
      <Box>
        {toggle}
        <CardListView
          rows={(gridProps.rows ?? []) as R[]}
          columns={gridProps.columns}
          loading={gridProps.loading}
          hideFooter={gridProps.hideFooter}
          rowCount={gridProps.rowCount}
          paginationModel={gridProps.paginationModel as { page: number; pageSize: number } | undefined}
          onPaginationModelChange={gridProps.onPaginationModelChange as never}
          onRowClick={gridProps.onRowClick}
        />
      </Box>
    );
  }

  return (
    <Box>
      {toggle}
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
          {...gridProps}
        />
      </Paper>
    </Box>
  );
}
