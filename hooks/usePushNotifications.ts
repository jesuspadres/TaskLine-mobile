/**
 * Hook for managing push notifications lifecycle.
 * Handles registration, foreground display, and tap navigation.
 *
 * All expo-notifications access goes through lib/pushNotifications.ts
 * which guards against Expo Go (where push is unsupported since SDK 53).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import {
  initializeNotifications,
  registerForPushNotifications,
  savePushToken,
  setBadgeCount,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from '@/lib/pushNotifications';
import { secureLog } from '@/lib/security';

interface UsePushNotificationsReturn {
  /** The Expo push token, or null if not registered */
  pushToken: string | null;
  /** Whether registration is in progress */
  registering: boolean;
  /** Manually trigger registration (e.g., from settings) */
  register: () => Promise<string | null>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);
  const initialized = useRef(false);

  // Initialize notification handler once
  useEffect(() => {
    if (!initialized.current) {
      initializeNotifications();
      initialized.current = true;
    }
  }, []);

  const register = async (): Promise<string | null> => {
    setRegistering(true);
    try {
      const token = await registerForPushNotifications();
      if (token && user) {
        await savePushToken(user.id, token);
        setPushToken(token);
      }
      return token;
    } catch (error) {
      secureLog.error('Push registration failed:', error);
      return null;
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setPushToken(null);
      return;
    }

    // Register for push notifications on mount
    register();

    // Listen for notifications received while app is in foreground
    notificationListener.current = addNotificationReceivedListener(
      (notification: any) => {
        secureLog.debug('Notification received in foreground:', notification?.request?.identifier);
      }
    );

    // Listen for when user taps on a notification
    responseListener.current = addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data) handleNotificationNavigation(data);
      }
    );

    // Clear badge count when app opens
    setBadgeCount(0);

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  /**
   * Handle navigation when user taps a push notification.
   */
  const handleNotificationNavigation = (data: Record<string, any>) => {
    try {
      const { entity_type, entity_id } = data;
      if (!entity_type) {
        router.push('/(app)/notifications' as any);
        return;
      }

      switch (entity_type) {
        case 'client':
          router.push({ pathname: '/(app)/client-detail', params: { id: entity_id } } as any);
          break;
        case 'project':
          router.push({ pathname: '/(app)/project-detail', params: { id: entity_id } } as any);
          break;
        case 'request':
        case 'client_request':
          router.push({ pathname: '/(app)/request-detail', params: { id: entity_id } } as any);
          break;
        case 'invoice':
          router.push('/(app)/invoices' as any);
          break;
        case 'booking':
          router.push('/(app)/bookings' as any);
          break;
        case 'task':
          router.push('/(app)/tasks' as any);
          break;
        default:
          router.push('/(app)/notifications' as any);
      }
    } catch (error) {
      secureLog.error('Notification navigation error:', error);
      router.push('/(app)/notifications' as any);
    }
  };

  return { pushToken, registering, register };
}
