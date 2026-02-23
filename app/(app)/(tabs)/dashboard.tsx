import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useTutorial } from '@/hooks/useTutorial';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { NotificationBell, CriticalAlertsCard, StatsSkeleton, ListSkeleton, StatusBadge, showToast } from '@/components';
import type { RequestWithClient, TaskWithProject, ProjectWithRelations } from '@/lib/database.types';

interface DashboardStats {
  totalClients: number;
  onboardedClients: number;
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingApprovals: number;
  tasksCompletedThisWeek: number;
}

interface RevenueData {
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  overdueRevenue: number;
}

interface UpcomingBooking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  client?: { name: string };
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  due_date: string | null;
  client: { name: string } | null;
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { t, locale } = useTranslations();
  useTutorial('dashboard');
  const router = useRouter();
  interface DashboardData {
    stats: DashboardStats;
    revenue: RevenueData;
    newRequests: RequestWithClient[];
    todayTasks: TaskWithProject[];
    upcomingDeadlines: ProjectWithRelations[];
    upcomingBookings: UpcomingBooking[];
    upcomingTasks: TaskWithProject[];
    recentInvoices: RecentInvoice[];
  }

  const defaultDashboard: DashboardData = {
    stats: { totalClients: 0, onboardedClients: 0, totalProjects: 0, activeProjects: 0, totalTasks: 0, completedTasks: 0, pendingApprovals: 0, tasksCompletedThisWeek: 0 },
    revenue: { totalRevenue: 0, paidRevenue: 0, outstandingRevenue: 0, overdueRevenue: 0 },
    newRequests: [], todayTasks: [], upcomingDeadlines: [], upcomingBookings: [], upcomingTasks: [], recentInvoices: [],
  };

  const { data: dashboardData, loading, refreshing, refresh } = useOfflineData<DashboardData>(
    'dashboard',
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const [
        clientsCountResult,
        onboardedClientsResult,
        projectsCountResult,
        activeProjectsResult,
        tasksCountResult,
        completedTasksResult,
        pendingApprovalsResult,
        requestsResult,
        todayTasksResult,
        deadlinesResult,
        invoicesResult,
        bookingsResult,
        weeklyCompletedResult,
        recentInvoicesResult,
        upcomingTasksResult,
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('id').eq('onboarded', true),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('id').eq('status', 'active'),
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('id').eq('status', 'completed'),
        supabase.from('projects').select('id').eq('approval_status', 'pending'),
        supabase
          .from('requests')
          .select('*, client:clients(name)')
          .in('status', ['new', 'reviewing'])
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('*, project:projects(id, name, client:clients(name))')
          .gte('due_date', today.toISOString())
          .lt('due_date', tomorrow.toISOString())
          .neq('status', 'completed')
          .limit(5),
        supabase
          .from('projects')
          .select('*, client:clients(name, email)')
          .gte('deadline', today.toISOString())
          .lte('deadline', nextWeek.toISOString())
          .eq('status', 'active')
          .order('deadline', { ascending: true })
          .limit(5),
        supabase.from('invoices').select('total, status, issue_date')
          .gte('issue_date', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
          .lt('issue_date', new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString()),
        supabase
          .from('bookings')
          .select('*, client:clients(name)')
          .eq('status', 'confirmed')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('updated_at', weekStart.toISOString()),
        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, due_date, client:clients(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('*, project:projects(id, name, client:clients(name))')
          .gt('due_date', tomorrow.toISOString())
          .lte('due_date', nextWeek.toISOString())
          .neq('status', 'completed')
          .order('due_date', { ascending: true })
          .limit(10),
      ]);

      const invoices = invoicesResult.data || [];
      const paidRevenue = invoices
        .filter((inv: any) => inv.status === 'paid')
        .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const outstandingRevenue = invoices
        .filter((inv: any) => inv.status === 'sent')
        .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const overdueRevenue = invoices
        .filter((inv: any) => inv.status === 'overdue')
        .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const totalRevenue = paidRevenue + outstandingRevenue + overdueRevenue;

      return {
        stats: {
          totalClients: clientsCountResult.count || 0,
          onboardedClients: onboardedClientsResult.data?.length || 0,
          totalProjects: projectsCountResult.count || 0,
          activeProjects: activeProjectsResult.data?.length || 0,
          totalTasks: tasksCountResult.count || 0,
          completedTasks: completedTasksResult.data?.length || 0,
          pendingApprovals: pendingApprovalsResult.data?.length || 0,
          tasksCompletedThisWeek: weeklyCompletedResult.count || 0,
        },
        revenue: { totalRevenue, paidRevenue, outstandingRevenue, overdueRevenue },
        newRequests: requestsResult.data || [],
        todayTasks: todayTasksResult.data || [],
        upcomingDeadlines: deadlinesResult.data || [],
        upcomingBookings: bookingsResult.data || [],
        upcomingTasks: (upcomingTasksResult.data as any) || [],
        recentInvoices: (recentInvoicesResult.data as any) || [],
      };
    },
    { maxAge: 60 * 60 * 1000 }, // 1 hour cache for dashboard (offline ignores TTL)
  );

  const { stats, revenue, newRequests, todayTasks, upcomingDeadlines, upcomingBookings, upcomingTasks, recentInvoices } = dashboardData ?? defaultDashboard;

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there';
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';

  const todayDate = new Date().toLocaleDateString(dateLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(dateLocale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [dateLocale]);

  const formatBookingTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(dateLocale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [dateLocale]);

  const getRelativeDay = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return t('time.today');
    if (diff === 1) return t('time.tomorrow');
    if (diff < 7) return date.toLocaleDateString(dateLocale, { weekday: 'long' });
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
  }, [t, dateLocale]);

  const formatShortDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(dateLocale, {
      month: 'short',
      day: 'numeric',
    });
  }, [dateLocale]);

  const formatTimeAgo = useCallback((dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return t('notifications.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('notifications.daysAgo', { count: diffDays });
  }, [t]);

  const priorityColors = useMemo(
    () => ({
      low: colors.priorityLow,
      medium: colors.priorityMedium,
      high: colors.priorityHigh,
    }),
    [colors]
  );

  // Split bookings into today vs later
  const { todayBookings, laterBookings } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayItems: UpcomingBooking[] = [];
    const laterItems: UpcomingBooking[] = [];
    for (const b of upcomingBookings) {
      const start = new Date(b.start_time);
      if (start >= todayStart && start < todayEnd) {
        todayItems.push(b);
      } else {
        laterItems.push(b);
      }
    }
    return { todayBookings: todayItems, laterBookings: laterItems };
  }, [upcomingBookings]);

  // Merge coming up items: bookings + deadlines + upcoming tasks, sorted by date
  const comingUpItems = useMemo(() => {
    const items: Array<{
      type: 'booking' | 'deadline' | 'task';
      id: string;
      title: string;
      subtitle: string;
      date: string;
      priority?: string;
      status?: string;
    }> = [];

    for (const b of laterBookings) {
      items.push({
        type: 'booking',
        id: b.id,
        title: b.title,
        subtitle: (b.client as any)?.name || t('dashboard.noClient'),
        date: b.start_time,
      });
    }

    for (const p of upcomingDeadlines) {
      items.push({
        type: 'deadline',
        id: p.id,
        title: p.name,
        subtitle: (p.client as any)?.name || t('dashboard.noClient'),
        date: p.deadline || '',
      });
    }

    for (const task of upcomingTasks) {
      items.push({
        type: 'task',
        id: task.id,
        title: task.title,
        subtitle: (task.project as any)?.name || t('dashboard.noProject'),
        date: task.due_date || '',
        priority: task.priority,
        status: task.status,
      });
    }

    return items
      .filter(item => item.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8);
  }, [laterBookings, upcomingDeadlines, upcomingTasks, t]);

  const invoiceStatusColors = useMemo(() => ({
    draft: { bg: colors.surfaceSecondary, text: colors.textSecondary },
    sent: { bg: colors.infoLight, text: colors.info },
    paid: { bg: colors.successLight, text: colors.success },
    overdue: { bg: colors.errorLight, text: colors.error },
  }), [colors]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: Spacing.lg }]}>
          <View>
            <View style={[styles.skeletonLine, { width: 120, backgroundColor: colors.surfaceSecondary }]} />
            <View style={[styles.skeletonLine, { width: 180, height: 28, backgroundColor: colors.surfaceSecondary, marginTop: 8 }]} />
          </View>
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <StatsSkeleton />
          <ListSkeleton count={3} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{t('dashboard.welcome')}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{userName}!</Text>
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>{todayDate}</Text>
          </View>
          <NotificationBell />
        </View>

        {/* Critical Alerts */}
        <CriticalAlertsCard />

        {/* Stats Grid - 2 rows of 3 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/invoices' as any)}
            >
              <Ionicons name="cash-outline" size={16} color={colors.success} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{formatCurrency(revenue.paidRevenue)}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.revenue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/clients' as any)}
            >
              <Ionicons name="people" size={16} color={colors.primary} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{stats.totalClients}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.clients')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/projects' as any)}
            >
              <Ionicons name="folder" size={16} color={colors.info} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{stats.activeProjects}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.projects')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/tasks' as any)}
            >
              <Ionicons name="checkbox" size={16} color={colors.warning} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{stats.totalTasks - stats.completedTasks}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.tasks')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(app)/(tabs)/jobs' as any)}
            >
              <Ionicons name="mail" size={16} color={colors.statusNew} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{newRequests.length}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.requests')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statsGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/(app)/projects', params: { filter: 'pending' } } as any)}
            >
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={[styles.statsStripValue, { color: colors.text }]}>{stats.pendingApprovals}</Text>
              <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]}>{t('dashboard.approvals')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="today" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.today')}</Text>
              {(todayTasks.length > 0 || todayBookings.length > 0) && (
                <View style={[styles.countChip, { backgroundColor: colors.infoLight }]}>
                  <Text style={[styles.countChipText, { color: colors.primary }]}>
                    {todayTasks.length + todayBookings.length}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {todayTasks.length === 0 && todayBookings.length === 0 ? (
            <View style={styles.todayEmpty}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={[styles.todayEmptyText, { color: colors.textSecondary }]}>{t('dashboard.nothingScheduled')}</Text>
            </View>
          ) : (
            <>
              {todayBookings.map((booking, idx) => (
                <TouchableOpacity
                  key={booking.id}
                  style={[
                    styles.listItem,
                    (idx < todayBookings.length - 1 || todayTasks.length > 0) && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                  ]}
                  onPress={() => router.push({ pathname: '/(app)/booking-detail', params: { id: booking.id } } as any)}
                >
                  <View style={[styles.listItemIcon, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="calendar" size={18} color={colors.success} />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>
                      {booking.title}
                    </Text>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                      {(booking.client as any)?.name || t('dashboard.noClient')} - {formatBookingTime(booking.start_time)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.successLight }]}>
                    <Text style={[styles.statusText, { color: colors.success }]}>{t('dashboard.booking')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {todayTasks.map((task, idx) => (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.listItem,
                    idx < todayTasks.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                  ]}
                  onPress={() => router.push({ pathname: '/(app)/tasks', params: { id: task.id } } as any)}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColors[task.priority as keyof typeof priorityColors] || colors.textTertiary },
                    ]}
                  />
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                      {(task.project as any)?.name || t('dashboard.noProject')}
                    </Text>
                  </View>
                  <StatusBadge status={task.status} />
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* Coming Up - merged bookings + deadlines + upcoming tasks */}
        {comingUpItems.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="arrow-forward-circle" size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.comingUp')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/calendar' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('dashboard.calendar')}</Text>
              </TouchableOpacity>
            </View>
            {comingUpItems.map((item, idx) => (
              <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[
                  styles.listItem,
                  idx < comingUpItems.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                ]}
                onPress={() => {
                  if (item.type === 'booking') router.push({ pathname: '/(app)/booking-detail', params: { id: item.id } } as any);
                  else if (item.type === 'deadline') router.push({ pathname: '/(app)/project-detail', params: { id: item.id } } as any);
                  else if (item.type === 'task') router.push({ pathname: '/(app)/tasks', params: { id: item.id } } as any);
                }}
              >
                {item.type === 'booking' && (
                  <View style={[styles.listItemIcon, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="calendar" size={18} color={colors.success} />
                  </View>
                )}
                {item.type === 'deadline' && (
                  <View style={[styles.listItemIcon, { backgroundColor: colors.errorLight }]}>
                    <Ionicons name="flag" size={18} color={colors.error} />
                  </View>
                )}
                {item.type === 'task' && (
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColors[item.priority as keyof typeof priorityColors] || colors.textTertiary },
                    ]}
                  />
                )}
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  {
                    backgroundColor: item.type === 'deadline' ? colors.errorLight
                      : item.type === 'booking' ? colors.warningLight
                      : colors.infoLight,
                  },
                ]}>
                  <Text style={[
                    styles.statusText,
                    {
                      color: item.type === 'deadline' ? colors.error
                        : item.type === 'booking' ? colors.warning
                        : colors.info,
                    },
                  ]}>
                    {getRelativeDay(item.date)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Weekly Progress */}
        <View style={[styles.weeklyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.weeklyHeader}>
            <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="trophy" size={18} color={colors.success} />
            </View>
            <View style={styles.weeklyContent}>
              <Text style={[styles.weeklyTitle, { color: colors.text }]}>{t('dashboard.thisWeek')}</Text>
              <Text style={[styles.weeklySubtitle, { color: colors.textSecondary }]}>
                {stats.tasksCompletedThisWeek === 1
                  ? t('dashboard.tasksCompleted', { count: stats.tasksCompletedThisWeek })
                  : t('dashboard.tasksCompletedPlural', { count: stats.tasksCompletedThisWeek })}
              </Text>
            </View>
            <Text style={[styles.weeklyCount, { color: colors.success }]}>{stats.tasksCompletedThisWeek}</Text>
          </View>
          {stats.totalTasks > 0 && (
            <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.success,
                    width: `${Math.min((stats.completedTasks / stats.totalTasks) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* New Requests */}
        {newRequests.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="mail" size={18} color={colors.statusNew} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.serviceRequests')}</Text>
                <View style={[styles.countChip, { backgroundColor: colors.statusNew + '20' }]}>
                  <Text style={[styles.countChipText, { color: colors.statusNew }]}>{newRequests.length}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/jobs' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            {newRequests.map((request, idx) => {
              const clientName = (request.client as any)?.name || (request as any).client_name || t('dashboard.noClient');
              const budget = (request as any).budget || (request as any).budget_range;
              const description = (request as any).description || (request as any).project_description;
              const timeAgo = request.created_at ? formatTimeAgo(request.created_at) : '';
              return (
                <TouchableOpacity
                  key={request.id}
                  style={[
                    styles.listItem,
                    idx < newRequests.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                  ]}
                  onPress={() => router.push({ pathname: '/(app)/request-detail', params: { id: request.id } } as any)}
                >
                  <View style={[styles.listItemIcon, { backgroundColor: colors.statusNew + '15' }]}>
                    <Ionicons name="mail-unread" size={18} color={colors.statusNew} />
                  </View>
                  <View style={[styles.listItemContent, { marginRight: Spacing.sm }]}>
                    <View style={styles.requestTitleRow}>
                      <Text style={[styles.listItemTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {request.title}
                      </Text>
                      {timeAgo ? (
                        <Text style={[styles.requestTimeAgo, { color: colors.textTertiary }]}>{timeAgo}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {clientName}{budget ? `  ·  ${budget}` : ''}
                    </Text>
                    {description ? (
                      <Text style={[styles.requestDescription, { color: colors.textTertiary }]} numberOfLines={1}>
                        {description}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge status={request.status} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Invoices */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="document-text" size={18} color={colors.info} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.recentInvoices')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/invoices' as any)}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          {recentInvoices.length === 0 ? (
            <View style={styles.todayEmpty}>
              <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.todayEmptyText, { color: colors.textSecondary }]}>{t('dashboard.noRecentInvoices')}</Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { borderColor: colors.primary }]}
                onPress={() => router.push({ pathname: '/(app)/invoices', params: { create: 'true' } } as any)}
              >
                <Text style={[styles.emptyActionText, { color: colors.primary }]}>{t('dashboard.createInvoice')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {recentInvoices.map((invoice, idx) => {
                const statusColor = invoiceStatusColors[invoice.status as keyof typeof invoiceStatusColors] || invoiceStatusColors.draft;
                return (
                  <TouchableOpacity
                    key={invoice.id}
                    style={[
                      styles.listItem,
                      idx < recentInvoices.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                    ]}
                    onPress={() => router.push({ pathname: '/(app)/invoices', params: { id: invoice.id } } as any)}
                  >
                    <View style={styles.listItemContent}>
                      <View style={styles.invoiceRow}>
                        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>
                          {invoice.invoice_number || `#${invoice.id.slice(0, 6)}`}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.statusText, { color: statusColor.text }]}>
                            {t(`status.${invoice.status}`)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.invoiceRow}>
                        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                          {(invoice.client as any)?.name || t('dashboard.noClient')}
                          {invoice.due_date && invoice.status !== 'paid' ? ` - ${t('dashboard.due')} ${formatShortDate(invoice.due_date)}` : ''}
                        </Text>
                        <Text style={[styles.invoiceAmount, { color: colors.text }]}>
                          {formatCurrency(invoice.total || 0)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* Revenue Summary Footer */}
              <View style={[styles.revenueSummary, { borderTopColor: colors.borderLight }]}>
                <View style={styles.revenueSummaryItem}>
                  <Text style={[styles.revenueSummaryLabel, { color: colors.textSecondary }]}>{t('dashboard.totalCollected')}</Text>
                  <Text style={[styles.revenueSummaryValue, { color: colors.success }]}>{formatCurrency(revenue.paidRevenue)}</Text>
                </View>
                <View style={styles.revenueSummaryItem}>
                  <Text style={[styles.revenueSummaryLabel, { color: colors.textSecondary }]}>{t('dashboard.outstanding')}</Text>
                  <Text style={[styles.revenueSummaryValue, { color: revenue.overdueRevenue > 0 ? colors.error : colors.info }]}>
                    {formatCurrency(revenue.outstandingRevenue + revenue.overdueRevenue)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Revenue Overview */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="wallet" size={18} color={colors.success} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.revenueOverview')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/invoices' as any)}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('dashboard.invoices')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.revenueRow}>
            <View style={[styles.revenueCard, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.revenueLabel, { color: colors.textTertiary }]}>{t('dashboard.paid')}</Text>
              <Text style={[styles.revenueValue, { color: colors.success }]}>
                {formatCurrency(revenue.paidRevenue)}
              </Text>
            </View>
            <View style={[styles.revenueCard, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.revenueLabel, { color: colors.textTertiary }]}>{t('dashboard.pending')}</Text>
              <Text style={[styles.revenueValue, { color: colors.warning }]}>
                {formatCurrency(revenue.outstandingRevenue)}
              </Text>
            </View>
            <View style={[styles.revenueCard, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.revenueLabel, { color: colors.textTertiary }]}>{t('dashboard.overdue')}</Text>
              <Text style={[styles.revenueValue, { color: colors.error }]}>
                {formatCurrency(revenue.overdueRevenue)}
              </Text>
            </View>
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
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSizes.md,
  },
  userName: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  // Stats Grid
  statsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statsGridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statsStripValue: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  statsStripLabel: {
    fontSize: 10,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  // Weekly Progress
  weeklyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  weeklyContent: {
    flex: 1,
  },
  weeklyTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  weeklySubtitle: {
    fontSize: FontSizes.sm,
  },
  weeklyCount: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Sections
  section: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  countChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 22,
    alignItems: 'center',
  },
  countChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  // Revenue
  revenueRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  revenueCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  revenueValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  // Today empty
  todayEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  todayEmptyText: {
    fontSize: FontSizes.sm,
  },
  emptyActionBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emptyActionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  // List Items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  listItemIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: FontSizes.sm,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  requestTimeAgo: {
    fontSize: FontSizes.xs,
    flexShrink: 0,
  },
  requestDescription: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Invoice-specific
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceAmount: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  revenueSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
  },
  revenueSummaryItem: {
    alignItems: 'center',
  },
  revenueSummaryLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  revenueSummaryValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  // Skeleton
  skeletonLine: {
    height: 16,
    borderRadius: 8,
  },
});
