import { useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField,
  Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { QUOTE_KINDS } from '@mla/shared';
import { errorMessage } from '@/api/client';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import { createQuote, deleteQuote, fetchQuotes, updateQuote, type CalendarQuote } from '../calendarApi';

const KN_FONT = { fontFamily: '"Noto Sans Kannada", Inter, sans-serif' };

function QuoteRow({ q }: { q: CalendarQuote }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState({ text: q.text, author: q.author, kind: q.kind, monthDay: q.monthDay ?? '' });
  const dirty = draft.text !== q.text || draft.author !== q.author || draft.kind !== q.kind || draft.monthDay !== (q.monthDay ?? '');
  const onErr = (e: unknown) => enqueueSnackbar(errorMessage(e), { variant: 'error' });
  const save = useMutation({
    mutationFn: (body: Partial<CalendarQuote>) => updateQuote(q.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'quotes'] }),
    onError: onErr,
  });
  const remove = useMutation({
    mutationFn: () => deleteQuote(q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'quotes'] }),
    onError: onErr,
  });
  return (
    <Box sx={{ p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider', opacity: q.active ? 1 : 0.55 }}>
      <TextField
        fullWidth size="small" multiline maxRows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        InputProps={{ sx: KN_FONT }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1 }}>
        <TextField size="small" label="By" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} InputProps={{ sx: KN_FONT }} sx={{ flex: 1 }} />
        <TextField size="small" select label="Kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} sx={{ minWidth: 120 }}>
          {QUOTE_KINDS.map((k) => <MenuItem key={k.code} value={k.code}>{k.label}</MenuItem>)}
        </TextField>
        <Tooltip title="Use this line on this date every year (e.g. 11-01 for Rajyotsava). Leave empty for the daily rotation.">
          <TextField size="small" label="Special day (MM-DD)" value={draft.monthDay} onChange={(e) => setDraft({ ...draft, monthDay: e.target.value })} sx={{ width: 150 }} />
        </Tooltip>
        <Tooltip title={q.active ? 'In use - switch off to skip it' : 'Not used'}>
          <Switch checked={q.active} onChange={(e) => save.mutate({ active: e.target.checked })} />
        </Tooltip>
        {dirty && (
          <Button size="small" variant="contained" disabled={!draft.text.trim() || save.isPending}
            onClick={() => save.mutate({ text: draft.text, author: draft.author, kind: draft.kind, monthDay: draft.monthDay.trim() || null })}
          >
            Save
          </Button>
        )}
        <IconButton
          size="small" aria-label="Delete"
          onClick={async () => { if (await confirm({ title: 'Delete this line?', message: q.text, confirmLabel: 'Delete', destructive: true })) remove.mutate(); }}
        >
          <Icon name="Delete" fontSize="small" />
        </IconButton>
      </Stack>
      {dialog}
    </Box>
  );
}

/** The office's list of ದಿನದ ಚಿಂತನೆ / ಸುಭಾಷಿತ / ಗಾದೆ lines the poster picks from. */
export function QuotesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [fresh, setFresh] = useState({ text: '', author: '', kind: 'CHINTANE', monthDay: '' });
  const quotes = useQuery({ queryKey: ['calendar', 'quotes'], queryFn: fetchQuotes, enabled: open });
  const add = useMutation({
    mutationFn: () => createQuote({ ...fresh, monthDay: fresh.monthDay.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar', 'quotes'] });
      setFresh({ text: '', author: '', kind: fresh.kind, monthDay: '' });
      enqueueSnackbar('Added', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
  });
  const list = useMemo(() => (quotes.data ?? [])
    .filter((x) => tab === 'ALL' || x.kind === tab)
    .filter((x) => !q.trim() || `${x.text} ${x.author}`.toLowerCase().includes(q.trim().toLowerCase())), [quotes.data, tab, q]);
  const count = (kind: string) => (quotes.data ?? []).filter((x) => kind === 'ALL' || x.kind === kind).length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>ದಿನದ ಚಿಂತನೆ - quotes for the poster</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Add a line</Typography>
            <TextField fullWidth size="small" multiline maxRows={3} placeholder="ಉದಾ: ಸೇವೆಯೇ ನಿಜವಾದ ನಾಯಕತ್ವ." value={fresh.text}
              onChange={(e) => setFresh({ ...fresh, text: e.target.value })} InputProps={{ sx: KN_FONT }} sx={{ bgcolor: 'background.paper' }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
              <TextField size="small" label="By (optional)" value={fresh.author} onChange={(e) => setFresh({ ...fresh, author: e.target.value })} InputProps={{ sx: KN_FONT }} sx={{ flex: 1, bgcolor: 'background.paper' }} />
              <TextField size="small" select label="Kind" value={fresh.kind} onChange={(e) => setFresh({ ...fresh, kind: e.target.value })} sx={{ minWidth: 120, bgcolor: 'background.paper' }}>
                {QUOTE_KINDS.map((k) => <MenuItem key={k.code} value={k.code}>{k.label}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Special day (MM-DD)" value={fresh.monthDay} onChange={(e) => setFresh({ ...fresh, monthDay: e.target.value })} sx={{ width: 160, bgcolor: 'background.paper' }} />
              <Button variant="contained" startIcon={<Icon name="Add" />} disabled={!fresh.text.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons={false}>
              <Tab value="ALL" label={`All (${count('ALL')})`} />
              {QUOTE_KINDS.map((k) => <Tab key={k.code} value={k.code} label={`${k.label} (${count(k.code)})`} />)}
            </Tabs>
            <TextField size="small" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            The poster uses these in turn, one per day (special-day lines on their date). <Chip size="small" label="Off" sx={{ height: 18 }} /> lines are skipped.
          </Typography>
          <Stack spacing={1}>
            {list.map((x) => <QuoteRow key={`${x.id}:${x.text}:${x.author}:${x.kind}:${x.monthDay}`} q={x} />)}
            {quotes.isSuccess && !list.length && <Typography variant="body2" color="text.secondary">No lines here yet.</Typography>}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
    </Dialog>
  );
}
