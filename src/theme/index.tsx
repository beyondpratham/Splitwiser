import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Tokens } from './tokens';

export * from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'splitwiser.theme';

interface ThemeState {
  t: Tokens;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState>({ t: light, mode: 'system', setMode: () => {} });

/** Light / dark / follow-the-system, remembered on the device. */
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo(() => ({ t: isDark ? dark : light, mode, setMode }), [isDark, mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Current design tokens. */
export const useTheme = () => useContext(ThemeContext).t;

/** Theme mode controls (Settings screen). */
export const useThemeMode = () => {
  const { mode, setMode } = useContext(ThemeContext);
  return { mode, setMode };
};
