import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import {
  registerForPushNotifications,
  savePushToken,
  getPermissionStatus,
  isPushSupported,
} from '@/lib/pushNotifications';

interface NotificationPrefs {
  notify_new_request: boolean;
  notify_request_updates: boolean;
  notify_project_updates: boolean;
  notify_task_updates: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  email_new_request: boolean;
  email_request_updates: boolean;
  email_project_updates: boolean;
  email_task_updates: boolean;
  email_daily_digest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  notify_new_request: true,
  notify_request_updates: true,
  notify_project_updates: true,
  notify_task_updates: true,
  notify_comments: true,
  notify_mentions: true,
  email_new_request: true,
  email_request_updates: true,
  email_project_updates: true,
  email_task_updates: true,
  email_daily_digest: true,
};

interface ToggleItem {
  key: keyof NotificationPrefs;
  icon: string;
  i18nKey: string;
}

const IN_APP_ITEMS: ToggleItem[] = [
  { key: 'notify_new_request', icon: 'mail-unread-outline', i18nKey: 'notificationSettings.newRequest' },
  { key: 'notify_request_updates', icon: 'refresh-outline', i18nKey: 'notificationSettings.requestUpdates' },
  { key: 'notify_project_updates', icon: 'folder-outline', i18nKey: 'notificationSettings.projectUpdates' },
  { key: 'notify_task_updates', icon: 'checkbox-outline', i18nKey: 'notificationSettings.taskUpdates' },
  { key: 'notify_comments', icon: 'chatbubble-outline', i18nKey: 'notificationSettings.comments' },
  { key: 'notify_mentions', icon: 'at-outline', i18nKey: 'notificationSettings.mentions' },
];

