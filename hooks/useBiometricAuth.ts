import { useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useBiometricStore } from '@/stores/biometricStore';
import { useAuthStore } from '@/stores/authStore';
import { useTranslations } from '@/hooks/useTranslations';

export function useBiometricAuth() {
  const { t } = useTranslations();
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);

  const user = useAuthStore((s) => s.user);
  const enabled = useBiometricStore((s) => s.enabled);
  const isLocked = useBiometricStore((s) => s.isLocked);
  const isAvailable = useBiometricStore((s) => s.isAvailable);
  const biometricType = useBiometricStore((s) => s.biometricType);
  const lockIfExpired = useBiometricStore((s) => s.lockIfExpired);
  const unlock = useBiometricStore((s) => s.unlock);
  const setEnabled = useBiometricStore((s) => s.setEnabled);
  const checkAvailability = useBiometricStore((s) => s.checkAvailability);
  const touchActivity = useBiometricStore((s) => s.touchActivity);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || isAuthenticating.current) return false;
    isAuthenticating.current = true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('biometric.promptMessage'),
        cancelLabel: t('biometric.cancelLabel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        unlock();
        touchActivity();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isAuthenticating.current = false;
    }
  }, [t, unlock, touchActivity]);

  const enableBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    try {
      // Verify biometric works before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('biometric.promptMessage'),
        cancelLabel: t('biometric.cancelLabel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        await setEnabled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [t, setEnabled]);

  const disableBiometric = useCallback(() => {
    setEnabled(false);
    unlock();
  }, [setEnabled, unlock]);

  // Auto-unlock if user logs out while locked
  useEffect(() => {
    if (!user && isLocked) {
      unlock();
    }
  }, [user, isLocked, unlock]);

  // Monitor AppState for background → active transitions
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = appState.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';

      if (wasBackground && isActive) {
        checkAvailability();

        // Only lock if 3-day inactivity timeout has passed
        const { enabled: currentEnabled } = useBiometricStore.getState();
        const { user: currentUser } = useAuthStore.getState();
        if (currentEnabled && currentUser) {
          lockIfExpired();
        }
      }

      // Record activity when going to background
      if (nextAppState.match(/inactive|background/) && !appState.current.match(/inactive|background/)) {
        const { enabled: currentEnabled } = useBiometricStore.getState();
        if (currentEnabled) {
          touchActivity();
        }
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [checkAvailability, lockIfExpired, touchActivity]);

  return {
    isLocked,
    isAvailable,
    biometricType,
    enabled,
    authenticate,
    enableBiometric,
    disableBiometric,
  };
}
