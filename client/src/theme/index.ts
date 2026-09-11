import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';

/**
 * Vibrant, modern palette: indigo -> violet -> pink brand gradient, warm
 * amber accents, crisp white surfaces on a soft lavender ground. Used
 * app-wide via ThemeProvider. `gradient.brand` is exported for the few
 * spots (AppBar, auth screen, sidebar header) that paint the gradient
 * directly instead of a flat color.
 */
const brand = '#4F46E5'; // indigo-600
const brandLight = '#818CF8'; // indigo-400
const brandDark = '#3730A3'; // indigo-800
const accent = '#EC4899'; // pink-500 - pairs with indigo for the brand gradient

export const gradient = {
  brand: `linear-gradient(135deg, ${brandDark} 0%, ${brand} 45%, ${accent} 100%)`,
  brandSoft: `linear-gradient(135deg, ${alpha(brand, 0.12)} 0%, ${alpha(accent, 0.1)} 100%)`,
};

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand, light: brandLight, dark: brandDark, contrastText: '#ffffff' },
    secondary: { main: accent, light: '#F472B6', dark: '#BE185D', contrastText: '#ffffff' },
    success: { main: '#10B981', light: '#6EE7B7', dark: '#047857' },
    warning: { main: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
    error: { main: '#E11D48', light: '#FB7185', dark: '#9F1239' },
    info: { main: '#0EA5E9', light: '#7DD3FC', dark: '#0369A1' },
    background: { default: '#F6F5FC', paper: '#ffffff' },
    text: { primary: '#1E1B3A', secondary: '#6B7280' },
    divider: alpha(brand, 0.12),
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
    h4: { fontWeight: 800, letterSpacing: -0.5 },
    h5: { fontWeight: 800, letterSpacing: -0.3 },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: alpha(brand, 0.14) },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' },
      styleOverrides: {
        root: {
          transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
          '&:hover': { borderColor: alpha(brand, 0.35) },
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
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiTab: { styleOverrides: { root: { minHeight: 46, textTransform: 'none', fontWeight: 600 } } },
    MuiDialog: { styleOverrides: { paper: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { margin: 12, width: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)' } }) } },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: gradient.brand,
          color: '#ffffff',
          borderBottom: 'none',
        },
      },
    },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: '#6B7280' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDrawer: {
      styleOverrides: { paper: { borderColor: alpha(brand, 0.1) } },
    },
  },
});

export const theme = responsiveFontSizes(base, { factor: 2.2 });
