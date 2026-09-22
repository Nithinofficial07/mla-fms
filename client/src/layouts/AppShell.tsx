import { useMemo, useState } from 'react';
import {
  AppBar, Avatar, Box, Chip, Collapse, Divider, Drawer, IconButton, List,
  ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { NotificationBell } from '@/components/NotificationBell';
import { NAV, type NavItem } from '@/routes/nav';
import { useAuth } from '@/app/AuthProvider';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import { useThemeMode } from '@/app/ThemeModeProvider';
import { CommandPalette, openCommandPalette } from '@/components/CommandPalette';
import { ShortcutsDialog, openShortcuts } from '@/components/ShortcutsDialog';
import { TopProgressBar } from '@/components/TopProgressBar';
import { api } from '@/api/client';
import { chrome } from '@/theme';

/** Formal accent-bar and pill treatment for the active nav item */
const activeNavSx = (theme: import('@mui/material/styles').Theme) => ({
  bgcolor: theme.palette.mode === 'dark' ? alpha('#38BDF8', 0.12) : alpha('#0A2540', 0.08),
  color: theme.palette.mode === 'dark' ? '#38BDF8' : '#0A2540',
  fontWeight: 700,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: '18%',
    bottom: '18%',
    width: 3.5,
    borderRadius: '0 4px 4px 0',
    backgroundColor: theme.palette.mode === 'dark' ? '#F59E0B' : '#C99700',
  },
  '& .MuiListItemIcon-root': {
    color: theme.palette.mode === 'dark' ? '#38BDF8' : '#0A2540',
  },
});

const DRAWER_WIDTH = 264;
const RAIL_WIDTH = 76;
const SIDEBAR_COLLAPSE_KEY = 'mla-fms:sidebar-collapsed';

function filterNav(items: NavItem[], can: (p: string) => boolean): NavItem[] {
  return items
    .filter((i) => !i.permission || can(i.permission))
    .map((i) => ({ ...i, children: i.children ? filterNav(i.children, can) : undefined }))
    .filter((i) => i.to || (i.children && i.children.length));
}

