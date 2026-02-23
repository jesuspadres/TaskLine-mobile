import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { EmptyState, ListSkeleton } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useTutorial } from '@/hooks/useTutorial';

interface CalendarEvent {
  id: string;
  title: string;
  type: 'task' | 'booking' | 'deadline';
  date: string;
  time: string | null;
  endTime: string | null;
  status: string;
  clientName: string | null;
  projectName: string | null;
  priority: string | null;
}

type ViewMode = 'month' | 'list';

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { t, locale } = useTranslations();
  const router = useRouter();
  useTutorial('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().split('T')[0]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';

  const daysOfWeek = useMemo(
    () => [
      t('calendar.sun'),
      t('calendar.mon'),
      t('calendar.tue'),
      t('calendar.wed'),
      t('calendar.thu'),
      t('calendar.fri'),
      t('calendar.sat'),
    ],
    [t]
  );

  const taskStatusColors = useMemo(
    () => ({
      backlog: { bg: colors.surfaceSecondary, text: colors.textSecondary },
      pending: { bg: colors.warningLight, text: colors.warning },
      in_progress: { bg: colors.infoLight, text: colors.primary },
      completed: { bg: colors.successLight, text: colors.success },
    }),
    [colors]
  );

  const bookingStatusColors = useMemo(
    () => ({
      pending: { bg: colors.warningLight, text: colors.warning },
      confirmed: { bg: colors.infoLight, text: colors.primary },
      completed: { bg: colors.successLight, text: colors.success },
      cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
    }),
    [colors]
  );

  const eventTypeConfig = useMemo(
    () => ({
      task: { icon: 'checkbox-outline' as const, color: colors.primary, label: t('calendar.task') },
      booking: { icon: 'calendar-outline' as const, color: colors.success, label: t('calendar.booking') },
      deadline: { icon: 'flag-outline' as const, color: colors.accent, label: t('calendar.deadline') },
    }),
    [colors, t]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = currentDate.toLocaleDateString(dateLocale, {
    month: 'long',
    year: 'numeric',
  });

  const { data: calendarData, loading, refreshing, isOffline, refresh } = useOfflineData<CalendarEvent[]>(
    'calendar_events',
    async () => {
      const allEvents: CalendarEvent[] = [];

      // Fetch tasks with due dates
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, priority, projects(id, name)')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (taskError) throw taskError;

      (taskData ?? []).forEach((task: any) => {
        if (!task.due_date) return;
        const dateKey = task.due_date.split('T')[0];
        allEvents.push({
          id: task.id,
          title: task.title,
          type: 'task',
          date: dateKey,
          time: null,
          endTime: null,
          status: task.status as string,
          clientName: null,
          projectName: task.projects?.name ?? null,
          priority: task.priority as string | null,
        });
      });

      // Fetch project deadlines
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name, deadline, status, clients(name)')
        .not('deadline', 'is', null)
        .order('deadline', { ascending: true });

      if (projectError) throw projectError;

      (projectData ?? []).forEach((project: any) => {
        if (!project.deadline) return;
        const dateKey = project.deadline.split('T')[0];
        allEvents.push({
          id: `deadline-${project.id}`,
          title: project.name,
          type: 'deadline',
          date: dateKey,
          time: null,
          endTime: null,
          status: project.status as string,
          clientName: project.clients?.name ?? null,
          projectName: null,
          priority: null,
        });
      });

      // Fetch bookings
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, title, booking_date, start_time, end_time, status, client_name, clients(name)')
        .in('status', ['pending', 'confirmed'])
        .order('start_time', { ascending: true });

      if (bookingError) throw bookingError;

      (bookingData ?? []).forEach((booking: any) => {
        const rawDate = booking.booking_date || booking.start_time;
        if (!rawDate) return;
        const dateKey = rawDate.split('T')[0];
        const startTime = booking.start_time
          ? new Date(booking.start_time).toLocaleTimeString(dateLocale, {
              hour: 'numeric',
              minute: '2-digit',
            })
          : null;
        const endTime = booking.end_time
          ? new Date(booking.end_time).toLocaleTimeString(dateLocale, {
              hour: 'numeric',
              minute: '2-digit',
            })
          : null;

        allEvents.push({
          id: booking.id,
          title: booking.title,
          type: 'booking',
          date: dateKey,
          time: startTime,
          endTime,
          status: booking.status as string,
          clientName: booking.clients?.name ?? booking.client_name ?? null,
          projectName: null,
          priority: null,
        });
      });

      return allEvents;
    },
    { deps: [dateLocale] },
  );

  const events = calendarData ?? [];

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
    triggerHaptic();
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
    triggerHaptic();
  };

  const listRef = useRef<FlatList>(null);

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = today.toISOString().split('T')[0];
    setSelectedDate(todayStr);
    triggerHaptic();

    // In list view, scroll to today's section
    if (viewMode === 'list' && listRef.current) {
      const todayIndex = groupedUpcomingEvents.findIndex(g => g.date === todayStr);
      if (todayIndex >= 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0 });
        }, 100);
      } else {
        listRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  // Build event map for month view: date string -> events
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    return map;
  }, [events]);

  // Events for current month (month view)
  const monthEvents = useMemo(() => {
    const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
    const lastDayDate = new Date(year, month + 1, 0);
    const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDayDate.getDate().toString().padStart(2, '0')}`;
    return events.filter((e) => e.date >= firstDay && e.date <= lastDay);
  }, [events, year, month]);

  // Upcoming events for list view (from today onwards, sorted by date)
  const upcomingEvents = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return events
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });
  }, [events]);

  // Group upcoming events by date for list view
  const groupedUpcomingEvents = useMemo(() => {
    const groups: { date: string; label: string; events: CalendarEvent[] }[] = [];
    let currentGroup: (typeof groups)[0] | null = null;

    upcomingEvents.forEach((event) => {
      if (!currentGroup || currentGroup.date !== event.date) {
        const eventDate = new Date(event.date + 'T12:00:00');
        const label = eventDate.toLocaleDateString(dateLocale, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        currentGroup = { date: event.date, label, events: [] };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });

    return groups;
  }, [upcomingEvents, dateLocale]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    return days;
  }, [year, month]);

  const todayStr = new Date().toISOString().split('T')[0];

  const getDateKey = (day: number) => {
    const m = (month + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const selectedEvents = selectedDate ? (eventMap[selectedDate] || []) : [];

  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(dateLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusLabel = (event: CalendarEvent) => {
    const statusMap: Record<string, string> = {
      backlog: t('calendar.backlog'),
      pending: t('calendar.pending'),
      in_progress: t('calendar.inProgress'),
      completed: t('calendar.completed'),
      confirmed: t('calendar.confirmed'),
      cancelled: t('calendar.cancelled'),
    };
    return statusMap[event.status] || event.status.replace('_', ' ');
  };

  const getStatusColors = (event: CalendarEvent) => {
    if (event.type === 'task') {
      return (taskStatusColors as any)[event.status] || taskStatusColors.pending;
    }
    if (event.type === 'deadline') {
      if (event.status === 'completed') return taskStatusColors.completed;
      // Check if overdue
      if (event.date < todayStr) return { bg: colors.errorLight, text: colors.error };
      return { bg: colors.accentLight, text: colors.accent };
    }
    return (bookingStatusColors as any)[event.status] || bookingStatusColors.pending;
  };

  const handleEventPress = useCallback(
    (event: CalendarEvent) => {
      triggerHaptic();
      switch (event.type) {
        case 'task':
          router.push('/(app)/tasks' as any);
          break;
        case 'booking':
          router.push(`/(app)/booking-detail?id=${event.id}` as any);
          break;
        case 'deadline': {
          const projectId = event.id.replace('deadline-', '');
          router.push(`/(app)/project-detail?id=${projectId}` as any);
          break;
        }
      }
    },
    [router, triggerHaptic]
  );

  const renderEventCard = (event: CalendarEvent, showDate = false) => {
    const typeConfig = eventTypeConfig[event.type];
    const statusColors = getStatusColors(event);
    const isOverdue =
      event.type !== 'booking' &&
      event.status !== 'completed' &&
      event.date < todayStr;

    return (
      <TouchableOpacity
        key={event.id}
        style={[
          styles.eventCard,
          {
            backgroundColor: colors.surface,
            borderColor: isOverdue ? colors.error + '60' : colors.border,
          },
          isOverdue && { borderWidth: 1.5 },
        ]}
        onPress={() => handleEventPress(event)}
        activeOpacity={0.7}
      >
        <View style={[styles.eventTypeIndicator, { backgroundColor: typeConfig.color }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
              {event.title}
            </Text>
            <View style={[styles.eventStatusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.eventStatusText, { color: statusColors.text }]}>
                {getStatusLabel(event)}
              </Text>
            </View>
          </View>
          <View style={styles.eventMeta}>
            <View style={styles.eventTypeTag}>
              <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
              <Text style={[styles.eventTypeText, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
            {event.time && (
              <View style={styles.eventTimeRow}>
                <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                <Text style={[styles.eventTimeText, { color: colors.textTertiary }]}>
                  {event.time}
                  {event.endTime ? ` – ${event.endTime}` : ''}
                </Text>
              </View>
            )}
          </View>
          {(event.clientName || event.projectName || showDate) && (
            <View style={styles.eventSubMeta}>
              {event.projectName && (
                <View style={styles.eventMetaItem}>
                  <Ionicons name="folder-outline" size={11} color={colors.textTertiary} />
                  <Text style={[styles.eventMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {event.projectName}
                  </Text>
                </View>
              )}
              {event.clientName && (
                <View style={styles.eventMetaItem}>
                  <Ionicons name="person-outline" size={11} color={colors.textTertiary} />
                  <Text style={[styles.eventMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {event.clientName}
                  </Text>
                </View>
              )}
              {showDate && (
                <View style={styles.eventMetaItem}>
                  <Ionicons name="calendar-outline" size={11} color={colors.textTertiary} />
                  <Text style={[styles.eventMetaText, { color: colors.textTertiary }]}>
                    {new Date(event.date + 'T12:00:00').toLocaleDateString(dateLocale, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCalendarGroup = useCallback(({ item: group }: { item: typeof groupedUpcomingEvents[0] }) => (
    <View style={styles.listGroup}>
      <View style={styles.listDateHeader}>
        <Text
          style={[
            styles.listDateText,
            { color: colors.text },
            group.date === todayStr && { color: colors.primary },
          ]}
        >
          {group.label}
          {group.date === todayStr && ` — ${t('calendar.today')}`}
        </Text>
        <Text style={[styles.listDateCount, { color: colors.textTertiary }]}>
          {group.events.length}
        </Text>
      </View>
      {group.events.map((event) => renderEventCard(event))}
    </View>
  ), [colors, t, todayStr, renderEventCard]);

  // Legend
  const renderLegend = () => (
    <View style={[styles.legendRow, { borderTopColor: colors.border }]}>
      {(['task', 'booking', 'deadline'] as const).map((type) => {
        const config = eventTypeConfig[type];
        return (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: config.color }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              {config.label}
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('calendar.title')}</Text>
        </View>
        <ListSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('calendar.title')}</Text>
        <View style={styles.headerRight}>
          {/* View Toggle */}
          <View style={[styles.viewToggle, { backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMode === 'month' && { backgroundColor: colors.primary },
              ]}
              onPress={() => { setViewMode('month'); triggerHaptic(); }}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={viewMode === 'month' ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.viewToggleLabel, { color: viewMode === 'month' ? '#fff' : colors.textSecondary }]}>
                {t('calendar.monthView')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMode === 'list' && { backgroundColor: colors.primary },
              ]}
              onPress={() => { setViewMode('list'); triggerHaptic(); }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'list' ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.viewToggleLabel, { color: viewMode === 'list' ? '#fff' : colors.textSecondary }]}>
                {t('calendar.listView')}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Today Button */}
          <TouchableOpacity
            style={[styles.todayButton, { backgroundColor: colors.infoLight }]}
            onPress={goToToday}
          >
            <Text style={[styles.todayButtonText, { color: colors.primary }]}>
              {t('calendar.today')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'month' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
        >
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.navArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={goToPreviousMonth}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
            <TouchableOpacity
              style={[styles.navArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={goToNextMonth}
            >
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week labels */}
          <View style={styles.weekRow}>
            {daysOfWeek.map((day) => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={[styles.weekDayText, { color: colors.textTertiary }]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const dateKey = getDateKey(day);
              const isToday = dateKey === todayStr;
              const isSelected = dateKey === selectedDate;
              const dayEvents = eventMap[dateKey] || [];
              const hasTask = dayEvents.some((e) => e.type === 'task');
              const hasBooking = dayEvents.some((e) => e.type === 'booking');
              const hasDeadline = dayEvents.some((e) => e.type === 'deadline');
              const isPast = dateKey < todayStr;

              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.dayCell,
                    isSelected && [styles.dayCellSelected, { backgroundColor: colors.infoLight }],
                  ]}
                  onPress={() => {
                    setSelectedDate(dateKey);
                    triggerHaptic();
                  }}
                >
                  <View
                    style={[
                      styles.dayNumber,
                      isToday && { backgroundColor: colors.primary },
                      isSelected && !isToday && { backgroundColor: colors.primary + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.text },
                        isPast && !isToday && !isSelected && { opacity: 0.5 },
                        isToday && { color: '#fff', fontWeight: '700' },
                        isSelected && !isToday && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {dayEvents.length > 0 && (
                    <View style={styles.dotsRow}>
                      {hasTask && (
                        <View style={[styles.eventDot, { backgroundColor: eventTypeConfig.task.color }]} />
                      )}
                      {hasBooking && (
                        <View style={[styles.eventDot, { backgroundColor: eventTypeConfig.booking.color }]} />
                      )}
                      {hasDeadline && (
                        <View style={[styles.eventDot, { backgroundColor: eventTypeConfig.deadline.color }]} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          {renderLegend()}

          {/* Selected Day Events */}
          {selectedDate && (
            <View style={styles.eventsSection}>
              <Text style={[styles.eventsSectionTitle, { color: colors.text }]}>
                {formatSelectedDate(selectedDate)}
              </Text>

              {selectedEvents.length === 0 ? (
                <View style={styles.noEventsContainer}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={32}
                    color={colors.textTertiary}
                  />
                  <Text style={[styles.noEventsText, { color: colors.textTertiary }]}>
                    {t('calendar.noEvents')}
                  </Text>
                </View>
              ) : (
                selectedEvents.map((event) => renderEventCard(event))
              )}
            </View>
          )}

          {!selectedDate && (
            <View style={styles.hintContainer}>
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                {t('calendar.noEventsHint')}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* List View */
        <FlatList
          ref={listRef}
          data={groupedUpcomingEvents}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={t('calendar.noUpcoming')}
              description={t('calendar.noUpcomingDesc')}
              offline={isOffline && !(calendarData ?? []).length}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          renderItem={renderCalendarGroup}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 300);
          }}
        />
      )}
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
  listContent: {
    paddingBottom: Spacing['4xl'],
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  viewToggleLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  todayButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  navArrow: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  monthLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weekDayText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    minHeight: 48,
  },
  dayCellSelected: {
    borderRadius: BorderRadius.md,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  eventsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  eventsSectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  noEventsText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
  },
  eventCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventTypeIndicator: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  eventTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  eventStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  eventStatusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  eventTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eventTypeText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eventTimeText: {
    fontSize: FontSizes.xs,
  },
  eventSubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eventMetaText: {
    fontSize: FontSizes.xs,
    maxWidth: 120,
  },
  hintContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  hintText: {
    fontSize: FontSizes.sm,
  },
  listGroup: {
    marginBottom: Spacing.lg,
  },
  listDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  listDateText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  listDateCount: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
});
