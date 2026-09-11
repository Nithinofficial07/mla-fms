import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';

/**
 * Government Navy + Gold - a formal, civic palette matched to official
 * portal conventions: solid navy chrome, a muted gold accent used sparingly
 * for emphasis (active nav, drawer headers), flat surfaces (no gradients).
 * Used app-wide via ThemeProvider.
 */
const navy = '#0B3450';
const navyLight = '#2C5578';
const navyDark = '#06202F';
const gold = '#B8860B';

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
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: alpha(navy, 0.14) },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' },
      styleOverrides: {
        root: {
          transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
          '&:hover': { borderColor: alpha(navy, 0.3) },
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
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: navy,
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
  },
});

export const theme = responsiveFontSizes(base, { factor: 2.2 });
