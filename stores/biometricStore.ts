import { create } from 'zustand';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

type BiometricType = 'faceid' | 'fingerprint' | 'iris' | null;

const LOCK_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface BiometricState {
  enabled: boolean;
  isLocked: boolean;
  isAvailable: boolean;
  biometricType: BiometricType;
  initialized: boolean;
  lastActiveAt: number | null;
  hasBeenPrompted: boolean;
}

interface BiometricStore extends BiometricState {
  initialize: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
  lockIfExpired: () => void;
  unlock: () => void;
  touchActivity: () => void;
  setPrompted: () => Promise<void>;
  checkAvailability: () => Promise<void>;
}

function mapAuthType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'faceid';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return null;
}

export const useBiometricStore = create<BiometricStore>((set, get) => ({
  enabled: false,
  isLocked: false,
  isAvailable: false,
  biometricType: null,
  initialized: false,
  lastActiveAt: null,
  hasBeenPrompted: false,

  initialize: async () => {
    if (Platform.OS === 'web') {
      set({ initialized: true });
      return;
    }

    try {
      // Check hardware availability
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isAvailable = hasHardware && isEnrolled;

      let biometricType: BiometricType = null;
      if (isAvailable) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        biometricType = mapAuthType(types);
      }

      // Load saved preference + last activity timestamp + prompt flag
      let enabled = false;
      let lastActiveAt: number | null = null;
      let hasBeenPrompted = false;
      const SecureStore = require('expo-secure-store');
      if (isAvailable) {
        const saved = await SecureStore.getItemAsync('biometric_enabled');
        enabled = saved === 'true';
        const savedTimestamp = await SecureStore.getItemAsync('biometric_last_active');
        if (savedTimestamp) {
          lastActiveAt = parseInt(savedTimestamp, 10);
        }
      }
      const prompted = await SecureStore.getItemAsync('biometric_prompted');
      hasBeenPrompted = prompted === 'true';

      // Lock on cold start only if 3 days have passed since last activity
      const shouldLock = enabled && lastActiveAt != null && (Date.now() - lastActiveAt) >= LOCK_TIMEOUT_MS;

      set({
        enabled,
        isAvailable,
        biometricType,
        initialized: true,
        lastActiveAt,
        hasBeenPrompted,
        isLocked: shouldLock,
      });
    } catch {
      set({ initialized: true });
    }
  },

  setEnabled: async (value: boolean) => {
    set({ enabled: value });
    try {
      if (Platform.OS !== 'web') {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('biometric_enabled', value ? 'true' : 'false');
        if (value) {
          // Set initial activity timestamp when enabling
          const now = Date.now();
          set({ lastActiveAt: now });
          await SecureStore.setItemAsync('biometric_last_active', String(now));
        }
      }
    } catch {}
  },

  lockIfExpired: () => {
    const { enabled, lastActiveAt } = get();
    if (!enabled || Platform.OS === 'web') return;

    const expired = lastActiveAt == null || (Date.now() - lastActiveAt) >= LOCK_TIMEOUT_MS;
    if (expired) {
      set({ isLocked: true });
    }
  },

  unlock: () => {
    set({ isLocked: false });
  },

  touchActivity: () => {
    if (Platform.OS === 'web') return;
    const now = Date.now();
    set({ lastActiveAt: now });
    try {
      const SecureStore = require('expo-secure-store');
      SecureStore.setItemAsync('biometric_last_active', String(now));
    } catch {}
  },

  setPrompted: async () => {
    set({ hasBeenPrompted: true });
    try {
      if (Platform.OS !== 'web') {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('biometric_prompted', 'true');
      }
    } catch {}
  },

  checkAvailability: async () => {
    if (Platform.OS === 'web') return;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isAvailable = hasHardware && isEnrolled;

      let biometricType: BiometricType = null;
      if (isAvailable) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        biometricType = mapAuthType(types);
      }

      set({ isAvailable, biometricType });

      // If biometrics became unavailable, disable the feature
      if (!isAvailable && get().enabled) {
        get().setEnabled(false);
        get().unlock();
      }
    } catch {}
  },
}));
