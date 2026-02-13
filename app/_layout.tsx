import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTheme } from '@/hooks/useTheme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function RootLayout() {
  const { user, loading, initialized, initialize } = useAuthStore();
  const initializeTheme = useThemeStore((s) => s.initialize);
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // Initialize network monitoring
  useNetworkStatus();

  useEffect(() => {
    initialize();
    initializeTheme();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
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
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
