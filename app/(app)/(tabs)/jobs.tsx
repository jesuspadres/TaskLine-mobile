import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Share,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { ENV } from '@/lib/env';
import {
  Modal, EmptyState, FilterChips, SearchBar, ListSkeleton,
  ConfirmDialog, Button, showToast,
} from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';

// --- Types ---
// Extended request type that includes fields the website uses but mobile generated types may not have
interface RequestRow {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description: string | null;
  budget: string | null;
  budget_range: string | null;
  deadline: string | null;
  timeline: string | null;
  status: string;
  files: string[] | null;
  project_description: string | null;
  address_formatted: string | null;
  address_lat: number | null;
  address_lng: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  service_type_id: string | null;
  created_at: string;
  updated_at: string;
}
type RequestWithClient = RequestRow & { client?: { id: string; name: string; email: string } };

interface BookingRow {
  id: string;
  user_id: string;
  client_id: string;
  property_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  booking_date: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  address_formatted: string | null;
  address_lat: number | null;
  address_lng: number | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

type BookingWithClient = BookingRow & {
  client?: { id: string; name: string; email: string };
};
type Segment = 'requests' | 'bookings';

export default function JobsScreen() {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { t, locale } = useTranslations();
  const router = useRouter();
  const haptics = useHaptics();
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();

  // --- Segment ---
  const [segment, setSegment] = useState<Segment>('requests');

  // --- Requests state ---
  const { data: requests, loading: requestsLoading, refreshing: requestsRefreshing, refresh: refreshRequests } = useOfflineData<RequestWithClient[]>(
    'requests',
    async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*, client:clients(id, name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  );
  const [requestFilterStatus, setRequestFilterStatus] = useState<string>('new');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestSort, setRequestSort] = useState('oldest');
  const [showRequestSortModal, setShowRequestSortModal] = useState(false);

  // --- Bookings state ---
  const { data: bookings, loading: bookingsLoading, refreshing: bookingsRefreshing, refresh: refreshBookings } = useOfflineData<BookingWithClient[]>(
    'bookings',
    async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, client:clients(id, name, email)')
        .order('start_time', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  );
  const { mutate } = useOfflineMutation();
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('pending');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingSort, setBookingSort] = useState('oldest');
  const [showBookingSortModal, setShowBookingSortModal] = useState(false);

  // --- Confirm dialogs ---
  const [convertConfirmVisible, setConvertConfirmVisible] = useState(false);
  const [convertTarget, setConvertTarget] = useState<RequestWithClient | null>(null);

  // ================================================================
  // i18n-safe options (useMemo)
  // ================================================================
  const requestFilterOptions = useMemo(() => [
    { key: 'new', label: t('requests.new') },
    { key: 'reviewing', label: t('requests.reviewing') },
    { key: 'accepted', label: t('requests.accepted') },
    { key: 'declined', label: t('requests.declined') },
    { key: 'all', label: t('requests.all') },
  ], [t]);

  const requestSortOptions = useMemo(() => [
    { key: 'oldest', label: t('requests.oldest') },
    { key: 'newest', label: t('requests.newest') },
    { key: 'nameAZ', label: t('requests.nameAZ') },
    { key: 'nameZA', label: t('requests.nameZA') },
  ], [t]);

  const bookingFilterOptions = useMemo(() => [
    { key: 'pending', label: t('bookings.pending') },
    { key: 'confirmed', label: t('bookings.confirmed') },
    { key: 'completed', label: t('bookings.completed') },
    { key: 'cancelled', label: t('bookings.cancelled') },
    { key: 'all', label: t('bookings.all') },
  ], [t]);

  const bookingSortOptions = useMemo(() => [
    { key: 'oldest', label: t('bookings.oldest') },
    { key: 'newest', label: t('bookings.newest') },
    { key: 'soonest', label: t('bookings.soonest') },
    { key: 'latest', label: t('bookings.latest') },
  ], [t]);

  // ================================================================
  // Status color maps (useMemo)
  // ================================================================
  const requestStatusColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    accepted: { bg: colors.successLight, text: colors.success },
    converted: { bg: colors.successLight, text: colors.success },
    declined: { bg: colors.surfaceSecondary, text: colors.textTertiary },
    archived: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  const bookingStatusColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    pending: { bg: colors.warningLight, text: colors.warning },
    confirmed: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  // ================================================================
  // Computed: filtered/sorted/searched data
  // ================================================================
  const filteredRequests = useMemo(() => {
    let result = (requests ?? []);
    if (requestFilterStatus !== 'all') {
      result = result.filter(r => r.status === requestFilterStatus);
    }
    if (requestSearch.trim()) {
      const q = requestSearch.toLowerCase();
      result = result.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.client?.name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.project_description?.toLowerCase().includes(q) ||
        r.budget?.toLowerCase().includes(q) ||
        r.budget_range?.toLowerCase().includes(q) ||
        r.address_formatted?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      switch (requestSort) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'nameAZ': return ((a.client?.name || a.name || a.title) || '').localeCompare((b.client?.name || b.name || b.title) || '');
        case 'nameZA': return ((b.client?.name || b.name || b.title) || '').localeCompare((a.client?.name || a.name || a.title) || '');
        default: return 0;
      }
    });
  }, [requests, requestFilterStatus, requestSearch, requestSort]);

  const filteredBookings = useMemo(() => {
    let result = (bookings ?? []);
    if (bookingFilterStatus !== 'all') {
      result = result.filter(b => b.status === bookingFilterStatus);
    }
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      result = result.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.client?.name?.toLowerCase().includes(q) ||
        b.client_name?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.address_formatted?.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      switch (bookingSort) {
        case 'soonest': return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        case 'latest': return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return 0;
      }
    });
  }, [bookings, bookingFilterStatus, bookingSearch, bookingSort]);

  // Request stats
  const requestStats = useMemo(() => ({
    new: (requests ?? []).filter(r => r.status === 'new').length,
    reviewing: (requests ?? []).filter(r => r.status === 'reviewing').length,
    accepted: (requests ?? []).filter(r => r.status === 'accepted' || r.status === 'converted').length,
    declined: (requests ?? []).filter(r => r.status === 'declined').length,
  }), [requests]);

  // Booking stats
  const bookingStats = useMemo(() => ({
    pending: (bookings ?? []).filter(b => b.status === 'pending').length,
    confirmed: (bookings ?? []).filter(b => b.status === 'confirmed').length,
    completed: (bookings ?? []).filter(b => b.status === 'completed').length,
    cancelled: (bookings ?? []).filter(b => b.status === 'cancelled').length,
  }), [bookings]);

  // ================================================================
  // Date formatting (locale-aware)
  // ================================================================
  const formatRequestDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('time.today');
    if (diffDays === 1) return t('time.yesterday');
    if (diffDays < 7) return t('requests.daysAgo', { count: diffDays });
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
  }, [t, dateLocale]);

  const formatTimeRange = useCallback((start: string, end: string) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
    const dateStr = startDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
    const startTime = startDate.toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit' });
    return `${dateStr} \u00B7 ${startTime} - ${endTime}`;
  }, [dateLocale]);

  const getStatusLabel = useCallback((status: string) => {
    const key = `status.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status.charAt(0).toUpperCase() + status.slice(1);
  }, [t]);

  // ================================================================
  // FETCH (handled by useOfflineData hooks above)
  // ================================================================

  // ================================================================
  // NAVIGATION
  // ================================================================
  const navigateToRequestDetail = (request: RequestWithClient) => {
    router.push(`/(app)/request-detail?id=${request.id}` as any);
  };

  const navigateToQRSettings = () => {
    router.push('/(app)/qr-settings' as any);
  };

  // ================================================================
  // ACTIONS: Requests
  // ================================================================
  const handleQuickStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await mutate({ table: 'requests', operation: 'update', data: { status: newStatus }, matchValue: requestId, cacheKeys: ['requests'] });
      if (error) throw error;
      haptics.impact();
      refreshRequests();
      showToast('success', t('requests.requestUpdated'));
    } catch (error) {
      secureLog.error('Error updating request status:', error);
      showToast('error', t('requests.updateError'));
    }
  };

  const handleConvertToProject = (request: RequestWithClient) => {
    setConvertTarget(request);
    setConvertConfirmVisible(true);
  };

  const handleConvertConfirm = async () => {
    if (!convertTarget || !user) return;
    setConvertConfirmVisible(false);
    try {
      const { error: projectError } = await supabase.from('projects').insert({
        name: convertTarget.title,
        description: convertTarget.description || convertTarget.project_description || null,
        client_id: convertTarget.client_id,
        status: 'active',
        user_id: user.id,
      });
      if (projectError) throw projectError;

      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: 'accepted' } as any)
        .eq('id', convertTarget.id);
      if (updateError) throw updateError;

      haptics.notification(Haptics.NotificationFeedbackType.Success);
      refreshRequests();
      showToast('success', t('requests.convertSuccess'));
    } catch (error) {
      secureLog.error('Error converting request:', error);
      showToast('error', t('requests.convertError'));
    }
    setConvertTarget(null);
  };

  const handleShareLink = async () => {
    const requestLink = `${ENV.APP_URL}/request/${user?.id}`;
    try {
      await Share.share({
        message: requestLink,
        title: t('requests.shareLink'),
      });
    } catch (_) { /* user cancelled */ }
  };

  const handleShareBookingLink = async () => {
    const bookingLink = `${ENV.APP_URL}/portal/${user?.id}`;
    try {
      await Share.share({
        message: bookingLink,
        title: t('bookings.title'),
      });
    } catch (_) { /* user cancelled */ }
  };

  // ================================================================
  // ACTIONS: Bookings
  // ================================================================
  const handleQuickConfirm = async (booking: BookingWithClient) => {
    try {
      const { error } = await mutate({ table: 'bookings', operation: 'update', data: { status: 'confirmed' }, matchValue: booking.id, cacheKeys: ['bookings'] });
      if (error) throw error;
      haptics.impact();
      refreshBookings();
      showToast('success', t('bookings.quickConfirmed'));
    } catch (error: any) {
      secureLog.error('Error confirming booking:', error);
      showToast('error', t('bookings.confirmError'));
    }
  };

  const handleQuickComplete = async (booking: BookingWithClient) => {
    try {
      const { error } = await mutate({ table: 'bookings', operation: 'update', data: { status: 'completed' }, matchValue: booking.id, cacheKeys: ['bookings'] });
      if (error) throw error;
      haptics.impact();
      refreshBookings();
      showToast('success', t('bookings.quickCompleted'));
    } catch (error: any) {
      secureLog.error('Error completing booking:', error);
      showToast('error', t('bookings.completeError'));
    }
  };

  // ================================================================
  // REFRESH
  // ================================================================
  const onRequestsRefresh = useCallback(() => {
    refreshRequests();
  }, [refreshRequests]);

  const onBookingsRefresh = useCallback(() => {
    refreshBookings();
  }, [refreshBookings]);

  // ================================================================
  // Open location in maps
  // ================================================================
  const openInMaps = (address: string, lat?: number | null, lng?: number | null) => {
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    }
  };

  // ================================================================
  // RENDER: Request card
  // ================================================================
  const renderRequest = useCallback(({ item }: { item: RequestWithClient }) => {
    const status = item.status;
    const itemColors = requestStatusColors[status] || requestStatusColors.new;
    const clientName = item.client?.name || item.name || t('requests.unknown');
    const desc = item.project_description || item.description;
    const budget = item.budget_range || item.budget;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigateToRequestDetail(item)}
        activeOpacity={0.7}
      >
        {/* Header: status + date */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
            <Text style={[styles.statusText, { color: itemColors.text }]}>
              {getStatusLabel(status)}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textTertiary }]}>
            {formatRequestDate(item.created_at)}
          </Text>
        </View>

        {/* Client name */}
        <View style={styles.clientRow}>
          <View style={[styles.clientAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.clientAvatarText}>
              {clientName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
            {clientName}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Description */}
        {desc ? (
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {desc}
          </Text>
        ) : null}

        {/* Location */}
        {item.address_formatted ? (
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => openInMaps(item.address_formatted!, item.address_lat, item.address_lng)}
          >
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]} numberOfLines={1}>
              {item.address_formatted}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Budget + Deadline row */}
        <View style={styles.metaRow}>
          {budget ? (
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{budget}</Text>
            </View>
          ) : null}
          {(item.deadline || item.timeline) ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.deadline
                  ? new Date(item.deadline).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
                  : item.timeline}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Quick Actions - based on status, matching website */}
        {(status === 'new' || status === 'reviewing') && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            {status === 'new' && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => handleQuickStatusUpdate(item.id, 'reviewing')}
              >
                <Ionicons name="eye-outline" size={16} color={colors.warning} />
                <Text style={[styles.quickActionText, { color: colors.warning }]}>
                  {t('requests.review')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleConvertToProject(item)}
            >
              <Ionicons name="folder-outline" size={16} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>
                {t('requests.createProposal')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleQuickStatusUpdate(item.id, 'accepted')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>
                {t('requests.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleQuickStatusUpdate(item.id, 'declined')}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.quickActionText, { color: colors.error }]}>
                {t('requests.decline')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Accepted requests - archive + create project */}
        {status === 'accepted' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleConvertToProject(item)}
            >
              <Ionicons name="folder-outline" size={16} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>
                {t('requests.convertToProject')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleQuickStatusUpdate(item.id, 'archived')}
            >
              <Ionicons name="archive-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.quickActionText, { color: colors.textTertiary }]}>
                {t('requests.archived')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [colors, t, requestStatusColors, navigateToRequestDetail, formatRequestDate, getStatusLabel, handleQuickStatusUpdate, handleConvertToProject, openInMaps, dateLocale]);

  // ================================================================
  // RENDER: Booking card
  // ================================================================
  const renderBooking = useCallback(({ item }: { item: BookingWithClient }) => {
    const itemColors = bookingStatusColors[item.status] || bookingStatusColors.pending;
    const clientName = item.client?.name || item.client_name || t('bookings.noClient');
    const isPast = item.status === 'confirmed' && new Date(item.end_time || item.start_time) < new Date();

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isPast && { borderColor: colors.warning, borderWidth: 2 },
        ]}
        onPress={() => router.push(`/(app)/booking-detail?id=${item.id}` as any)}
        activeOpacity={0.7}
      >
        {/* Header: status + date */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
            <Text style={[styles.statusText, { color: itemColors.text }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textTertiary }]}>
            {formatRequestDate(item.created_at)}
          </Text>
        </View>

        {/* Client name */}
        <View style={styles.clientRow}>
          <View style={[styles.clientAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.clientAvatarText}>
              {clientName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
            {clientName}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>

        {/* Time */}
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatTimeRange(item.start_time, item.end_time)}
          </Text>
        </View>

        {/* Description */}
        {item.description ? (
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Location */}
        {item.address_formatted ? (
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => openInMaps(item.address_formatted!, item.address_lat, item.address_lng)}
          >
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]} numberOfLines={1}>
              {item.address_formatted}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Notes */}
        {item.notes ? (
          <Text style={[styles.notesText, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}

        {/* Quick Actions */}
        {item.status === 'pending' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleQuickConfirm(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>
                {t('common.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isPast && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleQuickComplete(item)}
            >
              <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>
                {t('bookings.completed')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [colors, t, bookingStatusColors, router, formatRequestDate, formatTimeRange, getStatusLabel, handleQuickConfirm, handleQuickComplete, openInMaps, dateLocale]);

  // ================================================================
  // RENDER: Share / QR header actions
  // ================================================================
  const renderShareActions = () => (
    <View style={styles.headerButtons}>
      <TouchableOpacity
        style={[styles.headerActionButton, { backgroundColor: colors.infoLight }]}
        onPress={segment === 'requests' ? handleShareLink : handleShareBookingLink}
      >
        <Ionicons name="share-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerActionButton, { backgroundColor: colors.infoLight }]}
        onPress={navigateToQRSettings}
      >
        <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  // ================================================================
  // LOADING STATE
  // ================================================================
  const isLoading = segment === 'requests' ? requestsLoading : bookingsLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('jobs.title')}</Text>
        </View>
        <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.segmentButton, segment === 'requests' && { backgroundColor: colors.primary }]}
            onPress={() => setSegment('requests')}
          >
            <Ionicons name="mail-outline" size={16} color={segment === 'requests' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.segmentText, { color: segment === 'requests' ? '#fff' : colors.textSecondary }]}>
              {t('jobs.requests')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, segment === 'bookings' && { backgroundColor: colors.primary }]}
            onPress={() => setSegment('bookings')}
          >
            <Ionicons name="calendar-outline" size={16} color={segment === 'bookings' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.segmentText, { color: segment === 'bookings' ? '#fff' : colors.textSecondary }]}>
              {t('jobs.bookings')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ListSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  // ================================================================
  // MAIN RENDER
  // ================================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t('jobs.title')}</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countBadgeText}>
              {segment === 'requests' ? filteredRequests.length : filteredBookings.length}
            </Text>
          </View>
        </View>
        {renderShareActions()}
      </View>

      {/* Segment Control */}
      <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'requests' && { backgroundColor: colors.primary }]}
          onPress={() => { haptics.selection(); setSegment('requests'); }}
        >
          <Ionicons name="mail-outline" size={16} color={segment === 'requests' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.segmentText, { color: segment === 'requests' ? '#fff' : colors.textSecondary }]}>
            {t('jobs.requests')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'bookings' && { backgroundColor: colors.primary }]}
          onPress={() => { haptics.selection(); setSegment('bookings'); }}
        >
          <Ionicons name="calendar-outline" size={16} color={segment === 'bookings' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.segmentText, { color: segment === 'bookings' ? '#fff' : colors.textSecondary }]}>
            {t('jobs.bookings')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================ */}
      {/* REQUESTS SEGMENT */}
      {/* ============================================================ */}
      {segment === 'requests' && (
        <>
          {/* Request Stats */}
          <View style={styles.statsContainer}>
            {([
              { key: 'new' as const, icon: 'mail-unread-outline' as const, color: colors.statusNew },
              { key: 'reviewing' as const, icon: 'eye-outline' as const, color: colors.warning },
              { key: 'accepted' as const, icon: 'checkmark-circle-outline' as const, color: colors.success },
              { key: 'declined' as const, icon: 'close-circle-outline' as const, color: colors.textTertiary },
            ]).map((stat) => (
              <TouchableOpacity
                key={stat.key}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  requestFilterStatus === stat.key && { borderColor: stat.color, borderWidth: 2 },
                ]}
                onPress={() => setRequestFilterStatus(
                  requestFilterStatus === stat.key ? 'all' : stat.key
                )}
              >
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {requestStats[stat.key]}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                  {getStatusLabel(stat.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search + Sort + Filter Chips + Request List */}
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
              <View style={styles.searchRow}>
                <SearchBar
                  value={requestSearch}
                  onChangeText={setRequestSearch}
                  placeholder={t('requests.searchPlaceholder')}
                  style={styles.searchBarFlex}
                />
                <TouchableOpacity
                  style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setShowRequestSortModal(true)}
                >
                  <Ionicons name="swap-vertical" size={20} color={colors.textSecondary} />
                  {requestSort !== 'oldest' && (
                    <View style={[styles.sortBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.sortBadgeText}>1</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.filterContainer}>
                <FilterChips
                  options={requestFilterOptions}
                  selected={requestFilterStatus}
                  onSelect={(value) => setRequestFilterStatus(value)}
                  scrollable
                />
              </View>
            </Animated.View>

            <Animated.FlatList
              data={filteredRequests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.listContent, { paddingTop: filterHeight }]}
              onScroll={onScroll}
              scrollEventThrottle={16}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
              refreshControl={
                <RefreshControl refreshing={requestsRefreshing} onRefresh={onRequestsRefresh} />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="mail-outline"
                  title={requestSearch || requestFilterStatus !== 'all'
                    ? t('requests.noResults')
                    : t('requests.noRequests')}
                  description={requestSearch || requestFilterStatus !== 'all'
                    ? t('requests.tryDifferentSearch')
                    : t('requests.noRequestsShareDesc')}
                  actionLabel={!requestSearch && requestFilterStatus === 'all' ? t('requests.sharePortal') : undefined}
                  onAction={!requestSearch && requestFilterStatus === 'all' ? handleShareLink : undefined}
                />
              }
            />
          </View>
        </>
      )}

      {/* ============================================================ */}
      {/* BOOKINGS SEGMENT */}
      {/* ============================================================ */}
      {segment === 'bookings' && (
        <>
          {/* Booking Stats */}
          <View style={styles.statsContainer}>
            {([
              { key: 'pending' as const, icon: 'hourglass-outline' as const, color: colors.warning },
              { key: 'confirmed' as const, icon: 'checkmark-circle-outline' as const, color: colors.primary },
              { key: 'completed' as const, icon: 'checkmark-done-outline' as const, color: colors.success },
              { key: 'cancelled' as const, icon: 'close-circle-outline' as const, color: colors.textTertiary },
            ]).map((stat) => (
              <TouchableOpacity
                key={stat.key}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  bookingFilterStatus === stat.key && { borderColor: stat.color, borderWidth: 2 },
                ]}
                onPress={() => setBookingFilterStatus(
                  bookingFilterStatus === stat.key ? 'all' : stat.key
                )}
              >
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {bookingStats[stat.key]}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                  {getStatusLabel(stat.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search + Sort + Filter Chips + Booking List */}
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
              <View style={styles.searchRow}>
                <SearchBar
                  value={bookingSearch}
                  onChangeText={setBookingSearch}
                  placeholder={t('bookings.searchPlaceholder')}
                  style={styles.searchBarFlex}
                />
                <TouchableOpacity
                  style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setShowBookingSortModal(true)}
                >
                  <Ionicons name="swap-vertical" size={20} color={colors.textSecondary} />
                  {bookingSort !== 'oldest' && (
                    <View style={[styles.sortBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.sortBadgeText}>1</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.filterContainer}>
                <FilterChips
                  options={bookingFilterOptions}
                  selected={bookingFilterStatus}
                  onSelect={(value) => setBookingFilterStatus(value)}
                  scrollable
                />
              </View>
            </Animated.View>

            <Animated.FlatList
              data={filteredBookings}
              renderItem={renderBooking}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.listContent, { paddingTop: filterHeight }]}
              onScroll={onScroll}
              scrollEventThrottle={16}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
              refreshControl={
                <RefreshControl refreshing={bookingsRefreshing} onRefresh={onBookingsRefresh} />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="calendar-outline"
                  title={bookingSearch || bookingFilterStatus !== 'all'
                    ? t('bookings.noResults')
                    : t('bookings.noBookings')}
                  description={bookingSearch || bookingFilterStatus !== 'all'
                    ? t('bookings.tryDifferentSearch')
                    : t('requests.noBookingsShareDesc')}
                  actionLabel={!bookingSearch && bookingFilterStatus === 'all' ? t('requests.sharePortal') : undefined}
                  onAction={!bookingSearch && bookingFilterStatus === 'all' ? handleShareBookingLink : undefined}
              />
            }
          />
          </View>
        </>
      )}

      {/* ============================================================ */}
      {/* SORT MODALS */}
      {/* ============================================================ */}

      {/* Request Sort Modal */}
      <Modal
        visible={showRequestSortModal}
        onClose={() => setShowRequestSortModal(false)}
        title={t('requests.sortBy')}
      >
        {requestSortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortOption,
              { borderBottomColor: colors.border },
              requestSort === option.key && { backgroundColor: colors.primaryLight || colors.infoLight },
            ]}
            onPress={() => {
              setRequestSort(option.key);
              setShowRequestSortModal(false);
              haptics.selection();
            }}
          >
            <Text style={[
              styles.sortOptionText,
              { color: colors.text },
              requestSort === option.key && { color: colors.primary, fontWeight: '600' },
            ]}>
              {option.label}
            </Text>
            {requestSort === option.key && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </Modal>

      {/* Booking Sort Modal */}
      <Modal
        visible={showBookingSortModal}
        onClose={() => setShowBookingSortModal(false)}
        title={t('bookings.sortBy')}
      >
        {bookingSortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortOption,
              { borderBottomColor: colors.border },
              bookingSort === option.key && { backgroundColor: colors.primaryLight || colors.infoLight },
            ]}
            onPress={() => {
              setBookingSort(option.key);
              setShowBookingSortModal(false);
              haptics.selection();
            }}
          >
            <Text style={[
              styles.sortOptionText,
              { color: colors.text },
              bookingSort === option.key && { color: colors.primary, fontWeight: '600' },
            ]}>
              {option.label}
            </Text>
            {bookingSort === option.key && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </Modal>

      {/* ============================================================ */}
      {/* CONFIRM DIALOGS */}
      {/* ============================================================ */}

      <ConfirmDialog
        visible={convertConfirmVisible}
        title={t('requests.convertToProject')}
        message={t('requests.convertConfirm', { name: convertTarget?.title || '' })}
        confirmLabel={t('requests.convertToProject')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConvertConfirm}
        onCancel={() => { setConvertConfirmVisible(false); setConvertTarget(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Segment Control
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  segmentText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },

  // Search + Sort row
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  searchBarFlex: {
    flex: 1,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Filter
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  // Card (shared between requests and bookings)
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: FontSizes.sm,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  clientAvatar: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  clientAvatarText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
  clientName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  locationText: {
    fontSize: FontSizes.sm,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  metaText: {
    fontSize: FontSizes.sm,
  },
  notesText: {
    fontSize: FontSizes.xs,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.lg,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  quickActionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },

  // Sort modal
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  sortOptionText: {
    fontSize: FontSizes.md,
  },
});
