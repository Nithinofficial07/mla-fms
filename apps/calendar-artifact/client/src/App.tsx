import { AppBar, Box, Chip, Container, Toolbar, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from '@/components/Icon';
import { useCalendarStore } from '@/data/CalendarStore';
import { CalendarPage } from '@/features/calendar/CalendarPage';

function StatusChip() {
  const { status } = useCalendarStore();
  const map = {
    ready: { label: 'Live', icon: 'CloudDone', color: '#22C55E' },
    connecting: { label: 'Connecting', icon: 'Autorenew', color: '#F59E0B' },
    slow: { label: 'Connecting', icon: 'Autorenew', color: '#F59E0B' },
    offline: { label: 'Offline', icon: 'CloudOff', color: '#94A3B8' },
    error: { label: 'Disconnected', icon: 'CloudOff', color: '#EF4444' },
  } as const;
  const m = map[status];
  return (
    <Chip
      size="small" icon={<Icon name={m.icon} sx={{ color: `${m.color} !important` }} />} label={m.label}
      sx={{ color: '#fff', bgcolor: alpha('#fff', 0.08), border: `1px solid ${alpha('#fff', 0.18)}`, fontWeight: 600 }}
    />
  );
}

export function App() {
  return (
    <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky" elevation={0}
        sx={{ bgcolor: '#0B2A44', backgroundImage: 'none', borderBottom: '2px solid', borderColor: 'secondary.main' }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, sm: 60 } }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha('#C99700', 0.18), color: 'secondary.main' }}>
            <Icon name="Event" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: '#fff', lineHeight: 1.15, fontSize: { xs: '0.95rem', sm: '1.05rem' } }} noWrap>
              Davanagere South Constituency
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.7), display: 'block', lineHeight: 1.2 }} noWrap>
              Office of the MLA · Calendar
            </Typography>
          </Box>
          <StatusChip />
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <CalendarPage />
      </Container>
    </Box>
  );
}
