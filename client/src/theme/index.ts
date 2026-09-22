import { createTheme, responsiveFontSizes, alpha, type Theme } from '@mui/material/styles';

/**
 * Government Navy + Gold - a formal, civic palette matched to official
 * portal conventions: navy chrome with a muted gold accent used sparingly
 * for emphasis (active nav, drawer headers). Surfaces use soft shadows
 * ("soft-UI") instead of flat borders, cards lift gently on hover, the
 * AppBar and quick-view drawer header are frosted glass, and skeletons
 * shimmer instead of pulsing flat.
 *
 * Both a light and a dark variant are built here (buildTheme('light'|'dark')) -
 * dark isn't just the light palette inverted: the brand navy stays a large
 * chrome surface color (AppBar, drawer headers, active nav) via `chrome`,
 * separate from `primary`, which is lightened in dark mode so text/icons/
 * outlined buttons stay legible against a near-black background.
 */
const gold = '#B8860B';
const goldDark = '#D4A017'; // gold pops a little brighter against a dark background

/** Deep-navy chrome surfaces (AppBar, drawer headers, active nav) - brand-constant, not the interactive `primary` token. */
export const chrome: Record<'light' | 'dark', string> = {
  light: '#0B3450',
  dark: '#101B2C',
};

function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  const navy = chrome[mode];

  /** Soft-UI shadow pair: a tight contact shadow + a broad ambient one. */
  const shadowColor = isDark ? '#000000' : navy;
  const softShadow = `0 1px 2px ${alpha(shadowColor, isDark ? 0.5 : 0.06)}, 0 10px 28px ${alpha(shadowColor, isDark ? 0.4 : 0.08)}`;
  const softShadowHover = `0 2px 4px ${alpha(shadowColor, isDark ? 0.55 : 0.08)}, 0 20px 40px ${alpha(shadowColor, isDark ? 0.5 : 0.14)}`;

  const base = createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#6FA3DB', light: '#9CC3EA', dark: '#4472A8', contrastText: '#0B1420' }
        : { main: '#0B3450', light: '#2C5578', dark: '#06202F', contrastText: '#ffffff' },
      secondary: isDark
        ? { main: goldDark, light: '#E8C34A', dark: '#9C7209', contrastText: '#0B1420' }
        : { main: gold, light: '#D4A017', dark: '#8B6508', contrastText: '#ffffff' },
      success: isDark ? { main: '#4CAF6D', light: '#7BCB90', dark: '#2E7D45' } : { main: '#1B5E20', light: '#4C8C4A', dark: '#0D3F10' },
      warning: isDark ? { main: '#FFA53D', light: '#FFC073', dark: '#C77800' } : { main: '#E65100', light: '#F57C00', dark: '#A83800' },
      error: isDark ? { main: '#FF6B6B', light: '#FF9494', dark: '#C43D3D' } : { main: '#B71C1C', light: '#E53935', dark: '#7F0000' },
      info: isDark ? { main: '#4FC3F7', light: '#81D4FA', dark: '#0288D1' } : { main: '#0277BD', light: '#4FC3F7', dark: '#01579B' },
      background: isDark ? { default: '#0B1420', paper: '#121F32' } : { default: '#F4F5F7', paper: '#ffffff' },
      text: isDark ? { primary: '#E9EDF3', secondary: '#94A3B8' } : { primary: '#1A2233', secondary: '#5B6472' },
      divider: isDark ? alpha('#ffffff', 0.12) : alpha(navy, 0.12),
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
          @keyframes confettiFall {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
            100% { transform: translate(var(--dx, 0px), 220px) rotate(var(--dr, 180deg)); opacity: 0; }
          }
          @keyframes checkPop {
            0% { transform: scale(0.4); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `,
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: isDark ? alpha('#ffffff', 0.14) : alpha(navy, 0.14) },
        },
      },
      // Soft-UI: gentle ambient shadow instead of a flat outline, lifts on hover.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            boxShadow: softShadow,
            border: `1px solid ${isDark ? alpha('#ffffff', 0.08) : alpha(navy, 0.05)}`,
            transition: 'box-shadow .25s ease, transform .25s ease, border-color .25s ease',
            '&:hover': {
              boxShadow: softShadowHover,
              transform: 'translateY(-3px)',
              borderColor: isDark ? alpha('#ffffff', 0.18) : alpha(navy, 0.12),
            },
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
      // Glassmorphism: translucent navy chrome + backdrop blur instead of a flat fill.
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: alpha(navy, 0.82),
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            color: '#ffffff',
            borderBottom: `3px solid ${isDark ? goldDark : gold}`,
          },
        },
      },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: isDark ? '#94A3B8' : '#5B6472' } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiDrawer: {
        styleOverrides: { paper: { borderColor: isDark ? alpha('#ffffff', 0.1) : alpha(navy, 0.1) } },
      },
      // Shimmer sweep instead of a flat pulse while content loads.
      MuiSkeleton: { defaultProps: { animation: 'wave' } },
    },
  });

  return responsiveFontSizes(base, { factor: 2.2 });
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
/** Back-compat default export - the app now picks between light/dark via ThemeModeProvider. */
export const theme = lightTheme;
