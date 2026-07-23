import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme as useSystemColorScheme } from './use-color-scheme';

const THEME_PREFERENCE_KEY = 'theme_preference_v1';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeColors = Record<keyof typeof Colors.light, string>;

interface ThemeContextValue {
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Named AppThemeProvider (not ThemeProvider) — app/_layout.tsx already imports a different
// ThemeProvider from @react-navigation/native for the navigation chrome, and the two aren't
// interchangeable, so a shared name would only invite confusion.
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
  }, []);

  const colorScheme = preference === 'system' ? (systemScheme ?? 'light') : preference;

  return (
    <ThemeContext.Provider value={{ colors: Colors[colorScheme], colorScheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }
  return context;
}
