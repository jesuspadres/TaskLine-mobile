import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineStore } from '@/stores/offlineStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

export function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const pendingCount = useOfflineStore((s) => s.pendingMutations.length);
  const failedCount = useOfflineStore((s) => s.failedMutations.length);

  const showBanner = !isOnline || isSyncing || failedCount > 0;

  const translateY = useRef(new Animated.Value(showBanner ? 0 : -60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: showBanner ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showBanner, translateY]);

  if (!showBanner) {
    return null;
  }

  let backgroundColor: string;
  let icon: keyof typeof Ionicons.glyphMap;
  let message: string;

  if (failedCount > 0 && isOnline) {
    backgroundColor = colors.error;
    icon = 'alert-circle';
    message = t('offline.syncFailed');
  } else if (isSyncing) {
    backgroundColor = colors.info;
    icon = 'sync';
    message = t('offline.syncing', { count: pendingCount });
  } else {
    backgroundColor = colors.warning;
    icon = 'cloud-offline';
    message = pendingCount > 0
      ? `${t('offline.youreOffline')} · ${t('offline.pendingChanges', { count: pendingCount })}`
      : t('offline.youreOffline');
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={[styles.banner, { backgroundColor }]}>
        <Ionicons name={icon} size={16} color="#fff" />
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
  },
  text: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
