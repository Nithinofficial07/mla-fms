import { useMemo, useState } from 'react';
import {
  AppBar, Avatar, Badge, Box, Chip, Collapse, Divider, Drawer, IconButton, List,
  ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography,
} from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { NAV, type NavItem } from '@/routes/nav';
import { useAuth } from '@/app/AuthProvider';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import { api } from '@/api/client';

const DRAWER_WIDTH = 264;

function filterNav(items: NavItem[], can: (p: string) => boolean): NavItem[] {
  return items
    .filter((i) => !i.permission || can(i.permission))
    .map((i) => ({ ...i, children: i.children ? filterNav(i.children, can) : undefined }))
    .filter((i) => i.to || (i.children && i.children.length));
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
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
                      sx={{ pl: 6, borderRadius: 2, '&.active': { bgcolor: 'primary.light', color: 'primary.contrastText' } }}
                    >
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={child.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
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
            sx={{ borderRadius: 2, '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}
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
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) });
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.count as number),
    refetchInterval: 60_000,
  });

  const brandName = settings?.appName ?? 'MLA FMS';

  const drawer = (
    <Box>
      <Toolbar sx={{ gap: 1.5 }}>
        <Avatar src="/favicon.svg" variant="rounded" sx={{ width: 32, height: 32 }} />
        <Typography variant="subtitle1" fontWeight={800} noWrap>
          {brandName}
        </Typography>
      </Toolbar>
      <Divider />
      <NavList onNavigate={() => setMobileOpen(false)} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }}>
            <Icon name="Menu" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }} noWrap>
            {settings?.constituencyName || 'Constituency'}
          </Typography>
          <Chip
            size="small"
            icon={<Icon name={online ? 'CloudDone' : 'CloudOff'} />}
            label={online ? 'Online' : 'Offline'}
            color={online ? 'success' : 'warning'}
            variant="outlined"
          />
          <Tooltip title="Notifications">
            <IconButton onClick={() => navigate('/notifications')}>
              <Badge color="error" badgeContent={unread ?? 0}>
                <Icon name="Notifications" />
              </Badge>
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
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

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid rgba(11,61,145,0.1)' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
