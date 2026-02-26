import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import * as Sentry from '@sentry/react-native';

// Suppress Supabase auth refresh token errors from LogBox
LogBox.ignoreLogs(['Invalid Refresh Token']);
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useBiometricStore } from '@/stores/biometricStore';
import { useTheme } from '@/hooks/useTheme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { LoadingOverlayProvider } from '@/components/LoadingOverlay';
import { TutorialProvider } from '@/components/TutorialOverlay';
import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { ENV } from '@/lib/env';

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  enabled: !!ENV.SENTRY_DSN,
  tracesSampleRate: 1.0,
  _experiments: {
    profilesSampleRate: 1.0,
  },
  environment: __DEV__ ? 'development' : 'production',
  beforeSend(event) {
    if (__DEV__) return null;
    // Filter known non-actionable errors
    const message = event.exception?.values?.[0]?.value || '';
    if (message.includes('Refresh Token')) return null;
    // Android react-native-screens bug: stale drawing order during transitions
    if (message.includes('getChildDrawingOrder')) return null;
    return event;
  },
});

function RootLayout() {
  const { user, loading, initialized, initialize } = useAuthStore();
  const initializeTheme = useThemeStore((s) => s.initialize);
  const initializeBiometric = useBiometricStore((s) => s.initialize);
  const initializeSubscription = useSubscriptionStore((s) => s.initialize);
  const clearSubscription = useSubscriptionStore((s) => s.clear);
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // Initialize network monitoring
  useNetworkStatus();

  // Initialize push notifications (registers token when user is logged in)
  usePushNotifications();

  // Biometric lock state (hook handles AppState monitoring)
  const { isLocked } = useBiometricAuth();

  useEffect(() => {
    initialize();
    initializeTheme();
    initializeBiometric();
  }, []);

  // Initialize subscription when user logs in, clear on logout
  // Set Sentry user context for error attribution
  useEffect(() => {
    if (user) {
      initializeSubscription(user.id);
      Sentry.setUser({ id: user.id, email: user.email });
    } else if (initialized) {
      clearSubscription();
      Sentry.setUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/dashboard');
    }
  }, [user, segments, initialized]);

  if (!initialized || loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <LoadingOverlayProvider>
          <TutorialProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={{ flex: 1 }}>
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
              </Stack>
              {isLocked && user && <BiometricLockScreen />}
            </View>
          </TutorialProvider>
        </LoadingOverlayProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
