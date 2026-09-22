import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { darkTheme, lightTheme } from '@/theme';

type Mode = 'light' | 'dark';
const STORAGE_KEY = 'mla-fms:theme-mode';

interface Ctx {
  mode: Mode;
  toggle: () => void;
}
const ThemeModeContext = createContext<Ctx | null>(null);

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private browsing / storage disabled - fall through to system preference */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Wraps MUI's ThemeProvider, switching between the light/dark theme and remembering the choice per-browser. */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const toggle = () => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const ctx = useMemo(() => ({ mode, toggle }), [mode]);

  return (
    <ThemeModeContext.Provider value={ctx}>
      <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): Ctx {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
