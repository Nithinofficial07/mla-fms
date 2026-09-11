import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';

/**
 * Government Navy + Gold - a formal, civic palette matched to official
 * portal conventions: navy chrome with a muted gold accent used sparingly
 * for emphasis (active nav, drawer headers). Surfaces use soft shadows
 * ("soft-UI") instead of flat borders, cards lift gently on hover, the
 * AppBar and quick-view drawer header are frosted glass, and skeletons
 * shimmer instead of pulsing flat. Used app-wide via ThemeProvider.
 */
const navy = '#0B3450';
const navyLight = '#2C5578';
const navyDark = '#06202F';
const gold = '#B8860B';

/** Soft-UI shadow pair: a tight contact shadow + a broad ambient one. */
const softShadow = `0 1px 2px ${alpha(navy, 0.06)}, 0 10px 28px ${alpha(navy, 0.08)}`;
const softShadowHover = `0 2px 4px ${alpha(navy, 0.08)}, 0 20px 40px ${alpha(navy, 0.14)}`;

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: navy, light: navyLight, dark: navyDark, contrastText: '#ffffff' },
    secondary: { main: gold, light: '#D4A017', dark: '#8B6508', contrastText: '#ffffff' },
    success: { main: '#1B5E20', light: '#4C8C4A', dark: '#0D3F10' },
    warning: { main: '#E65100', light: '#F57C00', dark: '#A83800' },
    error: { main: '#B71C1C', light: '#E53935', dark: '#7F0000' },
    info: { main: '#0277BD', light: '#4FC3F7', dark: '#01579B' },
    background: { default: '#F4F5F7', paper: '#ffffff' },
    text: { primary: '#1A2233', secondary: '#5B6472' },
    divider: alpha(navy, 0.12),
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
    h4: { fontWeight: 700, letterSpacing: -0.3 },
    h5: { fontWeight: 700, letterSpacing: -0.2 },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countPulse {
          0% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `,
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: alpha(navy, 0.14) },
      },
    },
    // Soft-UI: gentle ambient shadow instead of a flat outline, lifts on hover.
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          boxShadow: softShadow,
          border: `1px solid ${alpha(navy, 0.05)}`,
          transition: 'box-shadow .25s ease, transform .25s ease, border-color .25s ease',
          '&:hover': { boxShadow: softShadowHover, transform: 'translateY(-3px)', borderColor: alpha(navy, 0.12) },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { padding: 14, '&:last-child': { paddingBottom: 14 } } }),
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTab: { styleOverrides: { root: { minHeight: 46, textTransform: 'none', fontWeight: 600 } } },
    MuiDialog: { styleOverrides: { paper: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { margin: 12, width: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)' } }) } },
    // Glassmorphism: translucent navy + backdrop blur instead of a flat fill.
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: alpha(navy, 0.82),
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          color: '#ffffff',
          borderBottom: `3px solid ${gold}`,
        },
      },
    },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: '#5B6472' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDrawer: {
      styleOverrides: { paper: { borderColor: alpha(navy, 0.1) } },
    },
    // Shimmer sweep instead of a flat pulse while content loads.
    MuiSkeleton: { defaultProps: { animation: 'wave' } },
  },
});

export const theme = responsiveFontSizes(base, { factor: 2.2 });
