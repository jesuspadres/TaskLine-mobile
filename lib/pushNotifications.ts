/**
 * Push notification registration and token management.
 * Uses expo-notifications + expo-device for native push support.
 *
 * IMPORTANT: expo-notifications remote push was removed from Expo Go in SDK 53+.
 * All imports are lazy (require) and guarded by isExpoGo to prevent crashes.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';

/** True when running inside Expo Go (push not supported since SDK 53) */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Lazily loaded expo-notifications module — null in Expo Go */
let _Notifications: typeof import('expo-notifications') | null = null;

function getNotifications() {
  if (isExpoGo) return null;
  if (!_Notifications) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _Notifications = require('expo-notifications') as typeof import('expo-notifications');
    } catch {
      secureLog.info('expo-notifications not available');
      return null;
    }
  }
  return _Notifications;
}

/** Initialize notification handler — call once at app startup */
export function initializeNotifications(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Check if push notifications are supported in the current environment.
 */
export function isPushSupported(): boolean {
  return !isExpoGo && Device.isDevice;
}

/**
 * Get current notification permission status.
 * Returns 'undetermined' if not supported.
 */
export async function getPermissionStatus(): Promise<string> {
  const Notifications = getNotifications();
  if (!Notifications) return 'undetermined';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
}

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if registration fails or is not supported.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    secureLog.info('Push notifications not available in this environment');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    secureLog.info('Push notifications require a physical device');
    return null;
  }

  // Check/request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    secureLog.info('Push notification permission not granted');
    return null;
  }

  // Get the project ID for Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    secureLog.error('Missing EAS project ID for push notifications');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });
    }

    return token;
  } catch (error) {
    secureLog.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Add a listener for notifications received while app is in foreground.
 * Returns a remove function, or null if not supported.
 */
export function addNotificationReceivedListener(
  listener: (notification: any) => void
): { remove: () => void } | null {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Add a listener for when user taps on a notification.
 * Returns a remove function, or null if not supported.
 */
export function addNotificationResponseReceivedListener(
  listener: (response: any) => void
): { remove: () => void } | null {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Save the push token to Supabase for the current user.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await (supabase.from('push_tokens') as any).upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        device_name: Device.deviceName || 'Unknown',
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'user_id,token' }
    );
  } catch (error) {
    secureLog.error('Failed to save push token:', error);
  }
}

/**
 * Remove the push token from Supabase (e.g., on logout).
 */
export async function removePushToken(userId: string, token: string): Promise<void> {
  try {
    await (supabase.from('push_tokens') as any)
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
  } catch (error) {
    secureLog.error('Failed to remove push token:', error);
  }
}

/**
 * Set the app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}
