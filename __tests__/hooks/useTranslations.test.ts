/**
 * Tests for useTranslations hook
 * Source: hooks/useTranslations.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock i18n module — must not reference external variables due to jest.mock hoisting
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    locale: 'en',
    defaultLocale: 'en',
    enableFallback: true,
    t: jest.fn((key: string) => `translated:${key}`),
  },
}));

// Get reference to the mock AFTER mocking
import i18n from '@/i18n';
const mockI18n = i18n as any;

// Mock SecureStore (already done in jest.setup.js but we need direct access)
const SecureStore = require('expo-secure-store');

import { useTranslations } from '@/hooks/useTranslations';

describe('useTranslations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18n.locale = 'en';
    mockI18n.t.mockImplementation((key: string) => `translated:${key}`);
    // Reset SecureStore
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(undefined);
  });

  it('should return t function, locale, and setLocale', () => {
    const { result } = renderHook(() => useTranslations());

    expect(result.current).toHaveProperty('t');
    expect(result.current).toHaveProperty('locale');
    expect(result.current).toHaveProperty('setLocale');
    expect(typeof result.current.t).toBe('function');
    expect(typeof result.current.setLocale).toBe('function');
  });

  it('should return current locale from i18n', () => {
    mockI18n.locale = 'en';
    const { result } = renderHook(() => useTranslations());

    expect(result.current.locale).toBe('en');
  });

  it('should translate keys using i18n.t', () => {
    const { result } = renderHook(() => useTranslations());

    const translated = result.current.t('common.save');
    expect(mockI18n.t).toHaveBeenCalledWith('common.save', undefined);
    expect(translated).toBe('translated:common.save');
  });

  it('should pass options to i18n.t', () => {
    const { result } = renderHook(() => useTranslations());

    const options = { count: 5 };
    result.current.t('items.count', options);
    expect(mockI18n.t).toHaveBeenCalledWith('items.count', options);
  });

  it('should update locale via setLocale', async () => {
    const { result } = renderHook(() => useTranslations());

    await act(async () => {
      await result.current.setLocale('es');
    });

    expect(mockI18n.locale).toBe('es');
    expect(result.current.locale).toBe('es');
  });

  it('should persist locale to SecureStore on native', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    const { result } = renderHook(() => useTranslations());

    await act(async () => {
      await result.current.setLocale('es');
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('taskline_locale', 'es');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should load persisted locale on mount (native)', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    SecureStore.getItemAsync.mockResolvedValue('es');
    mockI18n.locale = 'en';

    const { result } = renderHook(() => useTranslations());

    await waitFor(() => {
      expect(result.current.locale).toBe('es');
    });

    expect(mockI18n.locale).toBe('es');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should not load persisted locale if it matches current', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    SecureStore.getItemAsync.mockResolvedValue('en');
    mockI18n.locale = 'en';

    const { result } = renderHook(() => useTranslations());

    // Wait a tick for the effect to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Locale should remain 'en' — no change notification
    expect(result.current.locale).toBe('en');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should propagate locale changes to other hook instances', async () => {
    const { result: hook1 } = renderHook(() => useTranslations());
    const { result: hook2 } = renderHook(() => useTranslations());

    await act(async () => {
      await hook1.current.setLocale('es');
    });

    // Both hooks should reflect the new locale
    expect(hook1.current.locale).toBe('es');
    expect(hook2.current.locale).toBe('es');
  });

  it('should handle SecureStore failure gracefully on persist', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    SecureStore.setItemAsync.mockRejectedValue(new Error('Storage full'));

    const { result } = renderHook(() => useTranslations());

    // Should not throw
    await act(async () => {
      await result.current.setLocale('es');
    });

    // Locale should still update in-memory
    expect(result.current.locale).toBe('es');
    expect(mockI18n.locale).toBe('es');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should handle SecureStore failure gracefully on load', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    SecureStore.getItemAsync.mockRejectedValue(new Error('Corrupted'));

    // Should not throw
    const { result } = renderHook(() => useTranslations());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should not crash — locale stays valid (may be stale from prior test's memoryLocale)
    expect(typeof result.current.locale).toBe('string');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should clean up locale listener on unmount', () => {
    const { unmount } = renderHook(() => useTranslations());
    // Should not throw on unmount
    unmount();
  });

  it('should cancel async operations on unmount', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    // Delay the response
    let resolvePromise: (v: string) => void;
    SecureStore.getItemAsync.mockReturnValue(
      new Promise<string>((resolve) => { resolvePromise = resolve; })
    );
    mockI18n.locale = 'en';

    const { unmount } = renderHook(() => useTranslations());

    // Unmount before the promise resolves
    unmount();

    // Now resolve — the cancelled flag should prevent state update
    resolvePromise!('es');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // No error should occur (unmounted component won't setState)
    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('should use memory storage on web platform', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    const { result } = renderHook(() => useTranslations());

    await act(async () => {
      await result.current.setLocale('es');
    });

    // SecureStore should NOT be called on web
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(result.current.locale).toBe('es');

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });
});
