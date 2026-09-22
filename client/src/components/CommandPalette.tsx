import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Dialog, Divider, InputBase, List, ListItemButton, ListItemIcon, ListItemText,
  Stack, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  badge?: string;
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
 * Global "jump to anything" command center - Ctrl+K / Cmd+K anywhere in the app.
 * Raycast-style keyboard-first execution with instant jump actions and search.
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
      { id: 'qa-dash', group: 'Navigation', icon: 'Dashboard', label: 'Go to Command Center (Dashboard)', run: () => go('/') },
      { id: 'qa-all-req', group: 'Navigation', icon: 'FolderShared', label: 'All Requests & Casework', run: () => go('/requests') },
      { id: 'qa-overdue', group: 'Quick Triage', icon: 'ReportProblem', label: 'View Overdue Petitions', badge: 'Urgent', run: () => go('/requests?overdue=true') },
      { id: 'qa-pending', group: 'Quick Triage', icon: 'HourglassEmpty', label: 'View Pending Reviews', run: () => go('/requests?bucket=pending') },
      { id: 'qa-inprogress', group: 'Quick Triage', icon: 'Autorenew', label: 'View In-Progress with Depts', run: () => go('/requests?bucket=in-progress') },
      { id: 'qa-reports', group: 'Analytics', icon: 'Assessment', label: 'Reports & Export Center', run: () => go('/reports') },
      { id: 'qa-theme', group: 'Preferences', icon: mode === 'dark' ? 'LightMode' : 'DarkMode', label: mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: () => { toggleThemeMode(); close(); } },
      { id: 'qa-notif', group: 'Preferences', icon: 'Notifications', label: 'Open notifications drawer', run: () => go('/notifications') },
      { id: 'qa-profile', group: 'Preferences', icon: 'AssignmentInd', label: 'My Casework Profile', run: () => go('/profile') },
      { id: 'qa-shortcuts', group: 'Preferences', icon: 'Keyboard', label: 'View all keyboard shortcuts', run: () => { close(); openShortcuts(); } },
    ];
    if (can(PERMISSIONS.REQUEST_CREATE)) items.unshift({ id: 'qa-new-req', group: 'Create New', icon: 'Add', label: 'New Citizen Request / Petition', badge: 'Action', run: () => go('/requests/new') });
    if (can(PERMISSIONS.LETTER_CREATE)) items.push({ id: 'qa-new-letter', group: 'Create New', icon: 'Add', label: 'Draft New MLA Letter', run: () => go('/letters/new') });
    if (can(PERMISSIONS.LETTER_CREATE)) items.push({ id: 'qa-new-funding', group: 'Create New', icon: 'AttachMoney', label: 'Submit Funding Proposal', run: () => go('/funding') });
    if (can(PERMISSIONS.SETTINGS_MANAGE)) items.push({ id: 'qa-settings', group: 'Admin', icon: 'Settings', label: 'System Configuration & Settings', run: () => go('/settings') });
    return items;
  }, [can, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const results: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredActions = quickActions.filter((a) => !q || a.label.toLowerCase().includes(q));
    if (q.length <= 1) return filteredActions;

    const data = search.data;
    const items: Item[] = [];
    (data?.requests ?? []).forEach((r: any) => items.push({
      id: `req-${r.id}`, group: 'Constituency Requests', icon: 'FolderShared',
      label: r.fileId, sublabel: `${r.subject ?? ''} · ${r.applicant?.name ?? ''}`,
      badge: r.statusCode,
      run: () => go(`/requests/${r.id}`),
    }));
    (data?.letters ?? []).forEach((l: any) => items.push({
      id: `let-${l.id}`, group: 'MLA Letters', icon: 'Mail',
      label: l.letterNo, sublabel: l.subject,
      badge: l.status,
      run: () => go(`/letters/${l.id}`),
    }));
    (data?.departments ?? []).forEach((d: any) => items.push({
      id: `dep-${d.id}`, group: 'Line Departments', icon: 'AccountBalance',
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
      PaperProps={{
        sx: {
          mt: { xs: 4, sm: 8 },
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Icon name="Search" sx={{ color: 'primary.main', mr: 1.5, fontSize: '1.25rem' }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Search requests, letters, departments… or jump anywhere"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          sx={{ fontSize: '1rem', fontWeight: 500 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            fontWeight: 700,
            bgcolor: 'action.hover',
          }}
        >
          ESC
        </Typography>
      </Box>

      <List sx={{ maxHeight: 420, overflowY: 'auto', py: 0.5 }}>
        {results.length === 0 && query.trim().length > 1 && !search.isFetching && (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No matches found for "{query}"</Typography>
          </Box>
        )}
        {results.map((item, i) => {
          const showHeader = item.group !== lastGroup;
          lastGroup = item.group;
          const isSelected = i === activeIndex;

          return (
            <Box key={item.id}>
              {showHeader && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    px: 2,
                    pt: 1.75,
                    pb: 0.5,
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    fontWeight: 700,
                    fontSize: '0.675rem',
                  }}
                >
                  {item.group}
                </Typography>
              )}
              <ListItemButton
                selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => item.run()}
                sx={{
                  mx: 1,
                  borderRadius: 1.75,
                  py: 1,
                  transition: 'all .12s ease',
                  '&.Mui-selected': {
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.2 : 0.08),
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Icon
                    name={item.icon}
                    fontSize="small"
                    sx={{ color: isSelected ? 'primary.main' : 'text.secondary' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.sublabel}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: isSelected ? 700 : 500, noWrap: true }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
                {item.badge && (
                  <Typography
                    variant="caption"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      bgcolor: item.badge === 'Urgent' ? 'rgba(220, 38, 38, 0.12)' : 'action.hover',
                      color: item.badge === 'Urgent' ? '#DC2626' : 'text.secondary',
                    }}
                  >
                    {item.badge}
                  </Typography>
                )}
              </ListItemButton>
            </Box>
          );
        })}
      </List>

      <Divider />
      {/* Keyboard Shortcut Hints Footer */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1, bgcolor: 'action.hover', fontSize: '0.72rem', color: 'text.secondary' }}
      >
        <Stack direction="row" spacing={2}>
          <span>↑↓ to navigate</span>
          <span>↵ to execute</span>
          <span>esc to dismiss</span>
        </Stack>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          MLA File Management System
        </Typography>
      </Stack>
    </Dialog>
  );
}
