import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { Button, EmptyState, ListSkeleton, ConfirmDialog, showToast } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface RequestData {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description: string | null;
  project_description: string | null;
  budget: string | null;
  budget_range: string | null;
  deadline: string | null;
  timeline: string | null;
  status: string;
  files: string[] | null;
  address_formatted: string | null;
  address_lat: number | null;
  address_lng: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string; email: string; phone?: string };
}

interface RequestDetailData {
  request: RequestData | null;
  messageCount: number;
  matchedProperty: { id: string; name: string } | null;
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const scrollViewRef = useRef<ScrollView>(null);
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';

  const statusColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    accepted: { bg: colors.successLight, text: colors.success },
    converted: { bg: colors.successLight, text: colors.success },
    declined: { bg: colors.surfaceSecondary, text: colors.textTertiary },
    archived: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  const { data: requestData, loading, refreshing, refresh } = useOfflineData<RequestDetailData>(
    `request_detail:${id}`,
    async () => {
      // Fetch request
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .select('*, client:clients(id, name, email, phone)')
        .eq('id', id as string)
        .single();
      if (reqError) throw reqError;

      // Fetch message count
      let msgCount = 0;
      try {
        const { count, error: msgError } = await supabase
          .from('request_messages')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', id as string);
        if (!msgError) msgCount = count ?? 0;
      } catch (error) {
        secureLog.error('Error fetching message count:', error);
      }

      // Fetch matching property
      let matched: { id: string; name: string } | null = null;
      const req = reqData as any;
      if (req?.client_id && req?.address_formatted) {
        try {
          const { data: propsData } = await supabase
            .from('properties')
            .select('id, name, address_formatted')
            .eq('client_id', req.client_id)
            .order('created_at', { ascending: false });
          const props = (propsData as any) || [];
          const match = props.find((p: any) => p.address_formatted === req.address_formatted);
          if (match) matched = { id: match.id, name: match.name };
        } catch (error) {
          secureLog.error('Error fetching properties:', error);
        }
      }

      return {
        request: req as RequestData,
        messageCount: msgCount,
        matchedProperty: matched,
      };
    },
    { enabled: !!id },
  );
  const { mutate } = useOfflineMutation();

  const request = requestData?.request ?? null;
  const messageCount = requestData?.messageCount ?? 0;
  const [matchedProperty, setMatchedProperty] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [propertySaved, setPropertySaved] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Sync matchedProperty from requestData into local state so save-property can update it
  useEffect(() => {
    if (requestData?.matchedProperty) {
      setMatchedProperty(requestData.matchedProperty);
    }
  }, [requestData?.matchedProperty]);

  // Confirm dialog state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');

  // ================================================================
  // ACTIONS
  // ================================================================
  const openMessages = () => {
    if (!request) return;
    const clientNameParam = request.client?.name || request.name || '';
    const clientEmailParam = request.client?.email || request.email || '';
    router.push(`/(app)/request-messages?id=${id}&clientName=${encodeURIComponent(clientNameParam)}&clientEmail=${encodeURIComponent(clientEmailParam)}` as any);
  };

  const promptStatusUpdate = (action: string) => {
    setConfirmAction(action);
    setConfirmVisible(true);
  };