const EMAIL_ITEMS: ToggleItem[] = [
  { key: 'email_new_request', icon: 'mail-outline', i18nKey: 'notificationSettings.newRequest' },
  { key: 'email_request_updates', icon: 'refresh-outline', i18nKey: 'notificationSettings.requestUpdates' },
  { key: 'email_project_updates', icon: 'folder-outline', i18nKey: 'notificationSettings.projectUpdates' },
  { key: 'email_task_updates', icon: 'checkbox-outline', i18nKey: 'notificationSettings.taskUpdates' },
  { key: 'email_daily_digest', icon: 'newspaper-outline', i18nKey: 'notificationSettings.dailyDigest' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const savingRef = useRef(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushChecking, setPushChecking] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [debugTesting, setDebugTesting] = useState(false);

  // Check push notification permission status
  useEffect(() => {
    const checkPushStatus = async () => {
      try {
        const status = await getPermissionStatus();
        setPushEnabled(status === 'granted');
      } catch {} finally {
        setPushChecking(false);
      }
    };
    checkPushStatus();
  }, []);

  const runPushDiagnostic = async () => {
    setDebugTesting(true);
    const info: string[] = [];

    info.push(`Platform: ${Platform.OS}`);
    info.push(`Is Device: ${Device.isDevice}`);
    info.push(`Exec Env: ${Constants.executionEnvironment}`);
    info.push(`Is Expo Go: ${Constants.executionEnvironment === ExecutionEnvironment.StoreClient}`);
    info.push(`Push Supported: ${isPushSupported()}`);

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    info.push(`Project ID: ${projectId || 'MISSING'}`);

    try {
      const permStatus = await getPermissionStatus();
      info.push(`Permission: ${permStatus}`);
    } catch (e: any) {
      info.push(`Permission Error: ${e.message}`);
    }

    // Try direct expo-notifications call to get detailed error
    try {
      info.push('Loading expo-notifications...');
      setDebugInfo([...info]);
      const Notifications = require('expo-notifications');
      info.push(`Module loaded: ${!!Notifications}`);

      info.push('Getting push token...');
      setDebugInfo([...info]);
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      const token = tokenData.data;
      info.push(`Token: ${token}`);

      if (token && user?.id) {
        try {
          await savePushToken(user.id, token);
          info.push('Token saved to DB!');
        } catch (e: any) {
          info.push(`Save Error: ${e.message}`);
        }
      }
    } catch (e: any) {
      info.push(`TOKEN ERROR: ${e.message}`);
      info.push(`Stack: ${(e.stack || '').substring(0, 200)}`);
    }

    setDebugInfo(info);
    setDebugTesting(false);
  };

  const handleTogglePush = async () => {
    if (pushEnabled) {
      // Can't revoke programmatically — send to system settings
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
      } else {
        Linking.openSettings();
      }
    } else {
      // Try to request permission
      const token = await registerForPushNotifications();
      if (token) {
        setPushEnabled(true);
        if (user?.id) {
          await savePushToken(user.id, token);
        }
        showToast('success', t('notificationSettings.pushEnabled'));
      } else {
        // Permission denied — send to system settings
        if (Platform.OS === 'ios') {
          Linking.openURL('app-settings:');
        } else {
          Linking.openSettings();
        }
      }
    }
  };

  // Load preferences on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadPrefs = async () => {
      try {
        // Try RPC first
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
          'get_notification_preferences'
        );

        if (!rpcError && rpcData) {
          setPrefs({ ...DEFAULT_PREFS, ...rpcData });
          setLoading(false);
          return;
        }

        // Fallback to direct query
        const { data, error } = await (
          supabase.from('notification_preferences') as any
        )
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          setPrefs({
            notify_new_request: data.notify_new_request ?? true,
            notify_request_updates: data.notify_request_updates ?? true,
            notify_project_updates: data.notify_project_updates ?? true,
            notify_task_updates: data.notify_task_updates ?? true,
            notify_comments: data.notify_comments ?? true,
            notify_mentions: data.notify_mentions ?? true,
            email_new_request: data.email_new_request ?? true,
            email_request_updates: data.email_request_updates ?? true,
            email_project_updates: data.email_project_updates ?? true,
            email_task_updates: data.email_task_updates ?? true,
            email_daily_digest: data.email_daily_digest ?? true,
          });
        }
        // If no record found, defaults are already set
      } catch {
        // If both methods fail, keep defaults
      } finally {
        setLoading(false);
      }
    };

    loadPrefs();
  }, [user?.id]);

  // Save preferences to Supabase
  const savePrefs = useCallback(
    async (updatedPrefs: NotificationPrefs) => {
      if (!user?.id || savingRef.current) return;
      savingRef.current = true;

      try {
        const { error } = await (
          supabase.from('notification_preferences') as any
        ).upsert(
          {
            user_id: user.id,
            ...updatedPrefs,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          showToast('error', t('common.error'));
        }
      } catch {
        showToast('error', 'Failed to save notification preferences');
      } finally {
        savingRef.current = false;
      }
    },
    [user?.id]
  );

  // Handle toggle change
  const handleToggle = useCallback(
    (key: keyof NotificationPrefs) => {
      setPrefs((prev) => {
        const updated = { ...prev, [key]: !prev[key] };
        savePrefs(updated);
        return updated;
      });
    },
    [savePrefs]
  );

  const renderToggleItem = (item: ToggleItem, isLast: boolean) => (
    <View
      key={item.key}
      style={[
        styles.settingItem,
        { borderBottomColor: colors.borderLight },
        isLast && styles.lastItem,
      ]}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}
      >
        <Ionicons
          name={item.icon as any}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>
          {t(item.i18nKey)}
        </Text>
      </View>
      <Switch
        value={prefs[item.key]}
        onValueChange={() => handleToggle(item.key)}
        trackColor={{
          false: colors.border,
          true: colors.primary + '60',
        }}
        thumbColor={prefs[item.key] ? colors.primary : colors.surface}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('notificationSettings.title')}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('notificationSettings.title')}
          </Text>
        </View>

        {/* Push Notifications Section — only shown on physical devices outside Expo Go */}
        {Platform.OS !== 'web' && isPushSupported() && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              {t('notificationSettings.pushSection')}
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.settingItem, styles.lastItem]}>
                <View
                  style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {t('notificationSettings.pushNotifications')}
                  </Text>
                  <Text style={[styles.pushStatusText, { color: colors.textTertiary }]}>
                    {pushEnabled
                      ? t('notificationSettings.pushEnabledStatus')
                      : t('notificationSettings.pushDisabledStatus')}
                  </Text>
                </View>
                {pushChecking ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={pushEnabled}
                    onValueChange={handleTogglePush}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary + '60',
                    }}
                    thumbColor={pushEnabled ? colors.primary : colors.surface}
                  />
                )}
              </View>
            </View>
          </View>
        )}

        {/* Push Debug Section */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              PUSH DEBUG
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[styles.settingItem, styles.lastItem, { justifyContent: 'center' }]}
                onPress={runPushDiagnostic}
                disabled={debugTesting}
              >
                {debugTesting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: FontSizes.md }}>
                    Test Push Registration
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {debugInfo.length > 0 && (
              <View style={[styles.sectionContent, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: Spacing.sm }]}>
                {debugInfo.map((line, i) => (
                  <Text
                    key={i}
                    style={{ color: colors.text, fontSize: FontSizes.xs, paddingHorizontal: Spacing.md, paddingVertical: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                    selectable
                  >
                    {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* In-App Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
            {t('notificationSettings.inAppSection')}
          </Text>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {IN_APP_ITEMS.map((item, index) =>
              renderToggleItem(item, index === IN_APP_ITEMS.length - 1)
            )}
          </View>
        </View>

        {/* Email Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
            {t('notificationSettings.emailSection')}
          </Text>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {EMAIL_ITEMS.map((item, index) =>
              renderToggleItem(item, index === EMAIL_ITEMS.length - 1)
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  sectionContent: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  pushStatusText: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
});
