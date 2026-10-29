import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Storage keys; index.html reads the same keys before first paint to avoid a light flash. */
export const THEME_KEYS = { store: 'sartoria-theme', admin: 'sartoria-admin-theme' } as const;

function initial(key: string, fallback: 'light' | 'system'): Theme {
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable: use the fallback */
  }
  if (fallback === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Light/dark theme for one area of the app: toggles `.dark` on <html> while mounted (so portals
 * inherit it) and remembers the choice per area.
 */
export function useColorTheme(scope: keyof typeof THEME_KEYS, fallback: 'light' | 'system' = 'light') {
  const key = THEME_KEYS[scope];
  const [theme, setTheme] = useState<Theme>(() => initial(key, fallback));
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(key, theme);
    } catch {
      /* ignore */
    }
    return () => root.classList.remove('dark');
  }, [theme, key]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
