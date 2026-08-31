import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ dark: true, toggle: () => {}, setDark: () => {} });

const readInitial = () => {
  try {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
  } catch (_) { /* ignore */ }
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  } catch (_) {
    return true;
  }
};

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(readInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('darkMode', String(dark)); } catch (_) { /* ignore */ }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
