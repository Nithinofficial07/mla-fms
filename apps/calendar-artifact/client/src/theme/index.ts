import { createTheme, responsiveFontSizes, alpha, type Theme } from '@mui/material/styles';

/**
 * Modern Civic Prestige Theme
 * Deep navy chrome + regal gold/amber accents, paired with modern SaaS design
 * tokens: layered ambient shadows, micro-borders, frosted glassmorphism,
 * refined typography with tabular numerals, and responsive elevation.
 */
const gold = '#C99700';
const goldDark = '#F59E0B';

/** Deep-navy chrome surfaces (AppBar, drawer headers, active nav) */
export const chrome: Record<'light' | 'dark', string> = {
  light: '#0A2540',
  dark: '#0B132B',
};

function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  const navy = chrome[mode];

  /** Multi-layered ambient shadow tokens */
  const shadowBase = isDark ? '#000000' : '#0A2540';
  const softShadow = isDark
    ? `0 1px 2px ${alpha(shadowBase, 0.6)}, 0 8px 24px ${alpha(shadowBase, 0.45)}`
    : `0 1px 2px ${alpha(shadowBase, 0.04)}, 0 8px 24px -4px ${alpha(shadowBase, 0.08)}`;
  const softShadowHover = isDark
    ? `0 4px 12px ${alpha(shadowBase, 0.7)}, 0 16px 36px ${alpha(shadowBase, 0.55)}`
    : `0 4px 12px ${alpha(shadowBase, 0.06)}, 0 16px 36px -6px ${alpha(shadowBase, 0.13)}`;

  const base = createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#38BDF8', light: '#7DD3FC', dark: '#0284C7', contrastText: '#0B132B' }
        : { main: '#0A2540', light: '#1E3A8A', dark: '#061727', contrastText: '#ffffff' },
      secondary: isDark
        ? { main: goldDark, light: '#FCD34D', dark: '#B45309', contrastText: '#0B132B' }
        : { main: gold, light: '#D97706', dark: '#92400E', contrastText: '#ffffff' },
      success: isDark
        ? { main: '#10B981', light: '#34D399', dark: '#059669', contrastText: '#ffffff' }
        : { main: '#059669', light: '#10B981', dark: '#047857', contrastText: '#ffffff' },
      warning: isDark
        ? { main: '#F59E0B', light: '#FBBF24', dark: '#D97706', contrastText: '#0B132B' }
        : { main: '#D97706', light: '#F59E0B', dark: '#B45309', contrastText: '#ffffff' },
      error: isDark
        ? { main: '#F87171', light: '#FCA5A5', dark: '#DC2626', contrastText: '#ffffff' }
        : { main: '#DC2626', light: '#EF4444', dark: '#B91C1C', contrastText: '#ffffff' },
      info: isDark
        ? { main: '#60A5FA', light: '#93C5FD', dark: '#2563EB', contrastText: '#ffffff' }
        : { main: '#2563EB', light: '#3B82F6', dark: '#1D4ED8', contrastText: '#ffffff' },
      background: isDark
        ? { default: '#090D16', paper: '#111827' }
        : { default: '#F8FAFC', paper: '#ffffff' },
      text: isDark
        ? { primary: '#F1F5F9', secondary: '#94A3B8' }
        : { primary: '#0F172A', secondary: '#475569' },
      divider: isDark ? alpha('#ffffff', 0.08) : alpha('#0F172A', 0.08),
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
      h1: { fontWeight: 800, letterSpacing: '-0.025em' },
      h2: { fontWeight: 800, letterSpacing: '-0.025em' },
      h3: { fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600 },
      body1: { letterSpacing: '-0.005em' },
      body2: { letterSpacing: '-0.005em' },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: '-0.01em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
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
          @keyframes pulseGlow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.65; transform: scale(1.08); }
          }
          /* Custom scrollbar */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.15)'};
            border-radius: 999px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: ${isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.25)'};
          }
        `,
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: {
            borderColor: isDark ? alpha('#ffffff', 0.1) : alpha('#0F172A', 0.08),
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            boxShadow: softShadow,
            border: `1px solid ${isDark ? alpha('#ffffff', 0.08) : alpha('#0F172A', 0.06)}`,
            borderRadius: 14,
            transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
            '&:hover': {
              boxShadow: softShadowHover,
              transform: 'translateY(-2px)',
              borderColor: isDark ? alpha('#ffffff', 0.16) : alpha('#0A2540', 0.14),
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: 20,
            '&:last-child': { paddingBottom: 20 },
            [theme.breakpoints.down('sm')]: {
              padding: 14,
              '&:last-child': { paddingBottom: 14 },
            },
          }),
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 9,
            fontWeight: 600,
            padding: '8px 16px',
            transition: 'all .18s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': { transform: 'scale(0.98)' },
          },
          containedPrimary: {
            background: isDark
              ? 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)'
              : 'linear-gradient(180deg, #0A2540 0%, #061A2D 100%)',
            boxShadow: isDark
              ? '0 2px 8px rgba(56, 189, 248, 0.35)'
              : '0 2px 8px rgba(10, 37, 64, 0.25)',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(180deg, #7DD3FC 0%, #0369A1 100%)'
                : 'linear-gradient(180deg, #13395E 0%, #0A2540 100%)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            transition: 'border-color .15s ease, box-shadow .15s ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? alpha('#ffffff', 0.12) : alpha('#0F172A', 0.12),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? alpha('#ffffff', 0.24) : alpha('#0A2540', 0.28),
            },
            '&.Mui-focused': {
              boxShadow: isDark
                ? '0 0 0 3px rgba(56, 189, 248, 0.2)'
                : '0 0 0 3px rgba(10, 37, 64, 0.1)',
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            borderRadius: 8,
            margin: '0 4px',
            transition: 'all .2s ease',
            '&.Mui-selected': {
              fontWeight: 700,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
              : '0 25px 50px -12px rgba(10, 37, 64, 0.25)',
            [theme.breakpoints.down('sm')]: {
              margin: 12,
              width: 'calc(100% - 24px)',
              maxHeight: 'calc(100% - 24px)',
            },
          }),
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha('#0B132B', 0.88) : alpha('#0A2540', 0.92),
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            color: '#ffffff',
            borderBottom: `2px solid ${isDark ? alpha(goldDark, 0.7) : alpha(gold, 0.8)}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            color: isDark ? '#94A3B8' : '#475569',
            fontSize: '0.8125rem',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${isDark ? alpha('#ffffff', 0.08) : alpha('#0F172A', 0.08)}`,
          },
          body: {
            fontSize: '0.875rem',
            borderBottom: `1px solid ${isDark ? alpha('#ffffff', 0.06) : alpha('#0F172A', 0.06)}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 7,
            height: 26,
            fontSize: '0.775rem',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderColor: isDark ? alpha('#ffffff', 0.08) : alpha('#0F172A', 0.08),
            backgroundColor: isDark ? '#0C1322' : '#ffffff',
          },
        },
      },
      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: { root: { borderRadius: 8 } },
      },
    },
  });

  return responsiveFontSizes(base, { factor: 2.2 });
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
export const theme = lightTheme;
