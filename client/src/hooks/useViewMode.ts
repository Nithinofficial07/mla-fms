import { useState } from 'react';

export type ViewMode = 'table' | 'cards';

/** Remembers a list's table/cards choice per-browser, keyed so different lists don't clash. */
export function useViewMode(key: string, initial: ViewMode = 'table') {
  const storageKey = `view-mode:${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'table' || saved === 'cards' ? saved : initial;
    } catch {
      return initial;
    }
  });

  const update = (next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* private browsing / storage disabled - the choice just won't persist */
    }
  };

  return [mode, update] as const;
}
