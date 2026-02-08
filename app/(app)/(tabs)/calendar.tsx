import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { Badge, EmptyState } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import type { Task } from '@/lib/database.types';

interface BookingRow {
  id: string;
  user_id: string;
  client_id: string;
  property_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'task' | 'booking';
  date: string;
  time: string | null;
  status: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const taskStatusColors: Record<string, { bg: string; text: string }> = {
    todo: { bg: colors.surfaceSecondary, text: colors.textSecondary },
    in_progress: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
  };

  const bookingStatusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: colors.warningLight, text: colors.warning },
    confirmed: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const fetchData = useCallback(async () => {
    try {
      // Get the first and last day of the current month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59);
      const startStr = firstDay.toISOString();
      const endStr = lastDay.toISOString();

      // Fetch tasks with due_date in this month
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', startStr.split('T')[0])
        .lte('due_date', endStr.split('T')[0])
        .order('due_date', { ascending: true });

      if (taskError) throw taskError;
      setTasks((taskData as Task[]) ?? []);

      // Fetch bookings with start_time in this month
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .gte('start_time', startStr)
        .lte('start_time', endStr)
        .order('start_time', { ascending: true });

      if (bookingError) throw bookingError;
      setBookings((bookingData as BookingRow[]) ?? []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      Alert.alert('Error', 'Failed to load calendar data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = today.toISOString().split('T')[0];
    setSelectedDate(todayStr);
  };

  // Build event map: date string -> events
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    tasks.forEach((task) => {
      if (!task.due_date) return;
      const dateKey = task.due_date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push({
        id: task.id,
        title: task.title,
        type: 'task',
        date: dateKey,
        time: null,
        status: task.status,
      });
    });

    bookings.forEach((booking) => {
      const dateKey = booking.start_time.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      const time = new Date(booking.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      map[dateKey].push({
        id: booking.id,
        title: booking.title,
        type: 'booking',
        date: dateKey,
        time,
        status: booking.status,
      });
    });

    return map;
  }, [tasks, bookings]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const days: (number | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }

    // Trailing empty cells to complete the last week
    while (days.length % 7 !== 0) {
      days.push(null);
    }

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
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColors = (event: CalendarEvent) => {
    if (event.type === 'task') {
      return taskStatusColors[event.status] || taskStatusColors.todo;
    }
    return bookingStatusColors[event.status] || bookingStatusColors.pending;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Calendar</Text>
          <TouchableOpacity style={[styles.todayButton, { backgroundColor: colors.infoLight }]} onPress={goToToday}>
            <Text style={[styles.todayButtonText, { color: colors.primary }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={[styles.navArrow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
          <TouchableOpacity style={[styles.navArrow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week labels */}
        <View style={styles.weekRow}>
          {DAYS_OF_WEEK.map((day) => (
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
            const hasEvents = !!eventMap[dateKey] && eventMap[dateKey].length > 0;
            const hasTask = eventMap[dateKey]?.some((e) => e.type === 'task');
            const hasBooking = eventMap[dateKey]?.some((e) => e.type === 'booking');

            return (
              <TouchableOpacity
                key={dateKey}
                style={[
                  styles.dayCell,
                  isSelected && [styles.dayCellSelected, { backgroundColor: colors.infoLight }],
                ]}
                onPress={() => setSelectedDate(dateKey)}
              >
                <View
                  style={[
                    styles.dayNumber,
                    isToday && [styles.dayNumberToday, { backgroundColor: colors.primary }],
                    isSelected && !isToday && { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: colors.text },
                      isToday && styles.dayTextToday,
                      isSelected && !isToday && { color: colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {hasEvents && (
                  <View style={styles.dotsRow}>
                    {hasTask && (
                      <View
                        style={[styles.eventDot, { backgroundColor: colors.primary }]}
                      />
                    )}
                    {hasBooking && (
                      <View
                        style={[styles.eventDot, { backgroundColor: colors.success }]}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

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
                <Text style={[styles.noEventsText, { color: colors.textTertiary }]}>No events on this day</Text>
              </View>
            ) : (
              selectedEvents.map((event) => {
                const eventColors = getStatusColors(event);
                return (
                  <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View
                      style={[
                        styles.eventTypeIndicator,
                        {
                          backgroundColor:
                            event.type === 'task'
                              ? colors.primary
                              : colors.success,
                        },
                      ]}
                    />
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                          {event.title}
                        </Text>
                        <View style={[styles.eventStatusBadge, { backgroundColor: eventColors.bg }]}>
                          <Text style={[styles.eventStatusText, { color: eventColors.text }]}>
                            {event.status.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.eventMeta}>
                        <View style={styles.eventTypeTag}>
                          <Ionicons
                            name={event.type === 'task' ? 'checkbox-outline' : 'calendar-outline'}
                            size={12}
                            color={
                              event.type === 'task'
                                ? colors.primary
                                : colors.success
                            }
                          />
                          <Text
                            style={[
                              styles.eventTypeText,
                              {
                                color:
                                  event.type === 'task'
                                    ? colors.primary
                                    : colors.success,
                              },
                            ]}
                          >
                            {event.type === 'task' ? 'Task' : 'Booking'}
                          </Text>
                        </View>
                        {event.time && (
                          <View style={styles.eventTimeRow}>
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color={colors.textTertiary}
                            />
                            <Text style={[styles.eventTimeText, { color: colors.textTertiary }]}>{event.time}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {!selectedDate && (
          <View style={styles.hintContainer}>
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              Tap a day to see its events
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
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
  dayNumberToday: {
    // backgroundColor set via inline style
  },
  dayText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  dayTextToday: {
    color: '#fff',
    fontWeight: '700',
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
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  eventStatusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  hintContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  hintText: {
    fontSize: FontSizes.sm,
  },
});
