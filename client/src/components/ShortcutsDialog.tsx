import { useEffect, useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { Icon } from './Icon';

/** Opens the dialog from anywhere without lifting its state (mirrors CommandPalette's pattern). */
export const openShortcuts = () => window.dispatchEvent(new Event('shortcuts:open'));

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navigation',
    items: [
      ['Ctrl / Cmd + K', 'Open search & quick actions'],
      ['?', 'Show this shortcuts list'],
      ['Esc', 'Close a dialog or drawer'],
    ],
  },
  {
    title: 'Lists',
    items: [
      ['Click a row', 'Open quick view'],
      ['Table / Cards toggle', 'Switch how a list is displayed'],
    ],
  },
];

function Key({ children }: { children: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 700,
        fontFamily: 'monospace',
        bgcolor: 'action.hover',
      }}
    >
      {children}
    </Box>
  );
}

function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

/** "?" opens a keyboard-shortcuts cheat sheet - a common power-user affordance in Linear, GitHub, Notion, etc. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('shortcuts:open', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('shortcuts:open', onOpenEvent);
    };
  }, []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Icon name="Keyboard" sx={{ color: 'primary.main' }} />
        Keyboard shortcuts
        <IconButton size="small" onClick={() => setOpen(false)} sx={{ ml: 'auto' }}>
          <Icon name="Close" fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {GROUPS.map((g) => (
            <Box key={g.title}>
              <Typography variant="overline" color="text.secondary">{g.title}</Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {g.items.map(([key, desc]) => (
                  <Stack key={key} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">{desc}</Typography>
                    <Key>{key}</Key>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
