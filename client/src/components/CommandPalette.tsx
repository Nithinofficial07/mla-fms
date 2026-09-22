import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Dialog, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@mla/shared';
import { Icon } from './Icon';
import { openShortcuts } from './ShortcutsDialog';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';
import { useThemeMode } from '@/app/ThemeModeProvider';

/** Opens the palette from anywhere (e.g. a toolbar button) without lifting its state. */
export const openCommandPalette = () => window.dispatchEvent(new Event('cmdk:open'));

interface Item {
  id: string;
  group: string;
  icon: string;
  label: string;
  sublabel?: string;
  run: () => void;
}

/** Debounces a value - avoids firing a search request on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Global "jump to anything" search - Ctrl+K / Cmd+K anywhere in the app.
 * Searches Requests, Letters and Departments in parallel (only the ones the
 * signed-in user can actually view) and offers a handful of quick actions.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const { mode, toggle: toggleThemeMode } = useThemeMode();
  const debouncedQuery = useDebounced(query, 250);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    // Also openable from a plain click (e.g. the AppBar search pill) via a custom event,
    // so callers don't need to lift this component's open state.
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('cmdk:open', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('cmdk:open', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = () => setOpen(false);
  const go = (path: string) => { close(); navigate(path); };

  const canSearchRequests = can(PERMISSIONS.REQUEST_VIEW);
  const canSearchLetters = can(PERMISSIONS.LETTER_VIEW);
  const canSearchDepartments = can(PERMISSIONS.DASHBOARD_VIEW);

  const search = useQuery({
    queryKey: ['cmdk', debouncedQuery, canSearchRequests, canSearchLetters, canSearchDepartments],
    queryFn: async () => {
      const [requests, letters, departments] = await Promise.all([
        canSearchRequests ? api.get('/requests', { params: { search: debouncedQuery, pageSize: 6 } }).then((r) => r.data.data) : [],
        canSearchLetters ? api.get('/letters', { params: { search: debouncedQuery, pageSize: 6 } }).then((r) => r.data.data) : [],
        canSearchDepartments ? api.get('/departments', { params: { search: debouncedQuery, pageSize: 6 } }).then((r) => r.data.data) : [],
      ]);
      return { requests, letters, departments };
    },
    enabled: open && debouncedQuery.trim().length > 1,
  });

  const quickActions: Item[] = useMemo(() => {
    const items: Item[] = [
      { id: 'qa-dash', group: 'Quick actions', icon: 'Dashboard', label: 'Go to Dashboard', run: () => go('/') },
      { id: 'qa-theme', group: 'Quick actions', icon: mode === 'dark' ? 'LightMode' : 'DarkMode', label: mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: () => { toggleThemeMode(); close(); } },
      { id: 'qa-notif', group: 'Quick actions', icon: 'Notifications', label: 'Open notifications', run: () => go('/notifications') },
      { id: 'qa-profile', group: 'Quick actions', icon: 'AssignmentInd', label: 'My profile', run: () => go('/profile') },
      { id: 'qa-shortcuts', group: 'Quick actions', icon: 'Keyboard', label: 'Keyboard shortcuts', run: () => { close(); openShortcuts(); } },
    ];
    if (can(PERMISSIONS.REQUEST_CREATE)) items.push({ id: 'qa-new-req', group: 'Quick actions', icon: 'Add', label: 'New Request', run: () => go('/requests/new') });
    if (can(PERMISSIONS.LETTER_CREATE)) items.push({ id: 'qa-new-letter', group: 'Quick actions', icon: 'Add', label: 'New MLA Letter', run: () => go('/letters/new') });
    if (can(PERMISSIONS.LETTER_CREATE)) items.push({ id: 'qa-new-funding', group: 'Quick actions', icon: 'AttachMoney', label: 'New Funding Request', run: () => go('/funding') });
    if (can(PERMISSIONS.SETTINGS_MANAGE)) items.push({ id: 'qa-settings', group: 'Quick actions', icon: 'Settings', label: 'Settings', run: () => go('/settings') });
    return items;
  }, [can, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const results: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredActions = quickActions.filter((a) => !q || a.label.toLowerCase().includes(q));
    if (q.length <= 1) return filteredActions;

    const data = search.data;
    const items: Item[] = [];
    (data?.requests ?? []).forEach((r: any) => items.push({
      id: `req-${r.id}`, group: 'Requests', icon: 'FolderShared',
      label: r.fileId, sublabel: `${r.subject ?? ''} · ${r.applicant?.name ?? ''}`,
      run: () => go(`/requests/${r.id}`),
    }));
    (data?.letters ?? []).forEach((l: any) => items.push({
      id: `let-${l.id}`, group: 'MLA Letters', icon: 'Mail',
      label: l.letterNo, sublabel: l.subject,
      run: () => go(`/letters/${l.id}`),
    }));
    (data?.departments ?? []).forEach((d: any) => items.push({
      id: `dep-${d.id}`, group: 'Departments', icon: 'AccountBalance',
      label: d.name, sublabel: d.code,
      run: () => go(`/funding/new/${d.id}`),
    }));
    return [...items, ...filteredActions];
  }, [query, search.data, quickActions]);

  useEffect(() => setActiveIndex(0), [results.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[activeIndex]?.run(); }
    else if (e.key === 'Escape') { close(); }
  };

  let lastGroup = '';

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      PaperProps={{ sx: { mt: { xs: 4, sm: 10 }, borderRadius: 3, overflow: 'hidden' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Icon name="Search" sx={{ color: 'text.secondary', mr: 1.5 }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Search requests, letters, departments… or run a quick action"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          sx={{ fontSize: '1rem' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, py: 0.25 }}>
          Esc
        </Typography>
      </Box>

      <List sx={{ maxHeight: 420, overflowY: 'auto', py: 0.5 }}>
        {results.length === 0 && query.trim().length > 1 && !search.isFetching && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No matches for "{query}"</Typography>
          </Box>
        )}
        {results.map((item, i) => {
          const showHeader = item.group !== lastGroup;
          lastGroup = item.group;
          return (
            <Box key={item.id}>
              {showHeader && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {item.group}
                </Typography>
              )}
              <ListItemButton
                selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => item.run()}
                sx={{ mx: 1, borderRadius: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}><Icon name={item.icon} fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.sublabel}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
              </ListItemButton>
            </Box>
          );
        })}
      </List>
    </Dialog>
  );
}
