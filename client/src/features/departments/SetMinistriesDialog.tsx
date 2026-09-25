import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api, errorMessage } from '@/api/client';
import { useDepartments } from '@/hooks/useOptions';
import { suggestMinistry } from '@/lib/karnatakaMinistries';
import { Icon } from '@/components/Icon';

interface Row {
  id: string;
  name: string;
  current: string;
  suggestion: string;
  checked: boolean;
}

/**
 * One-click bulk-fill of Department.ministryName from the current Karnataka
 * cabinet portfolio list (client/src/lib/karnatakaMinistries.ts). Suggestions
 * are shown editable and unchecked-by-default for anything already set, so a
 * wrong auto-match never silently overwrites a value someone already typed.
 */
export function SetMinistriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const departments = useDepartments();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Row[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !departments.data) return;
    setRows(
      departments.data.map((d) => {
        const current = (d as { ministryName?: string }).ministryName ?? '';
        const suggestion = suggestMinistry(d.name)?.ministryName ?? '';
        return { id: d.id, name: d.name, current, suggestion, checked: !current && !!suggestion };
      }),
    );
  }, [open, departments.data]);

  const matchedCount = useMemo(() => rows.filter((r) => r.suggestion).length, [rows]);
  const selectedCount = useMemo(() => rows.filter((r) => r.checked && r.suggestion.trim()).length, [rows]);

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const apply = async () => {
    const toApply = rows.filter((r) => r.checked && r.suggestion.trim());
    if (!toApply.length) return;
    setApplying(true);
    const results = await Promise.allSettled(
      toApply.map((r) => api.patch(`/departments/${r.id}`, { ministryName: r.suggestion.trim() })),
    );
    setApplying(false);
    const failed = results.filter((r) => r.status === 'rejected').length;
    qc.invalidateQueries({ queryKey: ['opt', 'departments'] });
    qc.invalidateQueries({ queryKey: ['/departments'] });
    if (failed === 0) {
      enqueueSnackbar(`Ministry set for ${toApply.length} department${toApply.length === 1 ? '' : 's'}`, { variant: 'success' });
      onClose();
    } else {
      enqueueSnackbar(`${toApply.length - failed} saved, ${failed} failed - try those again`, { variant: 'warning' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Set Ministries (Government of Karnataka)</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Suggested from the current Karnataka cabinet portfolio list (Shivakumar ministry, Aug 2026 reshuffle).
          Review each line — edit or clear anything that doesn't look right before applying. Departments with no
          confident match are left blank for you to fill in by hand.
        </Alert>

        {departments.isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rounded" height={48} />)}
          </Stack>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {matchedCount} of {rows.length} departments matched a portfolio · {selectedCount} selected to apply
            </Typography>
            <Stack spacing={1}>
              {rows.map((r) => (
                <Box
                  key={r.id}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1,
                    p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
                    opacity: r.suggestion ? 1 : 0.6,
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={r.checked}
                    disabled={!r.suggestion.trim()}
                    onChange={(e) => setRow(r.id, { checked: e.target.checked })}
                    sx={{ mt: 0.5 }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                    {r.current && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Currently: {r.current}
                      </Typography>
                    )}
                  </Box>
                  <TextField
                    size="small"
                    placeholder="No confident match — enter manually"
                    value={r.suggestion}
                    onChange={(e) => setRow(r.id, { suggestion: e.target.value, checked: !!e.target.value.trim() })}
                    sx={{ flex: 2, minWidth: 0 }}
                  />
                </Box>
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<Icon name="CheckCircle" />}
          disabled={applying || selectedCount === 0}
          onClick={apply}
        >
          {applying ? 'Applying…' : `Apply to ${selectedCount || ''} department${selectedCount === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
