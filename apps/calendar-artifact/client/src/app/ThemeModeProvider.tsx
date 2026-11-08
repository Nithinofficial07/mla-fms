import { useEffect, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { darkTheme, lightTheme } from '@/theme';

type Mode = 'light' | 'dark';

/**
 * Follows the viewer's claude.ai theme: the host sets data-theme on <html>;
 * when it doesn't, fall back to the device's light/dark preference.
 */
function currentMode(): Mode {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(currentMode);
  useEffect(() => {
    const update = () => setMode(currentMode());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', update); } catch { /* old browser */ }
    return () => { obs.disconnect(); mq?.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);
  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