function NavList({ onNavigate, collapsed, onExpandRequest }: { onNavigate?: () => void; collapsed?: boolean; onExpandRequest?: () => void }) {
  const { can } = useAuth();
  const location = useLocation();
  const items = useMemo(() => filterNav(NAV, can), [can]);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((i) => i.children).map((i) => [i.label, true])),
  );

  return (
    <List sx={{ px: 1 }}>
      {items.map((item) => {
        if (item.children?.length) {
          if (collapsed) {
            return (
              <Tooltip key={item.label} title={item.label} placement="right">
                <ListItemButton onClick={onExpandRequest} sx={{ justifyContent: 'center', px: 1.5, borderRadius: 2, mb: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 0 }}><Icon name={item.icon} /></ListItemIcon>
                </ListItemButton>
              </Tooltip>
            );
          }
          return (
            <Box key={item.label}>
              <ListItemButton onClick={() => setOpen((s) => ({ ...s, [item.label]: !s[item.label] }))}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Icon name={item.icon} />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }} primary={item.label} />
                <Icon name={open[item.label] ? 'ExpandLess' : 'ExpandMore'} />
              </ListItemButton>
              <Collapse in={open[item.label]} unmountOnExit>
                <List disablePadding>
                  {item.children.map((child) => (
                    <ListItemButton
                      key={child.label}
                      component={NavLink}
                      to={child.to!}
                      onClick={onNavigate}
                      sx={{ pl: 6, borderRadius: 2, '&.active': activeNavSx }}
                    >
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={child.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        }
        if (collapsed) {
          return (
            <Tooltip key={item.label} title={item.label} placement="right">
              <ListItemButton
                component={NavLink}
                to={item.to!}
                end={item.to === '/'}
                onClick={onNavigate}
                sx={{
                  justifyContent: 'center',
                  px: 1.5,
                  borderRadius: 2,
                  mb: 0.25,
                  '&.active': (theme) => ({ ...activeNavSx(theme), '& .MuiListItemIcon-root': { color: 'inherit' } }),
                }}
              >
                <ListItemIcon sx={{ minWidth: 0 }}><Icon name={item.icon} /></ListItemIcon>
              </ListItemButton>
            </Tooltip>
          );
        }
        return (
          <ListItemButton
            key={item.label}
            component={NavLink}
            to={item.to!}
            end={item.to === '/'}
            onClick={onNavigate}
            selected={location.pathname === item.to}
            sx={{
              borderRadius: 2,
              '&.active': (theme) => ({ ...activeNavSx(theme), '& .MuiListItemIcon-root': { color: 'inherit' } }),
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon name={item.icon} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }} primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const online = useOnlineStatus();
  const { mode, toggle: toggleThemeMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setCollapsedPersist = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* private browsing / storage disabled - the choice just won't persist */
    }
  };

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) });

  const brandName = settings?.appName ?? 'MLA FMS';
  const railWidth = collapsed ? RAIL_WIDTH : DRAWER_WIDTH;

  const mobileDrawer = (
    <Box>
      <Toolbar sx={{ gap: 1.5 }}>
        <Avatar src="/favicon.svg" variant="rounded" sx={{ width: 34, height: 34, boxShadow: '0 2px 8px rgba(11,52,80,0.35)' }} />
        <Typography variant="subtitle1" fontWeight={800} noWrap>
          {brandName}
        </Typography>
      </Toolbar>
      <Divider />
      <NavList onNavigate={() => setMobileOpen(false)} />
    </Box>
  );

  const railDrawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1 : 2 }}>
        <Avatar src="/favicon.svg" variant="rounded" sx={{ width: 34, height: 34, boxShadow: '0 2px 8px rgba(11,52,80,0.35)', flexShrink: 0 }} />
        {!collapsed && (
          <Typography variant="subtitle1" fontWeight={800} noWrap>
            {brandName}
          </Typography>
        )}
      </Toolbar>
      <Divider />
      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <NavList collapsed={collapsed} onExpandRequest={() => setCollapsedPersist(false)} />
      </Box>
      <Divider />
      <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
        <IconButton
          onClick={() => setCollapsedPersist(!collapsed)}
          sx={{ m: 1, alignSelf: collapsed ? 'center' : 'flex-end' }}
        >
          <Icon name={collapsed ? 'KeyboardDoubleArrowRight' : 'KeyboardDoubleArrowLeft'} fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <TopProgressBar />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: { xs: 0.25, sm: 1 }, px: { xs: 1, sm: 3 } }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' }, color: '#fff' }}>
            <Icon name="Menu" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1, fontSize: { xs: '0.95rem', sm: '1rem' }, color: '#fff' }} noWrap>
            {settings?.constituencyName || 'Constituency'}
          </Typography>
          <Tooltip title="Search everything (Ctrl+K)">
            <Box
              onClick={openCommandPalette}
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1.25,
                cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 2.5,
                px: 1.75,
                py: 0.6,
                color: 'rgba(255,255,255,0.85)',
                transition: 'all .2s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.16)',
                  borderColor: 'rgba(255,255,255,0.3)',
                  boxShadow: '0 0 16px rgba(255,255,255,0.12)',
                },
              }}
            >
              <Icon name="Search" fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>Search anything…</Typography>
              <Box
                component="span"
                sx={{
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1,
                  px: 0.6,
                  py: 0.1,
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  bgcolor: 'rgba(255,255,255,0.1)',
                }}
              >
                Ctrl K
              </Box>
            </Box>
          </Tooltip>
          <IconButton onClick={openCommandPalette} sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: '#fff' }}>
            <Icon name="Search" />
          </IconButton>
          <Tooltip title="Keyboard shortcuts (?)">
            <IconButton onClick={openShortcuts} sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#fff' }}>
              <Icon name="Keyboard" />
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            icon={<Icon name={online ? 'CloudDone' : 'CloudOff'} sx={{ color: 'inherit !important' }} />}
            label={online ? 'Online' : 'Offline'}
            variant="outlined"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.55)',
              bgcolor: 'rgba(255,255,255,0.12)',
            }}
          />
          {!online && (
            <Icon name="CloudOff" sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: '#FDE68A' }} />
          )}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggleThemeMode} sx={{ color: '#fff' }}>
              <Icon name={mode === 'dark' ? 'LightMode' : 'DarkMode'} />
            </IconButton>
          </Tooltip>
          <NotificationBell />
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700, border: '1px solid rgba(255,255,255,0.4)' }}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem disabled>
              <Box>
                <Typography variant="body2" fontWeight={700}>{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.roleCode}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAnchor(null); navigate('/profile'); }}>Profile</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); navigate('/change-password'); }}>Change password</MenuItem>
            <MenuItem onClick={() => logout()}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: railWidth }, flexShrink: { md: 0 }, transition: 'width .2s ease' }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {mobileDrawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: railWidth, borderRight: '1px solid', borderColor: 'divider', overflowX: 'hidden', transition: 'width .2s ease' },
          }}
        >
          {railDrawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${railWidth}px)` },
          px: { xs: 1.5, sm: 3 },
          py: { xs: 2, sm: 3 },
          pb: 'calc(env(safe-area-inset-bottom) + 16px)',
          transition: 'width .2s ease',
        }}
      >
        <Toolbar />
        <Box key={location.pathname} sx={{ animation: 'fadeInUp .35s ease both' }}>
          <Outlet />
        </Box>
      </Box>

      <CommandPalette />
      <ShortcutsDialog />
    </Box>
  );
}
