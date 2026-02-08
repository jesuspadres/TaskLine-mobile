import { useMemo } from 'react';
import { Colors, type ThemeColors } from '@/constants/theme';
import { useThemeStore } from '@/stores/themeStore';

export function useTheme() {
  const { isDark, mode, setMode, toggleTheme } = useThemeStore();
  const colors: ThemeColors = useMemo(
    () => (isDark ? Colors.dark : Colors.light),
    [isDark]
  );

  return {
    colors,
    isDark,
    mode,
    setMode,
    toggleTheme,
  };
}