  const handleStatusUpdate = async () => {
    if (!request) return;
    setConfirmVisible(false);
    setUpdatingStatus(true);
    try {
      const { error } = await mutate({
        table: 'requests',
        operation: 'update',
        data: { status: confirmAction },
        matchColumn: 'id',
        matchValue: request.id,
        cacheKeys: [`request_detail:${id}`],
      });
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('requestDetail.statusUpdated'));
      refresh();
    } catch (error: any) {
      secureLog.error('Error updating request status:', error);
      showToast('error', t('requestDetail.statusError'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getConfirmMessage = () => {
    switch (confirmAction) {
      case 'reviewing': return t('requestDetail.confirmReview');
      case 'accepted': return t('requestDetail.confirmAccept');
      case 'declined': return t('requestDetail.confirmDecline');
      case 'archived': return t('requestDetail.confirmArchive');
      default: return '';
    }
  };

  const handleConvertToProject = async () => {
    if (!request || !user) return;
    try {
      const { error } = await supabase.from('projects').insert({
        name: request.title,
        description: request.description || request.project_description || null,
        client_id: request.client_id,
        status: 'active',
        user_id: user.id,
      });
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('requests.convertSuccess'));
      router.push('/(app)/projects' as any);
    } catch (error) {
      secureLog.error('Error creating project:', error);
      showToast('error', t('requests.convertError'));
    }
  };

  const handleSaveProperty = async () => {
    if (!request || !user || !request.address_formatted) return;
    try {
      const addressParts = request.address_formatted.split(',').map(s => s.trim());
      const name = addressParts[0] || request.address_formatted;
      const { error } = await mutate({
        table: 'properties',
        operation: 'insert',
        data: {
          user_id: user.id,
          client_id: request.client_id,
          name,
          address_formatted: request.address_formatted,
          address_street: addressParts[0] || null,
          address_city: addressParts[1] || null,
          address_state: addressParts[2] || null,
          address_lat: request.address_lat,
          address_lng: request.address_lng,
        },
        cacheKeys: [`request_detail:${id}`],
      });
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('requestDetail.propertySaved'));
      setPropertySaved(true);
      setMatchedProperty({ id: 'saved', name });
      refresh();
    } catch (error) {
      secureLog.error('Error saving property:', error);
      showToast('error', t('requestDetail.propertySaveError'));
    }
  };

  // ================================================================
  // FORMATTING
  // ================================================================
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(dateLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('requestDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}><ListSkeleton /></View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('requestDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState icon="mail-outline" title={t('requestDetail.notFound')} description={t('requestDetail.notFoundDesc')} />
      </SafeAreaView>
    );
  }

  const reqColors = statusColors[request.status] || statusColors.new;
  const clientName = request.client?.name || request.name || t('requests.unknown');
  const clientEmail = request.client?.email || request.email;
  const clientPhone = (request.client as any)?.phone || request.phone;
  const desc = request.project_description || request.description;
  const budget = request.budget_range || request.budget;
  const isActive = request.status === 'new' || request.status === 'reviewing';
  const isAccepted = request.status === 'accepted' || request.status === 'converted';

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{request.title}</Text>
          <View style={[styles.headerStatusBadge, { backgroundColor: reqColors.bg }]}>
            <Text style={[styles.headerStatusText, { color: reqColors.text }]}>
              {getStatusLabel(request.status)}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Project Description Card — top priority */}
        {desc ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('requestDetail.projectDescription')}</Text>
            </View>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{desc}</Text>
          </View>
        ) : null}

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

          {request.client?.id ? (
            <TouchableOpacity
              style={[styles.viewClientButton, { borderColor: colors.border }]}
              onPress={() => router.push(`/(app)/client-detail?id=${request.client!.id}` as any)}
            >
              <Text style={[styles.viewClientText, { color: colors.primary }]}>{t('requestDetail.viewClient')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Details Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {budget ? (
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('requestDetail.budget')}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{budget}</Text>
            </View>
          ) : null}

          {(request.deadline || request.timeline) ? (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                {request.deadline ? t('requestDetail.deadline') : t('requestDetail.timeline')}
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {request.deadline
                  ? new Date(request.deadline).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
                  : request.timeline}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('requestDetail.received')}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(request.created_at)}</Text>
          </View>
        </View>

        {/* Location Card */}
        {request.address_formatted ? (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={matchedProperty ? () => router.push({ pathname: '/(app)/property-detail', params: { id: matchedProperty.id } } as any) : undefined}
            activeOpacity={matchedProperty ? 0.7 : 1}
            disabled={!matchedProperty}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name={matchedProperty ? 'home-outline' : 'location-outline'} size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {matchedProperty ? matchedProperty.name : t('requestDetail.location')}
              </Text>
              {matchedProperty && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />}
            </View>
            <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
              {request.address_formatted}
            </Text>
            <View style={styles.locationActions}>
              <TouchableOpacity
                style={[styles.navigateButton, { backgroundColor: colors.primary }]}
                onPress={() => openInMaps(request.address_formatted!, request.address_lat, request.address_lng)}
              >
                <Ionicons name="navigate-outline" size={16} color="#fff" />
                <Text style={styles.navigateButtonText}>{t('requestDetail.navigate')}</Text>
              </TouchableOpacity>
              {!matchedProperty && !propertySaved && (
                <TouchableOpacity
                  style={[styles.savePropertyButton, { borderColor: colors.primary }]}
                  onPress={handleSaveProperty}
                >
                  <Ionicons name="home-outline" size={16} color={colors.primary} />
                  <Text style={[styles.savePropertyText, { color: colors.primary }]}>{t('requestDetail.saveProperty')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Action Buttons */}
        {isActive && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionGrid}>
              {request.status === 'new' && (
                <Button
                  title={t('requestDetail.review')}
                  onPress={() => promptStatusUpdate('reviewing')}
                  variant="secondary"
                  loading={updatingStatus}
                  style={styles.actionButton}
                />
              )}
              <Button
                title={t('requestDetail.createProposal')}
                onPress={handleConvertToProject}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                title={t('requests.requestInfo')}
                onPress={openMessages}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                title={t('requestDetail.decline')}
                onPress={() => promptStatusUpdate('declined')}
                variant="ghost"
                loading={updatingStatus}
                style={styles.actionButton}
              />
            </View>
            <Button
              title={t('requestDetail.accept')}
              onPress={() => promptStatusUpdate('accepted')}
              loading={updatingStatus}
              style={styles.acceptButton}
            />
          </View>
        )}

        {isAccepted && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionGrid}>
              <Button
                title={t('requestDetail.createProposal')}
                onPress={handleConvertToProject}
                style={styles.actionButton}
              />
              <Button
                title={t('requests.requestInfo')}
                onPress={openMessages}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                title={t('requestDetail.archive')}
                onPress={() => promptStatusUpdate('archived')}
                variant="secondary"
                loading={updatingStatus}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}

        {/* Messages Card */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={openMessages}
          activeOpacity={0.7}
        >
          <View style={styles.messagesCardRow}>
            <View style={styles.messagesCardLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('requestDetail.messages')}
              </Text>
              {messageCount > 0 && (
                <View style={[styles.messageBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.messageBadgeText}>{messageCount}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* Metadata footer */}
        <View style={styles.metadataFooter}>
          <Text style={[styles.metadataText, { color: colors.textTertiary }]}>
            {t('requestDetail.requestId')}: {request.id.slice(0, 8)}...
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmVisible}
        title={t('requestDetail.confirmTitle')}
        message={getConfirmMessage()}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        variant={confirmAction === 'declined' ? 'danger' : 'default'}
        onConfirm={handleStatusUpdate}
        onCancel={() => setConfirmVisible(false)}
      />
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
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '600' },
  headerStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  headerStatusText: { fontSize: FontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },

  // Cards
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
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
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  detailLabel: { fontSize: FontSizes.sm, width: 70 },
  detailValue: { fontSize: FontSizes.sm, fontWeight: '500', flex: 1 },

  // Location
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '600' },
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
  acceptButton: { marginTop: Spacing.sm },

  // Messages card
  messagesCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagesCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  messageBadge: {
    minWidth: 22, height: 22,
    borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  messageBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },

  // Metadata
  metadataFooter: { paddingVertical: Spacing.md, alignItems: 'center' },
  metadataText: { fontSize: FontSizes.xs },
});
