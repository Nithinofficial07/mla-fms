import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';

/**
 * Government-grade but modern: deep indigo primary, restrained surfaces,
 * generous radius, soft elevation. Used app-wide via ThemeProvider.
 */
const brand = '#0b3d91';

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand, light: '#3f63b3', dark: '#062a66' },
    secondary: { main: '#00897b' },
    success: { main: '#2e7d32' },
    warning: { main: '#ed6c02' },
    error: { main: '#c62828' },
    info: { main: '#0288d1' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
    text: { primary: '#1a2233', secondary: '#5b6472' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
    h4: { fontWeight: 700, letterSpacing: -0.5 },
    h5: { fontWeight: 700, letterSpacing: -0.3 },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: alpha(brand, 0.12) },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' },
      styleOverrides: { root: { transition: 'box-shadow .2s ease, transform .2s ease' } },
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { padding: 14, '&:last-child': { paddingBottom: 14 } } }),
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTab: { styleOverrides: { root: { minHeight: 46, textTransform: 'none', fontWeight: 600 } } },
    MuiDialog: { styleOverrides: { paper: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { margin: 12, width: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)' } }) } },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: { root: { borderBottom: `1px solid ${alpha(brand, 0.1)}`, backdropFilter: 'blur(6px)' } },
    },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: '#5b6472' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

export const theme = responsiveFontSizes(base, { factor: 2.2 });
