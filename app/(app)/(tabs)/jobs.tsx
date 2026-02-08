import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { ENV } from '@/lib/env';
import { Modal, Input, Button, Select, DatePicker, EmptyState, FilterChips } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { RequestWithClient, Client } from '@/lib/database.types';

// --- Request types ---
type RequestStatus = 'all' | 'new' | 'reviewing' | 'converted' | 'declined';

const requestStatusOptions = [
  { key: 'new', label: 'New' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'converted', label: 'Converted' },
  { key: 'declined', label: 'Declined' },
];

// --- Booking types ---
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

type BookingWithClient = BookingRow & { client?: { id: string; name: string; email: string } };

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
type BookingFilterStatus = 'all' | BookingStatus;

const bookingStatusOptions = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const bookingFilterOptions = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

type Segment = 'requests' | 'bookings';

export default function JobsScreen() {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const { create } = useLocalSearchParams<{ create?: string }>();

  // Segment state
  const [segment, setSegment] = useState<Segment>('requests');

  // Shared clients list
  const [clients, setClients] = useState<Client[]>([]);

  // --- Requests state ---
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsRefreshing, setRequestsRefreshing] = useState(false);
  const [requests, setRequests] = useState<RequestWithClient[]>([]);
  const [requestFilterStatus, setRequestFilterStatus] = useState<RequestStatus>('all');

  // Request modal state
  const [showRequestAddModal, setShowRequestAddModal] = useState(false);
  const [showRequestEditModal, setShowRequestEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithClient | null>(null);
  const [requestSaving, setRequestSaving] = useState(false);

  // Request form state
  const [reqFormTitle, setReqFormTitle] = useState('');
  const [reqFormDescription, setReqFormDescription] = useState('');
  const [reqFormClientId, setReqFormClientId] = useState('');
  const [reqFormStatus, setReqFormStatus] = useState('new');
  const [reqFormBudget, setReqFormBudget] = useState('');
  const [reqFormDeadline, setReqFormDeadline] = useState<Date | null>(null);
  const [reqFormErrors, setReqFormErrors] = useState<Record<string, string>>({});

  // --- Bookings state ---
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsRefreshing, setBookingsRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingWithClient[]>([]);
  const [bookingFilterStatus, setBookingFilterStatus] = useState<BookingFilterStatus>('all');

  // Booking modal state
  const [showBookingAddModal, setShowBookingAddModal] = useState(false);
  const [showBookingEditModal, setShowBookingEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithClient | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);

  // Booking form state
  const [bookingFormData, setBookingFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    start_time: null as Date | null,
    end_time: null as Date | null,
    status: 'pending' as BookingStatus,
    notes: '',
  });
  const [bookingFormErrors, setBookingFormErrors] = useState<Record<string, string>>({});

  // --- Status color maps ---
  const requestStatusColors = useMemo(() => ({
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    converted: { bg: colors.successLight, text: colors.success },
    declined: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  const bookingStatusColors: Record<BookingStatus, { bg: string; text: string }> = {
    pending: { bg: colors.warningLight, text: colors.warning },
    confirmed: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  };

  // ================================================================
  // SHARED: Fetch clients
  // ================================================================
  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }, []);

  const clientOptions = clients.map((c) => ({ key: c.id, label: c.name }));

  // ================================================================
  // REQUESTS: Fetch, CRUD, helpers
  // ================================================================
  const fetchRequests = useCallback(async () => {
    try {
      let query = supabase
        .from('requests')
        .select('*, client:clients(id, name, email)')
        .order('created_at', { ascending: false });

      if (requestFilterStatus !== 'all') {
        query = query.eq('status', requestFilterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert(t('common.error'), 'Failed to load requests');
    } finally {
      setRequestsLoading(false);
      setRequestsRefreshing(false);
    }
  }, [requestFilterStatus, t]);

  const resetRequestForm = () => {
    setReqFormTitle('');
    setReqFormDescription('');
    setReqFormClientId('');
    setReqFormStatus('new');
    setReqFormBudget('');
    setReqFormDeadline(null);
    setReqFormErrors({});
  };

  const openRequestAddModal = () => {
    resetRequestForm();
    setShowRequestAddModal(true);
  };

  // Auto-open create modal when navigated with create param
  useEffect(() => {
    if (create === 'true') {
      openRequestAddModal();
      router.setParams({ create: '' });
    }
  }, [create]);

  const openRequestEditModal = (request: RequestWithClient) => {
    setSelectedRequest(request);
    setReqFormTitle(request.title);
    setReqFormDescription(request.description || '');
    setReqFormClientId(request.client_id || '');
    setReqFormStatus(request.status);
    setReqFormBudget(request.budget || '');
    setReqFormDeadline(request.deadline ? new Date(request.deadline) : null);
    setReqFormErrors({});
    setShowRequestEditModal(true);
  };

  const validateRequestForm = () => {
    const errors: Record<string, string> = {};
    if (!reqFormTitle.trim()) errors.title = 'Title is required';
    if (!reqFormClientId) errors.client = 'Client is required';
    setReqFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddRequest = async () => {
    if (!validateRequestForm() || !user) return;

    setRequestSaving(true);
    try {
      const { error } = await supabase.from('requests').insert({
        title: reqFormTitle.trim(),
        description: reqFormDescription.trim() || null,
        client_id: reqFormClientId,
        status: reqFormStatus as 'new' | 'reviewing' | 'converted' | 'declined',
        budget: reqFormBudget.trim() || null,
        deadline: reqFormDeadline?.toISOString().split('T')[0] || null,
        user_id: user.id,
      });

      if (error) throw error;

      setShowRequestAddModal(false);
      resetRequestForm();
      fetchRequests();
      Alert.alert(t('common.success'), 'Request created successfully');
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert(t('common.error'), 'Failed to create request');
    } finally {
      setRequestSaving(false);
    }
  };

  const handleUpdateRequest = async () => {
    if (!validateRequestForm() || !selectedRequest) return;

    setRequestSaving(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          title: reqFormTitle.trim(),
          description: reqFormDescription.trim() || null,
          client_id: reqFormClientId,
          status: reqFormStatus as 'new' | 'reviewing' | 'converted' | 'declined',
          budget: reqFormBudget.trim() || null,
          deadline: reqFormDeadline?.toISOString().split('T')[0] || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      setShowRequestEditModal(false);
      setSelectedRequest(null);
      resetRequestForm();
      fetchRequests();
      Alert.alert(t('common.success'), 'Request updated successfully');
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert(t('common.error'), 'Failed to update request');
    } finally {
      setRequestSaving(false);
    }
  };

  const handleDeleteRequest = () => {
    if (!selectedRequest) return;

    Alert.alert(
      t('common.delete'),
      `Are you sure you want to delete "${selectedRequest.title}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('requests')
                .delete()
                .eq('id', selectedRequest.id);

              if (error) throw error;

              setShowRequestEditModal(false);
              setSelectedRequest(null);
              fetchRequests();
              Alert.alert(t('common.success'), 'Request deleted');
            } catch (error) {
              console.error('Error deleting request:', error);
              Alert.alert(t('common.error'), 'Failed to delete request');
            }
          },
        },
      ]
    );
  };

  const handleConvertToProject = async (request: RequestWithClient) => {
    Alert.alert(
      'Convert to Project',
      `Convert "${request.title}" to a project?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            try {
              // Create project from request
              const { error: projectError } = await supabase.from('projects').insert({
                name: request.title,
                description: request.description || '',
                client_id: request.client_id,
                status: 'active',
                user_id: user!.id,
              });

              if (projectError) throw projectError;

              // Update request status
              const { error: updateError } = await supabase
                .from('requests')
                .update({ status: 'converted' })
                .eq('id', request.id);

              if (updateError) throw updateError;

              fetchRequests();
              Alert.alert(t('common.success'), 'Request converted to project');
            } catch (error) {
              console.error('Error converting request:', error);
              Alert.alert(t('common.error'), 'Failed to convert request');
            }
          },
        },
      ]
    );
  };

  const handleShareLink = async () => {
    const requestLink = `${ENV.APP_URL}/request/${user?.id}`;
    try {
      await Share.share({
        message: `Submit a request: ${requestLink}`,
        url: requestLink,
      });
    } catch (error) {
      // Fallback to clipboard
      Alert.alert('Request Link', requestLink, [
        { text: 'Copy', onPress: () => Alert.alert('Copied!') },
        { text: 'OK' },
      ]);
    }
  };

  const onRequestsRefresh = useCallback(() => {
    setRequestsRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const formatRequestDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('time.today');
    } else if (diffDays === 1) {
      return t('time.yesterday');
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const navigateToRequestDetail = (request: RequestWithClient) => {
    router.push({ pathname: '/(app)/request-detail', params: { id: request.id } });
  };

  // ================================================================
  // BOOKINGS: Fetch, CRUD, helpers
  // ================================================================
  const fetchBookings = useCallback(async () => {
    try {
      let query = supabase
        .from('bookings')
        .select('*, client:clients(id, name, email)')
        .order('start_time', { ascending: false });

      if (bookingFilterStatus !== 'all') {
        query = query.eq('status', bookingFilterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert(t('common.error'), 'Failed to load bookings');
    } finally {
      setBookingsLoading(false);
      setBookingsRefreshing(false);
    }
  }, [bookingFilterStatus, t]);

  const resetBookingForm = () => {
    setBookingFormData({
      title: '',
      description: '',
      client_id: '',
      start_time: null,
      end_time: null,
      status: 'pending',
      notes: '',
    });
    setBookingFormErrors({});
  };

  const validateBookingForm = () => {
    const errors: Record<string, string> = {};

    if (!bookingFormData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!bookingFormData.client_id) {
      errors.client_id = 'Client is required';
    }

    if (!bookingFormData.start_time) {
      errors.start_time = 'Start time is required';
    }

    if (!bookingFormData.end_time) {
      errors.end_time = 'End time is required';
    }

    if (bookingFormData.start_time && bookingFormData.end_time && bookingFormData.end_time <= bookingFormData.start_time) {
      errors.end_time = 'End time must be after start time';
    }

    setBookingFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openBookingAddModal = () => {
    resetBookingForm();
    setShowBookingAddModal(true);
  };

  const openBookingEditModal = (booking: BookingWithClient) => {
    setSelectedBooking(booking);
    setBookingFormData({
      title: booking.title,
      description: booking.description || '',
      client_id: booking.client_id,
      start_time: new Date(booking.start_time),
      end_time: new Date(booking.end_time),
      status: booking.status,
      notes: booking.notes || '',
    });
    setBookingFormErrors({});
    setShowBookingEditModal(true);
  };

  const handleAddBooking = async () => {
    if (!validateBookingForm() || !user) return;

    setBookingSaving(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        title: bookingFormData.title.trim(),
        description: bookingFormData.description.trim() || null,
        client_id: bookingFormData.client_id,
        start_time: bookingFormData.start_time!.toISOString(),
        end_time: bookingFormData.end_time!.toISOString(),
        status: bookingFormData.status,
        notes: bookingFormData.notes.trim() || null,
        user_id: user.id,
      });

      if (error) throw error;

      setShowBookingAddModal(false);
      resetBookingForm();
      fetchBookings();
      Alert.alert(t('common.success'), 'Booking created successfully');
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to create booking');
    } finally {
      setBookingSaving(false);
    }
  };

  const handleEditBooking = async () => {
    if (!validateBookingForm() || !selectedBooking) return;

    setBookingSaving(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          title: bookingFormData.title.trim(),
          description: bookingFormData.description.trim() || null,
          client_id: bookingFormData.client_id,
          start_time: bookingFormData.start_time!.toISOString(),
          end_time: bookingFormData.end_time!.toISOString(),
          status: bookingFormData.status,
          notes: bookingFormData.notes.trim() || null,
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setShowBookingEditModal(false);
      setSelectedBooking(null);
      resetBookingForm();
      fetchBookings();
      Alert.alert(t('common.success'), 'Booking updated successfully');
    } catch (error: any) {
      console.error('Error updating booking:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to update booking');
    } finally {
      setBookingSaving(false);
    }
  };

  const handleDeleteBooking = () => {
    if (!selectedBooking) return;

    Alert.alert(
      t('common.delete'),
      `Are you sure you want to delete "${selectedBooking.title}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', selectedBooking.id);

              if (error) throw error;

              setShowBookingEditModal(false);
              setSelectedBooking(null);
              fetchBookings();
              Alert.alert(t('common.success'), 'Booking deleted');
            } catch (error: any) {
              console.error('Error deleting booking:', error);
              Alert.alert(t('common.error'), error.message || 'Failed to delete booking');
            }
          },
        },
      ]
    );
  };

  const handleQuickConfirm = async (booking: BookingWithClient) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id);

      if (error) throw error;
      fetchBookings();
      Alert.alert(t('common.success'), 'Booking confirmed');
    } catch (error: any) {
      console.error('Error confirming booking:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to confirm booking');
    }
  };

  const handleQuickComplete = async (booking: BookingWithClient) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', booking.id);

      if (error) throw error;
      fetchBookings();
      Alert.alert(t('common.success'), 'Booking marked as completed');
    } catch (error: any) {
      console.error('Error completing booking:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to complete booking');
    }
  };

  const onBookingsRefresh = useCallback(() => {
    setBookingsRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const formatTimeRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const dateStr = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const startTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${dateStr} \u00B7 ${startTime} - ${endTime}`;
  };

  // Booking summary calculations
  const totalBookings = bookings.length;
  const upcomingCount = bookings.filter(
    (b) =>
      (b.status === 'pending' || b.status === 'confirmed') &&
      new Date(b.start_time) >= new Date()
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  // ================================================================
  // EFFECTS: Fetch data on mount and filter changes
  // ================================================================
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ================================================================
  // RENDER: Request card
  // ================================================================
  const renderRequest = ({ item }: { item: RequestWithClient }) => {
    const itemColors = requestStatusColors[item.status] || requestStatusColors.new;

    return (
      <TouchableOpacity
        style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigateToRequestDetail(item)}
        onLongPress={() => openRequestEditModal(item)}
      >
        <View style={styles.requestHeader}>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
            <Text style={[styles.statusText, { color: itemColors.text }]}>
              {item.status}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textTertiary }]}>
            {formatRequestDate(item.created_at)}
          </Text>
        </View>

        <Text style={[styles.requestTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {item.description && (
          <Text style={[styles.requestDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.requestFooter}>
          <View style={styles.clientInfo}>
            <View style={[styles.clientAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.clientAvatarText}>
                {(item.client as any)?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={[styles.clientName, { color: colors.textSecondary }]}>
              {(item.client as any)?.name || 'Unknown'}
            </Text>
          </View>

          {item.budget && (
            <Text style={[styles.budgetText, { color: colors.success }]}>{item.budget}</Text>
          )}
        </View>

        {item.deadline && (
          <View style={styles.deadlineRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.deadlineText, { color: colors.textTertiary }]}>
              Due: {new Date(item.deadline).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        {item.status === 'new' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleConvertToProject(item)}
            >
              <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>Convert to Project</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER: Booking card
  // ================================================================
  const renderBooking = ({ item }: { item: BookingWithClient }) => {
    const itemColors = bookingStatusColors[item.status];

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openBookingEditModal(item)}
      >
        <View style={styles.bookingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.bookingClientName, { color: colors.textSecondary }]}>
              {item.client?.name || 'No client'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg, marginLeft: Spacing.sm }]}>
            <Text style={[styles.statusText, { color: itemColors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.timeText, { color: colors.textTertiary }]}>
            {formatTimeRange(item.start_time, item.end_time)}
          </Text>
        </View>

        {item.notes && (
          <Text style={[styles.notesText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.notes}
          </Text>
        )}

        {/* Quick Actions */}
        {(item.status === 'pending' || item.status === 'confirmed') && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => handleQuickConfirm(item)}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.primary }]}>
                  {t('common.confirm')}
                </Text>
              </TouchableOpacity>
            )}
            {item.status === 'confirmed' && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => handleQuickComplete(item)}
              >
                <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
                <Text style={[styles.quickActionText, { color: colors.success }]}>
                  {t('bookings.completed')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ================================================================
  // RENDER: Booking form content (shared between add/edit modals)
  // ================================================================
  const renderBookingFormContent = () => (
    <View>
      <Input
        label="Title *"
        placeholder="Booking title"
        value={bookingFormData.title}
        onChangeText={(text) => setBookingFormData({ ...bookingFormData, title: text })}
        error={bookingFormErrors.title}
        leftIcon="calendar-outline"
      />

      <Input
        label="Description"
        placeholder="Booking description..."
        value={bookingFormData.description}
        onChangeText={(text) => setBookingFormData({ ...bookingFormData, description: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
      />

      <Select
        label="Client *"
        placeholder="Select a client"
        options={clientOptions}
        value={bookingFormData.client_id}
        onChange={(value) => setBookingFormData({ ...bookingFormData, client_id: value })}
        error={bookingFormErrors.client_id}
      />

      <DatePicker
        label="Start Time *"
        value={bookingFormData.start_time}
        onChange={(date) => setBookingFormData({ ...bookingFormData, start_time: date })}
        placeholder="Select start time"
        error={bookingFormErrors.start_time}
      />

      <DatePicker
        label="End Time *"
        value={bookingFormData.end_time}
        onChange={(date) => setBookingFormData({ ...bookingFormData, end_time: date })}
        placeholder="Select end time"
        error={bookingFormErrors.end_time}
      />

      <Select
        label="Status"
        options={bookingStatusOptions}
        value={bookingFormData.status}
        onChange={(value) => setBookingFormData({ ...bookingFormData, status: value as BookingStatus })}
      />

      <Input
        label="Notes"
        placeholder="Additional notes..."
        value={bookingFormData.notes}
        onChangeText={(text) => setBookingFormData({ ...bookingFormData, notes: text })}
        leftIcon="create-outline"
        multiline
        numberOfLines={3}
      />
    </View>
  );

  // ================================================================
  // LOADING STATE
  // ================================================================
  const isLoading = segment === 'requests' ? requestsLoading : bookingsLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('jobs.title')}</Text>
        </View>

        {/* Segment Control */}
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
          <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={[styles.title, { color: colors.text }]}>{t('jobs.title')}</Text>
        <View style={styles.headerButtons}>
          {segment === 'requests' && (
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: colors.infoLight }]}
              onPress={handleShareLink}
            >
              <Ionicons name="share-outline" size={20} color={colors.primary} />
              <Text style={[styles.shareText, { color: colors.primary }]}>{t('requests.shareLink')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={segment === 'requests' ? openRequestAddModal : openBookingAddModal}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segment Control */}
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

      {/* ============================================================ */}
      {/* REQUESTS SEGMENT */}
      {/* ============================================================ */}
      {segment === 'requests' && (
        <>
          {/* Filter Chips */}
          <View style={styles.filterScroll}>
            {(['all', 'new', 'reviewing', 'converted', 'declined'] as RequestStatus[]).map(
              (status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    requestFilterStatus === status && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setRequestFilterStatus(status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.textSecondary },
                      requestFilterStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Request List */}
          <FlatList
            data={requests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={requestsRefreshing} onRefresh={onRequestsRefresh} />
            }
            ListEmptyComponent={
              <EmptyState
                icon="mail-outline"
                title={t('requests.noRequests')}
                description={t('requests.noRequestsDesc')}
                actionLabel={t('common.add')}
                onAction={openRequestAddModal}
              />
            }
          />
        </>
      )}

      {/* ============================================================ */}
      {/* BOOKINGS SEGMENT */}
      {/* ============================================================ */}
      {segment === 'bookings' && (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{totalBookings}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Upcoming</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{upcomingCount}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('bookings.completed')}</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{completedCount}</Text>
            </View>
          </View>

          {/* Filter Chips */}
          <View style={styles.filterContainer}>
            <FilterChips
              options={bookingFilterOptions}
              selected={bookingFilterStatus}
              onSelect={(value) => setBookingFilterStatus(value as BookingFilterStatus)}
            />
          </View>

          {/* Booking List */}
          <FlatList
            data={bookings}
            renderItem={renderBooking}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={bookingsRefreshing} onRefresh={onBookingsRefresh} />
            }
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title={t('bookings.noBookings')}
                description={t('bookings.noBookingsDesc')}
                actionLabel={t('common.add')}
                onAction={openBookingAddModal}
              />
            }
          />
        </>
      )}

      {/* ============================================================ */}
      {/* REQUEST MODALS */}
      {/* ============================================================ */}

      {/* Add Request Modal */}
      <Modal
        visible={showRequestAddModal}
        onClose={() => setShowRequestAddModal(false)}
        title="New Request"
        size="full"
      >
        <ScrollView style={styles.modalContent} keyboardDismissMode="on-drag">
          <Input
            label="Title"
            value={reqFormTitle}
            onChangeText={setReqFormTitle}
            placeholder="Enter request title"
            error={reqFormErrors.title}
          />

          <Input
            label="Description"
            value={reqFormDescription}
            onChangeText={setReqFormDescription}
            placeholder="Describe the request..."
            multiline
            numberOfLines={4}
          />

          <Select
            label="Client"
            options={clientOptions}
            value={reqFormClientId}
            onChange={setReqFormClientId}
            placeholder="Select a client"
            error={reqFormErrors.client}
          />

          <Select
            label="Status"
            options={requestStatusOptions}
            value={reqFormStatus}
            onChange={setReqFormStatus}
            placeholder="Select status"
          />

          <Input
            label="Budget"
            value={reqFormBudget}
            onChangeText={setReqFormBudget}
            placeholder="e.g., $1,000 - $5,000"
          />

          <DatePicker
            label="Deadline"
            value={reqFormDeadline}
            onChange={setReqFormDeadline}
            placeholder="Select deadline (optional)"
            minDate={new Date()}
          />

          <View style={styles.modalActions}>
            <Button
              title={t('common.cancel')}
              onPress={() => setShowRequestAddModal(false)}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <Button
              title="Create Request"
              onPress={handleAddRequest}
              variant="primary"
              loading={requestSaving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* Edit Request Modal */}
      <Modal
        visible={showRequestEditModal}
        onClose={() => setShowRequestEditModal(false)}
        title="Edit Request"
        size="full"
      >
        <ScrollView style={styles.modalContent} keyboardDismissMode="on-drag">
          <Input
            label="Title"
            value={reqFormTitle}
            onChangeText={setReqFormTitle}
            placeholder="Enter request title"
            error={reqFormErrors.title}
          />

          <Input
            label="Description"
            value={reqFormDescription}
            onChangeText={setReqFormDescription}
            placeholder="Describe the request..."
            multiline
            numberOfLines={4}
          />

          <Select
            label="Client"
            options={clientOptions}
            value={reqFormClientId}
            onChange={setReqFormClientId}
            placeholder="Select a client"
            error={reqFormErrors.client}
          />

          <Select
            label="Status"
            options={requestStatusOptions}
            value={reqFormStatus}
            onChange={setReqFormStatus}
            placeholder="Select status"
          />

          <Input
            label="Budget"
            value={reqFormBudget}
            onChangeText={setReqFormBudget}
            placeholder="e.g., $1,000 - $5,000"
          />

          <DatePicker
            label="Deadline"
            value={reqFormDeadline}
            onChange={setReqFormDeadline}
            placeholder="Select deadline (optional)"
          />

          <View style={styles.modalActions}>
            <Button
              title={t('common.delete')}
              onPress={handleDeleteRequest}
              variant="danger"
              style={{ flex: 1 }}
            />
            <Button
              title={t('common.save')}
              onPress={handleUpdateRequest}
              variant="primary"
              loading={requestSaving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* ============================================================ */}
      {/* BOOKING MODALS */}
      {/* ============================================================ */}

      {/* Add Booking Modal */}
      <Modal
        visible={showBookingAddModal}
        onClose={() => setShowBookingAddModal(false)}
        title="New Booking"
        size="full"
      >
        {renderBookingFormContent()}
        <View style={[styles.bookingModalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowBookingAddModal(false)}
            variant="secondary"
            style={styles.bookingActionButton}
          />
          <Button
            title="Create Booking"
            onPress={handleAddBooking}
            loading={bookingSaving}
            style={styles.bookingActionButton}
          />
        </View>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal
        visible={showBookingEditModal}
        onClose={() => setShowBookingEditModal(false)}
        title="Edit Booking"
        size="full"
      >
        {renderBookingFormContent()}
        <View style={[styles.bookingModalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.delete')}
            onPress={handleDeleteBooking}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title={t('common.cancel')}
            onPress={() => setShowBookingEditModal(false)}
            variant="secondary"
            style={styles.bookingActionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleEditBooking}
            loading={bookingSaving}
            style={styles.bookingActionButton}
          />
        </View>
      </Modal>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  shareText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  addButton: {
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

  // Filter chips (requests)
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },

  // Filter container (bookings)
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  // Request card
  requestCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  requestHeader: {
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
  requestTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  requestDescription: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: FontSizes.sm,
  },
  budgetText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  deadlineText: {
    fontSize: FontSizes.xs,
  },

  // Booking card
  bookingCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  bookingTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: 2,
  },
  bookingClientName: {
    fontSize: FontSizes.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  timeText: {
    fontSize: FontSizes.sm,
  },
  notesText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },

  // Summary cards (bookings)
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  // Quick actions (shared)
  quickActions: {
    flexDirection: 'row',
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

  // Request modals
  modalContent: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // Booking modals
  bookingModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  bookingActionButton: {
    minWidth: 100,
  },
  deleteButton: {
    marginRight: 'auto',
  },
});
