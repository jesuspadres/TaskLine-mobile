/**
 * Tests for useTheme hook
 * Source: hooks/useTheme.ts
 */
import { renderHook, act } from '@testing-library/react-native';

// Mock the theme store before importing the hook
const mockSetMode = jest.fn();
const mockToggleTheme = jest.fn();
let mockStoreState = {
  isDark: false,
  mode: 'light' as 'light' | 'dark' | 'system',
  setMode: mockSetMode,
  toggleTheme: mockToggleTheme,
};

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: jest.fn(() => mockStoreState),
}));

jest.mock('@/constants/theme', () => ({
  Colors: {
    light: {
      primary: '#0B3D91',
      background: '#f9fafb',
      text: '#111827',
      surface: '#ffffff',
    },
    dark: {
      primary: '#3b82f6',
      background: '#111827',
      text: '#f9fafb',
      surface: '#1f2937',
    },
  },
}));

import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/themeStore';

describe('useTheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      isDark: false,
      mode: 'light',
      setMode: mockSetMode,
      toggleTheme: mockToggleTheme,
    };
    (useThemeStore as unknown as jest.Mock).mockReturnValue(mockStoreState);
  });

  it('should return light colors when isDark is false', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.primary).toBe('#0B3D91');
    expect(result.current.colors.background).toBe('#f9fafb');
    expect(result.current.colors.text).toBe('#111827');
  });

  it('should return dark colors when isDark is true', () => {
    mockStoreState = { ...mockStoreState, isDark: true, mode: 'dark' };
    (useThemeStore as unknown as jest.Mock).mockReturnValue(mockStoreState);

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.primary).toBe('#3b82f6');
    expect(result.current.colors.background).toBe('#111827');
    expect(result.current.colors.text).toBe('#f9fafb');
  });

  it('should return isDark boolean from store', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });

  it('should return isDark true when store says dark', () => {
    mockStoreState = { ...mockStoreState, isDark: true, mode: 'dark' };
    (useThemeStore as unknown as jest.Mock).mockReturnValue(mockStoreState);

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('should return mode from store', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('light');
  });

  it('should return system mode from store', () => {
    mockStoreState = { ...mockStoreState, mode: 'system' };
    (useThemeStore as unknown as jest.Mock).mockReturnValue(mockStoreState);

    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });

  it('should expose setMode function from store', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.setMode).toBe(mockSetMode);
    result.current.setMode('dark');
    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('should expose toggleTheme function from store', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.toggleTheme).toBe(mockToggleTheme);
    result.current.toggleTheme();
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should memoize colors object when isDark does not change', () => {
    const { result, rerender } = renderHook(() => useTheme());
    const firstColors = result.current.colors;

    rerender({});

    // Same reference because isDark did not change
    expect(result.current.colors).toBe(firstColors);
  });

  it('should return new colors object when isDark changes', () => {
    const { result, rerender } = renderHook(() => useTheme());
    const lightColors = result.current.colors;
    expect(lightColors.primary).toBe('#0B3D91');

    // Switch to dark
    mockStoreState = { ...mockStoreState, isDark: true, mode: 'dark' };
    (useThemeStore as unknown as jest.Mock).mockReturnValue(mockStoreState);
    rerender({});

    const darkColors = result.current.colors;
    expect(darkColors.primary).toBe('#3b82f6');
    // Colors object should be different
    expect(darkColors).not.toBe(lightColors);
  });

  it('should return all expected properties', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current).toHaveProperty('colors');
    expect(result.current).toHaveProperty('isDark');
    expect(result.current).toHaveProperty('mode');
    expect(result.current).toHaveProperty('setMode');
    expect(result.current).toHaveProperty('toggleTheme');
  });

  it('should delegate setMode with all valid modes', () => {
    const { result } = renderHook(() => useTheme());

    result.current.setMode('light');
    expect(mockSetMode).toHaveBeenCalledWith('light');

    result.current.setMode('dark');
    expect(mockSetMode).toHaveBeenCalledWith('dark');

    result.current.setMode('system');
    expect(mockSetMode).toHaveBeenCalledWith('system');

    expect(mockSetMode).toHaveBeenCalledTimes(3);
  });
});
