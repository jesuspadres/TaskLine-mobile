import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { FilterChips, EmptyState } from '@/components';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    request_new: 'mail',
    project_approved: 'checkmark-circle',
    project_declined: 'close-circle',
    task_assigned: 'checkbox',
    task_completed: 'checkmark-done',
    invoice_paid: 'card',
    invoice_overdue: 'alert-circle',
    booking_new: 'calendar',
    booking_confirmed: 'calendar-outline',
    booking_cancelled: 'calendar-clear',
  };
  return map[type] || 'notifications';
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
  } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(filter);
    setRefreshing(false);
  }, [filter]);

  const handleFilterChange = (key: string) => {
    setFilter(key as 'all' | 'unread');
    fetchNotifications(key as 'all' | 'unread');
  };

  const handleNotificationPress = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Navigate to the linked entity if available
    if (notification.link_url) {
      router.push(notification.link_url as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        <FilterChips
          options={FILTERS}
          selected={filter}
          onSelect={handleFilterChange}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description={filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here'}
          />
        }
        renderItem={({ item }) => {
          const iconName = getNotificationIcon(item.type);
          return (
            <TouchableOpacity
              style={[
                styles.notificationCard,
                {
                  backgroundColor: item.is_read ? colors.surface : colors.infoLight,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.is_read ? colors.surfaceSecondary : colors.primary + '20' },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={18}
                  color={item.is_read ? colors.textTertiary : colors.primary}
                />
              </View>
              <View style={styles.notificationContent}>
                <Text
                  style={[
                    styles.notificationTitle,
                    { color: colors.text, fontWeight: item.is_read ? '400' : '600' },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.message && (
                  <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.message}
                  </Text>
                )}
                <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                  {getRelativeTime(item.created_at)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => archiveNotification(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    flex: 1,
  },
  markAllButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  markAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FontSizes.sm,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: FontSizes.xs,
    lineHeight: 16,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: FontSizes.xs,
  },
});
