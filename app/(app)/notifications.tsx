import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslations } from '@/hooks/useTranslations';
import { FilterChips, EmptyState, ConfirmDialog, showToast } from '@/components';
import { useOfflineStore } from '@/stores/offlineStore';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    new_request: 'mail',
    request_new: 'mail',
    project_approved: 'checkmark-circle',
    project_declined: 'close-circle',
    project_created: 'folder',
    task_assigned: 'checkbox',
    task_completed: 'checkmark-done',
    task_overdue: 'alert-circle',
    invoice_sent: 'document-text',
    invoice_paid: 'card',
    invoice_overdue: 'alert-circle',
    new_booking: 'calendar',
    booking_new: 'calendar',
    booking_created: 'calendar',
    booking_confirmed: 'calendar-outline',
    booking_cancelled: 'calendar-clear',
    system: 'sparkles',
  };
  return map[type] || 'notifications';
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  triggered_by_name: string | null;
}

function getLocalizedTitle(
  n: NotificationItem,
  t: (key: string, opts?: any) => string,
): string {
  const name = n.triggered_by_name || '';

  switch (n.type) {
    case 'new_request':
    case 'request_new':
      return name
        ? t('notifications.type_new_request', { name })
        : t('notifications.type_new_request_no_name');

    case 'invoice_sent': {
      const m = n.title.match(/Invoice (.+) sent/);
      return m ? t('notifications.type_invoice_sent', { number: m[1] }) : n.title;
    }

    case 'invoice_paid':
      return t('notifications.type_invoice_paid');

    case 'invoice_overdue': {
      const m = n.title.match(/Invoice (.+) is overdue/);
      return m ? t('notifications.type_invoice_overdue', { number: m[1] }) : n.title;
    }

    case 'task_overdue': {
      const m = n.title.match(/Task overdue: (.+)/);
      return m ? t('notifications.type_task_overdue', { title: m[1] }) : n.title;
    }

    case 'project_approved':
      return t('notifications.type_project_approved');

    case 'project_declined':
      return t('notifications.type_project_declined');

    case 'new_booking':
    case 'booking_new':
    case 'booking_created':
      if (n.title.toLowerCase().includes('request')) {
        return name
          ? t('notifications.type_booking_request', { name })
          : n.title;
      }
      return name
        ? t('notifications.type_new_booking', { name })
        : t('notifications.type_new_booking_no_name');

    case 'booking_cancelled':
      return name
        ? t('notifications.type_booking_cancelled', { name })
        : t('notifications.type_booking_cancelled_no_name');

    case 'system':
      return t('notifications.type_system_ai');

    default:
      return n.title;
  }
}

function getLocalizedMessage(
  n: NotificationItem,
  t: (key: string, opts?: any) => string,
): string | null {
  if (!n.message) return null;
  const name = n.triggered_by_name || '';

  switch (n.type) {
    case 'new_request':
    case 'request_new': {
      // "{name} submitted a request for {service}" or "{name} submitted a new project request"
      const m = n.message.match(/submitted a request for (.+)/);
      if (m) return t('notifications.msg_request_submitted', { name, service: m[1] });
      if (n.message.includes('new project request'))
        return t('notifications.msg_request_submitted_generic', { name });
      return n.message;
    }

    case 'invoice_sent': {
      // "Invoice for ${total} sent to {name}"
      const m = n.message.match(/Invoice for \$?([\d,.]+) sent to (.+)/);
      return m ? t('notifications.msg_invoice_sent', { total: m[1], name: m[2] }) : n.message;
    }

    case 'invoice_paid': {
      // "{name} paid invoice {number} (${total})"
      const m = n.message.match(/(.+) paid invoice (.+?) \((.+)\)/);
      return m ? t('notifications.msg_invoice_paid', { name: m[1], number: m[2], total: m[3] }) : n.message;
    }

    case 'invoice_overdue': {
      // "${total} from {name} was due {date}"
      const m = n.message.match(/(\$?[\d,.]+) from (.+) was due (.+)/);
      return m ? t('notifications.msg_invoice_overdue', { total: m[1], name: m[2], date: m[3] }) : n.message;
    }

    case 'task_overdue': {
      // 'Task in "{project}" was due {date}' or 'Task was due {date}'
      const mp = n.message.match(/Task in "(.+)" was due (.+)/);
      if (mp) return t('notifications.msg_task_overdue', { project: mp[1], date: mp[2] });
      const md = n.message.match(/Task was due (.+)/);
      if (md) return t('notifications.msg_task_overdue_no_project', { date: md[1] });
      return n.message;
    }

    case 'project_approved': {
      // '{name} approved "{project}"'
      const m = n.message.match(/(.+) approved "(.+)"/);
      return m ? t('notifications.msg_project_approved', { name: m[1], project: m[2] }) : n.message;
    }

    case 'project_declined': {
      // '{name} declined "{project}": "{reason}"' or '{name} declined "{project}"'
      const mr = n.message.match(/(.+) declined "(.+?)": "(.+)"/);
      if (mr) return t('notifications.msg_project_declined_reason', { name: mr[1], project: mr[2], reason: mr[3] });
      const m = n.message.match(/(.+) declined "(.+)"/);
      return m ? t('notifications.msg_project_declined', { name: m[1], project: m[2] }) : n.message;
    }

    case 'new_booking':
    case 'booking_new':
    case 'booking_created': {
      // "{title} on {date}" or "Appointment on {date}"
      const m = n.message.match(/(.+) on (.+)/);
      return m ? t('notifications.msg_booking_on', { title: m[1], date: m[2] }) : n.message;
    }

    case 'booking_cancelled': {
      // "{service} on {date}"
      const m = n.message.match(/(.+) on (.+)/);
      return m ? t('notifications.msg_booking_cancelled', { service: m[1], date: m[2] }) : n.message;
    }

    case 'system': {
      // AI messages
      if (n.message.includes('draft project')) {
        const m = n.message.match(/from (.+?)(?:'s|'s) request/);
        return m ? t('notifications.msg_ai_draft_project', { name: m[1] }) : n.message;
      }
      if (n.message.includes('follow-up')) {
        const m = n.message.match(/analyzed (.+?)(?:'s|'s) request/);
        return m ? t('notifications.msg_ai_followup', { name: m[1] }) : n.message;
      }
      if (n.message.includes('analyzed')) {
        const m = n.message.match(/analyzed (.+?)(?:'s|'s) request/);
        return m ? t('notifications.msg_ai_analyzed', { name: m[1] }) : n.message;
      }
      return n.message;
    }

    default:
      return n.message;
  }
}

function getRelativeTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('notifications.justNow');
  if (diffMins < 60) return t('notifications.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('notifications.daysAgo', { count: diffDays });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getMobileRoute(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const routes: Record<string, string> = {
    request: `/(app)/request-detail?id=${entityId}`,
    booking: `/(app)/booking-detail?id=${entityId}`,
    project: `/(app)/project-detail?id=${entityId}`,
    client: `/(app)/client-detail?id=${entityId}`,
    invoice: '/(app)/invoices',
    task: '/(app)/tasks',
  };
  return routes[entityType] ?? null;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslations();
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    archiveAllRead,
  } = useNotifications();
  const isOffline = useOfflineStore((s) => !s.isOnline);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const readCount = notifications.filter((n) => n.is_read).length;

  const FILTERS = useMemo(() => [
    { key: 'all', label: t('notifications.all') },
    { key: 'unread', label: t('notifications.unread') },
  ], [t]);

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
    const route = getMobileRoute(notification.entity_type, notification.entity_id);
    if (route) {
      router.push(route as any);
    } else {
      showToast('info', t('notifications.noRoute'));
    }
  };

  const renderNotification = useCallback(({ item }: { item: typeof notifications[0] }) => {
    const iconName = getNotificationIcon(item.type);
    const localizedTitle = getLocalizedTitle(item as NotificationItem, t);
    const localizedMessage = getLocalizedMessage(item as NotificationItem, t);
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
            {localizedTitle}
          </Text>
          {localizedMessage && (
            <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
              {localizedMessage}
            </Text>
          )}
          <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
            {getRelativeTime(item.created_at, t)}
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
  }, [colors, t, handleNotificationPress, archiveNotification]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('notifications.title')}</Text>
        <View style={styles.headerActions}>
          {readCount > 0 && (
            <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={styles.markAllButton}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
          <View style={styles.filterRow}>
            <FilterChips
              options={FILTERS}
              selected={filter}
              onSelect={handleFilterChange}
            />
          </View>
        </Animated.View>

        <Animated.FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            filtered.length === 0 ? styles.emptyContainer : styles.list,
            { paddingTop: filterHeight },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={filter === 'unread' ? t('notifications.noUnread') : t('notifications.noNotifications')}
              description={filter === 'unread' ? t('notifications.noUnreadDesc') : t('notifications.noNotificationsDesc')}
              offline={isOffline && notifications.length === 0}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          renderItem={renderNotification}
        />
      </View>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('notifications.deleteReadTitle')}
        message={t('notifications.deleteReadMessage', { count: readCount })}
        confirmLabel={t('notifications.deleteReadConfirm')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await archiveAllRead();
          showToast('success', t('notifications.deleteReadSuccess'));
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
