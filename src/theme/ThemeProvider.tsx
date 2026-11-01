import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { prefs } from '@/lib/prefs';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(
    () => (prefs.get('theme') as ThemePreference | null) ?? 'system',
  );
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';

  const setPreference = (p: ThemePreference) => {
    prefs.set('theme', p);
    setPref(p);
  };

  return (
    <ThemeContext.Provider
      value={{ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
