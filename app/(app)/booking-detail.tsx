import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { Button, EmptyState, ListSkeleton, ConfirmDialog, showToast, DatePicker } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import { invalidateCache, updateCacheData } from '@/lib/offlineStorage';
import { sendCounterOffer } from '@/lib/websiteApi';

interface BookingData {
  id: string;
  user_id: string;
  client_id: string;
  property_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  booking_date: string | null;
  status: string;
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
  client?: { id: string; name: string; email: string; phone?: string };
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';

  const statusColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    pending: { bg: colors.warningLight, text: colors.warning },
    confirmed: { bg: colors.infoLight, text: colors.primary },
    completed: { bg: colors.successLight, text: colors.success },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
    no_show: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  interface BookingDetailCache {
    booking: BookingData | null;
    property: { id: string; name: string; address_formatted: string | null; address_street: string | null; address_city: string | null; address_state: string | null; } | null;
  }

  const { data: detailData, loading, refreshing, isOffline, refresh } = useOfflineData<BookingDetailCache>(
    `booking_detail:${id}`,
    async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, client:clients(id, name, email, phone)')
        .eq('id', id!)
        .single();
      if (error) throw error;

      let propData = null;
      if ((data as any)?.property_id) {
        const { data: pData } = await supabase
          .from('properties')
          .select('id, name, address_formatted, address_street, address_city, address_state')
          .eq('id', (data as any).property_id)
          .single();
        propData = (pData as any) || null;
      }

      return { booking: data as any, property: propData };
    },
    { enabled: !!id },
  );

  const booking = detailData?.booking ?? null;
  const property = detailData?.property ?? null;
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Confirm dialog state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');

  // Complete modal state
  const [completeModalVisible, setCompleteModalVisible] = useState(false);

  // Counter offer state
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [counterDate, setCounterDate] = useState<Date | null>(new Date());
  const [counterTime, setCounterTime] = useState('09:00');
  const [counterMessage, setCounterMessage] = useState('');
  const [counterSending, setCounterSending] = useState(false);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // ================================================================
  // ACTIONS
  // ================================================================
  const promptStatusUpdate = (action: string) => {
    setConfirmAction(action);
    setConfirmVisible(true);
  };

  const handleStatusUpdate = async () => {
    if (!booking) return;
    setConfirmVisible(false);
    setUpdatingStatus(true);
    try {
      const updateData: Record<string, any> = { status: confirmAction };
      if (confirmAction === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_by = 'freelancer';
      }
      const { error } = await supabase
        .from('bookings')
        .update(updateData as any)
        .eq('id', booking.id);
      if (error) throw error;
      await invalidateCache('bookings');
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      refresh();
      showToast('success', t('bookingDetail.statusUpdated'));
    } catch (error: any) {
      secureLog.error('Error updating booking status:', error);
      showToast('error', t('bookingDetail.statusError'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getConfirmTitle = () => {
    switch (confirmAction) {
      case 'confirmed': return t('bookingDetail.confirmTitle');
      case 'completed': return t('bookingDetail.completeTitle');
      case 'cancelled': return t('bookingDetail.cancelTitle');
      case 'no_show': return t('bookingDetail.noShow');
      default: return '';
    }
  };

  const getConfirmMessage = () => {
    switch (confirmAction) {
      case 'confirmed': return t('bookingDetail.confirmMessage');
      case 'completed': return t('bookingDetail.completeMessage');
      case 'cancelled': return t('bookingDetail.cancelMessage');
      case 'no_show': return t('bookingDetail.cancelMessage');
      default: return '';
    }
  };

  const handleCompleteAndInvoice = async () => {
    if (!booking || !user) return;
    setCompleteModalVisible(false);
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' } as any)
        .eq('id', booking.id);
      if (error) throw error;
      await invalidateCache('bookings');
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      refresh();
      showToast('success', t('bookingDetail.completed'));
      // Navigate to invoices to create one for this booking
      router.push(`/(app)/invoices` as any);
    } catch (error) {
      secureLog.error('Error completing booking:', error);
      showToast('error', t('bookingDetail.completeError'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleJustComplete = async () => {
    if (!booking) return;
    setCompleteModalVisible(false);
    setConfirmAction('completed');
    setConfirmVisible(true);
  };

  const handleCounterOffer = async () => {
    if (!booking || !counterDate) return;
    setCounterSending(true);
    try {
      const proposedDate = counterDate.toISOString().split('T')[0];
      await sendCounterOffer(booking.id, proposedDate, counterTime, counterMessage.trim() || undefined);
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('bookingDetail.counterSent'));
      setCounterModalVisible(false);
      setCounterMessage('');
    } catch (error: any) {
      secureLog.error('Counter offer error:', error);
      showToast('error', error.message || t('bookingDetail.counterError'));
    } finally {
      setCounterSending(false);
    }
  };

  const handleSaveProperty = async () => {
    if (!booking || !user || !booking.address_formatted) return;
    try {
      const addressParts = booking.address_formatted.split(',').map(s => s.trim());
      const name = addressParts[0] || booking.address_formatted;
      const { data, error } = await supabase.from('properties').insert({
        user_id: user.id,
        client_id: booking.client_id,
        name,
        address_formatted: booking.address_formatted,
        address_street: addressParts[0] || null,
        address_city: addressParts[1] || null,
        address_state: addressParts[2] || null,
        address_lat: booking.address_lat,
        address_lng: booking.address_lng,
      } as any).select('id').single();
      if (error) throw error;

      // Link property to this booking
      if (data?.id) {
        await supabase.from('bookings').update({ property_id: data.id } as any).eq('id', booking.id);
        await invalidateCache('properties');
        await invalidateCache('bookings');
        refresh();
      }

      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('bookingDetail.propertySaved'));
    } catch (error) {
      secureLog.error('Error saving property:', error);
      showToast('error', t('bookingDetail.propertySaveError'));
    }
  };

  // ================================================================
  // FORMATTING
  // ================================================================
  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(dateLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [dateLocale]);

  const formatTime = useCallback((dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(dateLocale, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [dateLocale]);

  const getStatusLabel = useCallback((status: string) => {
    const key = `status.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status.charAt(0).toUpperCase() + status.slice(1);
  }, [t]);

  const openInMaps = (address: string, lat?: number | null, lng?: number | null) => {
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    }
  };

  // ================================================================
  // LOADING / NOT FOUND
  // ================================================================
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bookingDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}><ListSkeleton /></View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bookingDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState icon="calendar-outline" title={t('bookingDetail.notFound')} description={t('bookingDetail.notFoundDesc')} offline={isOffline} />
      </SafeAreaView>
    );
  }

  const bkColors = statusColors[booking.status] || statusColors.pending;
  const clientName = booking.client?.name || booking.client_name || t('bookings.noClient');
  const clientEmail = booking.client?.email || booking.client_email;
  const clientPhone = (booking.client as any)?.phone || booking.client_phone;
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';
  const isCompleted = booking.status === 'completed';
  const isPast = isConfirmed && new Date(booking.end_time || booking.start_time) < new Date();

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bookingDetail.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Past Due Warning */}
        {isPast && (
          <View style={[styles.warningBanner, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              {t('bookingDetail.pastDue')}
            </Text>
          </View>
        )}

        {/* Status + Title Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: bkColors.bg }]}>
              <Text style={[styles.statusText, { color: bkColors.text }]}>
                {getStatusLabel(booking.status)}
              </Text>
            </View>
          </View>
          <Text style={[styles.titleText, { color: colors.text }]}>{booking.title}</Text>
        </View>

        {/* Client Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.clientHeader}>
            <View style={[styles.clientAvatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <View style={styles.clientInfo}>
              <Text style={[styles.clientName, { color: colors.text }]}>{clientName}</Text>
            </View>
          </View>

          {clientEmail ? (
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${clientEmail}`)}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>{clientEmail}</Text>
            </TouchableOpacity>
          ) : null}

          {clientPhone ? (
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${clientPhone}`)}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>{clientPhone}</Text>
            </TouchableOpacity>
          ) : null}

          {booking.client?.id ? (
            <TouchableOpacity
              style={[styles.viewClientButton, { borderColor: colors.border }]}
              onPress={() => router.push(`/(app)/client-detail?id=${booking.client!.id}` as any)}
            >
              <Text style={[styles.viewClientText, { color: colors.primary }]}>{t('bookingDetail.viewClient')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Appointment Details Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bookingDetail.appointmentDetails')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('bookingDetail.serviceDate')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(booking.booking_date || booking.start_time)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('bookingDetail.startTime')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatTime(booking.start_time)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('bookingDetail.endTime')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatTime(booking.end_time)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="create-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('bookingDetail.received')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(booking.created_at)}
            </Text>
          </View>
        </View>

        {/* Location / Property Card */}
        {(property || booking.address_formatted) ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bookingDetail.location')}</Text>
            </View>
            {property && (
              <TouchableOpacity
                style={[styles.propertyLink, { backgroundColor: colors.infoLight, borderColor: colors.borderLight }]}
                onPress={() => router.push({ pathname: '/(app)/property-detail', params: { id: property.id } } as any)}
              >
                <Ionicons name="home-outline" size={18} color={colors.primary} />
                <View style={styles.propertyLinkContent}>
                  <Text style={[styles.propertyLinkName, { color: colors.primary }]} numberOfLines={1}>
                    {property.name}
                  </Text>
                  {(property.address_formatted || property.address_street) && (
                    <Text style={[styles.propertyLinkType, { color: colors.textSecondary }]}>
                      {property.address_formatted || [property.address_street, property.address_city, property.address_state].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            {booking.address_formatted && (
              <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
                {booking.address_formatted}
              </Text>
            )}
            {booking.address_formatted && (
              <View style={styles.locationActions}>
                <TouchableOpacity
                  style={[styles.navigateButton, { backgroundColor: colors.primary }]}
                  onPress={() => openInMaps(booking.address_formatted!, booking.address_lat, booking.address_lng)}
                >
                  <Ionicons name="navigate-outline" size={16} color="#fff" />
                  <Text style={styles.navigateButtonText}>{t('bookingDetail.navigate')}</Text>
                </TouchableOpacity>
                {!property && (
                  <TouchableOpacity
                    style={[styles.savePropertyButton, { borderColor: colors.primary }]}
                    onPress={handleSaveProperty}
                  >
                    <Ionicons name="home-outline" size={16} color={colors.primary} />
                    <Text style={[styles.savePropertyText, { color: colors.primary }]}>{t('bookingDetail.saveProperty')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* Description Card */}
        {booking.description ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bookingDetail.description')}</Text>
            </View>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{booking.description}</Text>
          </View>
        ) : null}

        {/* Notes Card */}
        {booking.notes ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bookingDetail.notes')}</Text>
            </View>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{booking.notes}</Text>
          </View>
        ) : null}

        {/* Action Buttons — Pending */}
        {isPending && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionGrid}>
              <Button
                title={t('bookingDetail.confirm')}
                onPress={() => promptStatusUpdate('confirmed')}
                loading={updatingStatus}
                style={styles.actionButton}
              />
              <Button
                title={t('bookingDetail.cancel')}
                onPress={() => promptStatusUpdate('cancelled')}
                variant="danger"
                loading={updatingStatus}
                style={styles.actionButton}
              />
            </View>
            <TouchableOpacity
              style={[styles.counterOfferBtn, { borderColor: colors.primary }]}
              onPress={() => setCounterModalVisible(true)}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
              <Text style={[styles.counterOfferBtnText, { color: colors.primary }]}>{t('bookingDetail.proposeNewTime')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons — Confirmed */}
        {isConfirmed && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionGrid}>
              <Button
                title={t('bookingDetail.markComplete')}
                onPress={() => setCompleteModalVisible(true)}
                loading={updatingStatus}
                style={styles.actionButton}
              />
              <Button
                title={t('bookingDetail.cancel')}
                onPress={() => promptStatusUpdate('cancelled')}
                variant="danger"
                loading={updatingStatus}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}

        {/* Action Buttons — Completed (no invoice yet) */}
        {isCompleted && !booking.invoice_id && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Button
              title={t('bookingDetail.createInvoice')}
              onPress={() => router.push('/(app)/invoices' as any)}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Metadata footer */}
        <View style={styles.metadataFooter}>
          <Text style={[styles.metadataText, { color: colors.textTertiary }]}>
            {t('bookingDetail.bookingId')}: {booking.id.slice(0, 8)}...
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmVisible}
        title={getConfirmTitle()}
        message={getConfirmMessage()}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        variant={confirmAction === 'cancelled' || confirmAction === 'no_show' ? 'danger' : 'default'}
        onConfirm={handleStatusUpdate}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* Complete Options Modal — Confirm + Invoice or just Complete */}
      <ConfirmDialog
        visible={completeModalVisible}
        title={t('bookingDetail.completeTitle')}
        message={t('bookingDetail.completeMessage')}
        confirmLabel={t('bookingDetail.completeAndInvoice')}
        cancelLabel={t('bookingDetail.justComplete')}
        onConfirm={handleCompleteAndInvoice}
        onCancel={handleJustComplete}
      />

      {/* Counter Offer Modal */}
      <Modal
        visible={counterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCounterModalVisible(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setCounterModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bookingDetail.proposeNewTime')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
            <Text style={[styles.counterHint, { color: colors.textSecondary }]}>{t('bookingDetail.counterHint')}</Text>

            <DatePicker
              label={t('bookingDetail.proposedDate')}
              value={counterDate}
              onChange={setCounterDate}
              placeholder={t('bookingDetail.selectDate')}
            />

            <View style={styles.counterTimeSection}>
              <Text style={[styles.counterLabel, { color: colors.text }]}>{t('bookingDetail.proposedTime')}</Text>
              <TextInput
                style={[styles.counterTimeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={counterTime}
                onChangeText={setCounterTime}
                placeholder="09:00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.counterTimeSection}>
              <Text style={[styles.counterLabel, { color: colors.text }]}>{t('bookingDetail.counterMessage')}</Text>
              <TextInput
                style={[styles.counterMsgInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={counterMessage}
                onChangeText={setCounterMessage}
                placeholder={t('bookingDetail.counterMessagePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.counterSendBtn, { backgroundColor: colors.primary }, counterSending && { opacity: 0.7 }]}
              onPress={handleCounterOffer}
              disabled={counterSending || !counterDate}
            >
              {counterSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.counterSendBtnText}>{t('bookingDetail.sendCounter')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40, height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '600' },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  warningText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Cards
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  statusRow: { marginBottom: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  titleText: { fontSize: FontSizes.xl, fontWeight: '700' },

  // Client
  clientHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  clientAvatar: {
    width: 44, height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: FontSizes.lg, fontWeight: '700' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  contactText: { fontSize: FontSizes.sm },
  viewClientButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  viewClientText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Details
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  detailLabel: { fontSize: FontSizes.sm, width: 90 },
  detailValue: { fontSize: FontSizes.sm, fontWeight: '500', flex: 1 },

  // Location / Property
  propertyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  propertyLinkContent: {
    flex: 1,
  },
  propertyLinkName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  propertyLinkType: {
    fontSize: FontSizes.xs,
    textTransform: 'capitalize',
  },
  locationAddress: { fontSize: FontSizes.sm, lineHeight: 20, marginBottom: Spacing.md },
  locationActions: {
    flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap',
  },
  navigateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, gap: Spacing.xs,
  },
  navigateButtonText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },
  savePropertyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, gap: Spacing.xs,
    borderWidth: 1,
  },
  savePropertyText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Description
  descriptionText: { fontSize: FontSizes.sm, lineHeight: 22 },

  // Action buttons
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionButton: { minWidth: '45%', flex: 1 },

  // Counter offer
  counterOfferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, marginTop: Spacing.sm, gap: Spacing.sm,
  },
  counterOfferBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },
  counterHint: { fontSize: FontSizes.sm, lineHeight: 20, marginBottom: Spacing.lg },
  counterTimeSection: { marginBottom: Spacing.lg },
  counterLabel: { fontSize: FontSizes.sm, fontWeight: '500', marginBottom: Spacing.sm },
  counterTimeInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, minHeight: 48,
  },
  counterMsgInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.sm, minHeight: 100,
  },
  counterSendBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  counterSendBtnText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },

  // Metadata
  metadataFooter: { paddingVertical: Spacing.md, alignItems: 'center' },
  metadataText: { fontSize: FontSizes.xs },
});
