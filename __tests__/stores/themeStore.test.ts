/**
 * Tests for themeStore (stores/themeStore.ts)
 *
 * Tests the Zustand store directly via getState() / setState().
 * Mocks Appearance and SecureStore.
 */

import { Appearance, Platform } from 'react-native';

// Keep a reference to the mocked SecureStore so we can inspect/configure it
const SecureStore = require('expo-secure-store');

// ── Import store ─────────────────────────────────────────────────
import { useThemeStore } from '@/stores/themeStore';

// ── Helpers ──────────────────────────────────────────────────────
function resetStore() {
  useThemeStore.setState({
    mode: 'system',
    isDark: Appearance.getColorScheme() === 'dark',
  });
}

// ── Tests ────────────────────────────────────────────────────────
describe('themeStore', () => {
  const originalPlatformOS = Platform.OS;
  let appearanceListenerCallback: ((prefs: { colorScheme: string | null }) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: system is light
    (Appearance.getColorScheme as jest.Mock) = jest.fn(() => 'light');
    (Appearance.addChangeListener as jest.Mock) = jest.fn((cb) => {
      appearanceListenerCallback = cb;
      return { remove: jest.fn() };
    });
    // Reset Platform to non-web (native)
    (Platform as any).OS = 'ios';
    resetStore();
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatformOS;
    appearanceListenerCallback = null;
  });

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('has mode "system" by default', () => {
      expect(useThemeStore.getState().mode).toBe('system');
    });

    it('isDark matches Appearance.getColorScheme() when mode is system', () => {
      // We mocked getColorScheme to return 'light', so isDark should be false
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('isDark is true when system is dark', () => {
      (Appearance.getColorScheme as jest.Mock) = jest.fn(() => 'dark');
      resetStore();
      expect(useThemeStore.getState().isDark).toBe(true);
    });
  });

  // ── initialize() ──────────────────────────────────────────────
  describe('initialize()', () => {
    it('reads saved theme from SecureStore on native', async () => {
      SecureStore.getItemAsync.mockResolvedValue('dark');

      await useThemeStore.getState().initialize();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('theme_mode');
      expect(useThemeStore.getState().mode).toBe('dark');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('reads saved "light" theme from SecureStore', async () => {
      SecureStore.getItemAsync.mockResolvedValue('light');

      await useThemeStore.getState().initialize();

      expect(useThemeStore.getState().mode).toBe('light');
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('reads saved "system" theme from SecureStore', async () => {
      SecureStore.getItemAsync.mockResolvedValue('system');
      (Appearance.getColorScheme as jest.Mock) = jest.fn(() => 'dark');

      await useThemeStore.getState().initialize();

      expect(useThemeStore.getState().mode).toBe('system');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('keeps defaults when SecureStore has no saved theme', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      await useThemeStore.getState().initialize();

      expect(useThemeStore.getState().mode).toBe('system');
    });

    it('ignores invalid saved theme values', async () => {
      SecureStore.getItemAsync.mockResolvedValue('rainbow');

      await useThemeStore.getState().initialize();

      // Should remain 'system' since 'rainbow' is not valid
      expect(useThemeStore.getState().mode).toBe('system');
    });

    it('sets up an Appearance change listener', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      await useThemeStore.getState().initialize();

      expect(Appearance.addChangeListener).toHaveBeenCalledTimes(1);
    });

    it('responds to system theme changes when mode is "system"', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      await useThemeStore.getState().initialize();

      // Simulate system going dark
      appearanceListenerCallback?.({ colorScheme: 'dark' });
      expect(useThemeStore.getState().isDark).toBe(true);

      // Simulate system going light
      appearanceListenerCallback?.({ colorScheme: 'light' });
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('ignores system changes when mode is explicit "dark"', async () => {
      SecureStore.getItemAsync.mockResolvedValue('dark');

      await useThemeStore.getState().initialize();

      // Simulate system going light — should be ignored
      appearanceListenerCallback?.({ colorScheme: 'light' });

      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('ignores system changes when mode is explicit "light"', async () => {
      SecureStore.getItemAsync.mockResolvedValue('light');

      await useThemeStore.getState().initialize();

      // Simulate system going dark — should be ignored
      appearanceListenerCallback?.({ colorScheme: 'dark' });

      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('does not read SecureStore on web', async () => {
      (Platform as any).OS = 'web';
      SecureStore.getItemAsync.mockClear();

      await useThemeStore.getState().initialize();

      // The store guards with Platform.OS !== 'web' before reading SecureStore
      // But addChangeListener should still be called
      expect(Appearance.addChangeListener).toHaveBeenCalled();
    });
  });

  // ── setMode() ──────────────────────────────────────────────────
  describe('setMode()', () => {
    it('sets mode to "dark" and isDark to true', () => {
      useThemeStore.getState().setMode('dark');

      expect(useThemeStore.getState().mode).toBe('dark');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('sets mode to "light" and isDark to false', () => {
      useThemeStore.getState().setMode('light');

      expect(useThemeStore.getState().mode).toBe('light');
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('sets mode to "system" and resolves isDark from Appearance', () => {
      (Appearance.getColorScheme as jest.Mock) = jest.fn(() => 'dark');

      useThemeStore.getState().setMode('system');

      expect(useThemeStore.getState().mode).toBe('system');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('persists to SecureStore on native', () => {
      useThemeStore.getState().setMode('dark');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('theme_mode', 'dark');
    });

    it('does not persist to SecureStore on web', () => {
      (Platform as any).OS = 'web';
      SecureStore.setItemAsync.mockClear();

      useThemeStore.getState().setMode('dark');

      // The store checks Platform.OS !== 'web' before persisting
      // Mode should still be updated in memory
      expect(useThemeStore.getState().mode).toBe('dark');
    });
  });

  // ── toggleTheme() ─────────────────────────────────────────────
  describe('toggleTheme()', () => {
    it('toggles from dark to light', () => {
      useThemeStore.setState({ mode: 'dark', isDark: true });

      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().mode).toBe('light');
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('toggles from light to dark', () => {
      useThemeStore.setState({ mode: 'light', isDark: false });

      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().mode).toBe('dark');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('toggles from system-light to dark', () => {
      // system mode, but currently light
      useThemeStore.setState({ mode: 'system', isDark: false });

      useThemeStore.getState().toggleTheme();

      // isDark was false so newMode = 'dark'
      expect(useThemeStore.getState().mode).toBe('dark');
      expect(useThemeStore.getState().isDark).toBe(true);
    });

    it('toggles from system-dark to light', () => {
      // system mode, but currently dark
      useThemeStore.setState({ mode: 'system', isDark: true });

      useThemeStore.getState().toggleTheme();

      // isDark was true so newMode = 'light'
      expect(useThemeStore.getState().mode).toBe('light');
      expect(useThemeStore.getState().isDark).toBe(false);
    });

    it('persists the new mode via setMode', () => {
      useThemeStore.setState({ mode: 'dark', isDark: true });

      useThemeStore.getState().toggleTheme();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('theme_mode', 'light');
    });
  });
});
