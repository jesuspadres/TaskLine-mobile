import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { Modal, Input, Button, Select, DatePicker, EmptyState, Badge, FilterChips } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import type { Client } from '@/lib/database.types';

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
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

type BookingWithClient = BookingRow & {
  client?: { id: string; name: string; email: string };
  invoice?: { id: string; status: string } | null;
};

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
type FilterStatus = 'all' | BookingStatus;

const statusOptions = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function BookingsScreen() {
  const router = useRouter();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useTranslations();
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithClient | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    start_time: null as Date | null,
    end_time: null as Date | null,
    status: 'pending' as BookingStatus,
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const statusColors: Record<BookingStatus, { bg: string; text: string }> = {
    pending: { bg: colors.warningLight, text: colors.warning },
    confirmed: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  };

  const fetchBookings = useCallback(async () => {
    try {
      let query = (supabase
        .from('bookings')
        .select('*, client:clients(id, name, email), invoice:invoices(id, status)') as any)
        .order('start_time', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

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

  useEffect(() => {
    fetchBookings();
    fetchClients();
  }, [fetchBookings, fetchClients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      client_id: '',
      start_time: null,
      end_time: null,
      status: 'pending',
      notes: '',
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.client_id) {
      errors.client_id = 'Client is required';
    }

    if (!formData.start_time) {
      errors.start_time = 'Start time is required';
    }

    if (!formData.end_time) {
      errors.end_time = 'End time is required';
    }

    if (formData.start_time && formData.end_time && formData.end_time <= formData.start_time) {
      errors.end_time = 'End time must be after start time';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Auto-open create modal when navigated with create param
  useEffect(() => {
    if (create === 'true') {
      openAddModal();
      router.setParams({ create: '' });
    }
  }, [create]);

  const openEditModal = (booking: BookingWithClient) => {
    setSelectedBooking(booking);
    setFormData({
      title: booking.title,
      description: booking.description || '',
      client_id: booking.client_id,
      start_time: new Date(booking.start_time),
      end_time: new Date(booking.end_time),
      status: booking.status,
      notes: booking.notes || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleAddBooking = async () => {
    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        client_id: formData.client_id,
        start_time: formData.start_time!.toISOString(),
        end_time: formData.end_time!.toISOString(),
        status: formData.status,
        notes: formData.notes.trim() || null,
        user_id: user.id,
      });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      fetchBookings();
      Alert.alert('Success', 'Booking created successfully');
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setSaving(false);
    }
  };

  const handleEditBooking = async () => {
    if (!validateForm() || !selectedBooking) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          client_id: formData.client_id,
          start_time: formData.start_time!.toISOString(),
          end_time: formData.end_time!.toISOString(),
          status: formData.status,
          notes: formData.notes.trim() || null,
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedBooking(null);
      resetForm();
      fetchBookings();
      Alert.alert('Success', 'Booking updated successfully');
    } catch (error: any) {
      console.error('Error updating booking:', error);
      Alert.alert('Error', error.message || 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBooking = () => {
    if (!selectedBooking) return;

    Alert.alert(
      'Delete Booking',
      `Are you sure you want to delete "${selectedBooking.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', selectedBooking.id);

              if (error) throw error;

              setShowEditModal(false);
              setSelectedBooking(null);
              fetchBookings();
              Alert.alert('Success', 'Booking deleted');
            } catch (error: any) {
              console.error('Error deleting booking:', error);
              Alert.alert('Error', error.message || 'Failed to delete booking');
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
      Alert.alert('Success', 'Booking confirmed');
    } catch (error: any) {
      console.error('Error confirming booking:', error);
      Alert.alert('Error', error.message || 'Failed to confirm booking');
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
      Alert.alert('Success', 'Booking marked as completed');
    } catch (error: any) {
      console.error('Error completing booking:', error);
      Alert.alert('Error', error.message || 'Failed to complete booking');
    }
  };

  const clientOptions = clients.map((c) => ({ key: c.id, label: (c as any).email ? `${c.name} (${(c as any).email})` : c.name }));

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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

  // Summary calculations
  const totalBookings = bookings.length;
  const upcomingCount = bookings.filter(
    (b) =>
      (b.status === 'pending' || b.status === 'confirmed') &&
      new Date(b.start_time) >= new Date()
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  const renderBooking = useCallback(({ item }: { item: BookingWithClient }) => {
    const itemColors = statusColors[item.status];

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.bookingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.clientName, { color: colors.textSecondary }]}>
              {item.client?.name || 'No client'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
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
                <Text style={[styles.quickActionText, { color: colors.primary }]}>Confirm</Text>
              </TouchableOpacity>
            )}
            {item.status === 'confirmed' && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => handleQuickComplete(item)}
              >
                <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
                <Text style={[styles.quickActionText, { color: colors.success }]}>
                  Complete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Completed: Invoice status + Create Invoice */}
        {item.status === 'completed' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            {item.invoice_id ? (
              <>
                <View style={[styles.invoiceSentBadge, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.invoiceSentText, { color: colors.success }]}>
                    {t('bookings.invoiceSent')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.createInvoiceButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push(`/(app)/invoices?create=true&client_id=${item.client_id}` as any)}
                >
                  <Ionicons name="document-text-outline" size={14} color="#fff" />
                  <Text style={styles.createInvoiceText}>{t('bookings.createNewInvoice')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.createInvoiceButton, { backgroundColor: colors.success }]}
                onPress={() => router.push(`/(app)/invoices?create=true&client_id=${item.client_id}` as any)}
              >
                <Ionicons name="document-text-outline" size={14} color="#fff" />
                <Text style={styles.createInvoiceText}>{t('bookings.createInvoice')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [colors, statusColors, openEditModal, formatTimeRange, handleQuickConfirm, handleQuickComplete]);

  const renderFormContent = () => (
    <View>
      <Input
        label="Title *"
        placeholder="Booking title"
        value={formData.title}
        onChangeText={(text) => setFormData({ ...formData, title: text })}
        error={formErrors.title}
        leftIcon="calendar-outline"
      />

      <Input
        label="Description"
        placeholder="Booking description..."
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
      />

      <Select
        label="Client *"
        placeholder="Select a client"
        options={clientOptions}
        value={formData.client_id}
        onChange={(value) => setFormData({ ...formData, client_id: value })}
        error={formErrors.client_id}
        searchable
      />

      <DatePicker
        label="Start Time *"
        value={formData.start_time}
        onChange={(date) => setFormData({ ...formData, start_time: date })}
        placeholder="Select start time"
        error={formErrors.start_time}
      />

      <DatePicker
        label="End Time *"
        value={formData.end_time}
        onChange={(date) => setFormData({ ...formData, end_time: date })}
        placeholder="Select end time"
        error={formErrors.end_time}
      />

      <Select
        label="Status"
        options={statusOptions}
        value={formData.status}
        onChange={(value) => setFormData({ ...formData, status: value as BookingStatus })}
      />

      <Input
        label="Notes"
        placeholder="Additional notes..."
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        leftIcon="create-outline"
        multiline
        numberOfLines={3}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Bookings</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Total</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{totalBookings}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Upcoming</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {upcomingCount}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Completed</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {completedCount}
          </Text>
        </View>
      </View>

      {/* Filter Chips + Booking List */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
          <View style={styles.filterContainer}>
            <FilterChips
              options={filterOptions}
              selected={filterStatus}
              onSelect={(value) => setFilterStatus(value as FilterStatus)}
            />
          </View>
        </Animated.View>

        <Animated.FlatList
          data={bookings}
          renderItem={renderBooking}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: filterHeight }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No bookings"
              description="Create a booking to get started scheduling with clients."
              actionLabel="Add Booking"
              onAction={openAddModal}
            />
          }
        />
      </View>

      {/* Add Booking Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Booking"
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title="Cancel"
            onPress={() => setShowAddModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Create Booking"
            onPress={handleAddBooking}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Booking"
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title="Delete"
            onPress={handleDeleteBooking}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title="Cancel"
            onPress={() => setShowEditModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Save"
            onPress={handleEditBooking}
            loading={saving}
            style={styles.actionButton}
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
    flex: 1,
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
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
  clientName: {
    fontSize: FontSizes.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  quickActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    minWidth: 100,
  },
  deleteButton: {
    marginRight: 'auto',
  },
  invoiceSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  invoiceSentText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  createInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginLeft: 'auto',
  },
  createInvoiceText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
