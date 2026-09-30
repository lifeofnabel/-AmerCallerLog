import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'callerlog:theme';

/** Tag/Nacht. Startwert setzt index.html (letzte Wahl, sonst wie das Gerät); jede Wahl wird pro Gerät gemerkt. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* dann nur bis zum Neuladen */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}
