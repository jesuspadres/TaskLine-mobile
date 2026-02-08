import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  initialize: () => Promise<void>;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  isDark: Appearance.getColorScheme() === 'dark',

  initialize: async () => {
    try {
      if (Platform.OS !== 'web') {
        const SecureStore = require('expo-secure-store');
        const saved = await SecureStore.getItemAsync('theme_mode');
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          const mode = saved as ThemeMode;
          set({ mode, isDark: resolveIsDark(mode) });
        }
      }
    } catch {}

    // Listen for system theme changes
    Appearance.addChangeListener(({ colorScheme }) => {
      const current = get();
      if (current.mode === 'system') {
        set({ isDark: colorScheme === 'dark' });
      }
    });
  },

  setMode: (mode: ThemeMode) => {
    set({ mode, isDark: resolveIsDark(mode) });
    try {
      if (Platform.OS !== 'web') {
        const SecureStore = require('expo-secure-store');
        SecureStore.setItemAsync('theme_mode', mode);
      }
    } catch {}
  },

  toggleTheme: () => {
    const current = get();
    const newMode: ThemeMode = current.isDark ? 'light' : 'dark';
    get().setMode(newMode);
  },
}));
