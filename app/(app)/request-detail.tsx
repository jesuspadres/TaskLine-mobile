import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
  TextInput,
  Modal as RNModal,
  KeyboardAvoidingView,
  Platform,
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
import { useSubscription } from '@/hooks/useSubscription';
import { analyzeRequest, draftProject, respondToClient, submitAiFeedback } from '@/lib/websiteApi';
import type { AiAnalysis } from '@/lib/websiteApi';

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

interface LinkedProject {
  id: string;
  name: string;
  status: string;
  project_stage: string | null;
  budget_total: number | null;
}

interface RequestDetailData {
  request: RequestData | null;
  messageCount: number;
  matchedProperty: { id: string; name: string } | null;
  existingAnalysis: AiAnalysis | null;
  linkedProjects: LinkedProject[];
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const { isPlus, isBusiness } = useSubscription();
  const scrollViewRef = useRef<ScrollView>(null);
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';
  const canUseAi = isPlus || isBusiness;

  const REVIEWING_STATUSES = ['reviewing', 'contacted', 'quoted', 'needs_info'];
  const ACCEPTED_STATUSES = ['accepted', 'converted'];

  const statusColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    contacted: { bg: colors.warningLight, text: colors.warning },
    quoted: { bg: colors.warningLight, text: colors.warning },
    needs_info: { bg: colors.warningLight, text: colors.warning },
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

      // Fetch linked projects
      let linkedProjects: LinkedProject[] = [];
      try {
        const { data: projData } = await (supabase.from('projects') as any)
          .select('id, name, status, project_stage, budget_total')
          .eq('request_id', id as string)
          .order('created_at', { ascending: false });
        if (projData) linkedProjects = projData;
      } catch {
        // No linked projects — that's fine
      }

      // Fetch existing AI analysis
      let existingAnalysis: AiAnalysis | null = null;
      try {
        const { data: analysisData } = await (supabase.from('ai_analyses') as any)
          .select('*')
          .eq('request_id', id as string)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (analysisData) existingAnalysis = analysisData;
      } catch {
        // No existing analysis — that's fine
      }

      return {
        request: req as RequestData,
        messageCount: msgCount,
        matchedProperty: matched,
        existingAnalysis,
        linkedProjects,
      };
    },
    { enabled: !!id },
  );
  const { mutate } = useOfflineMutation();

  const request = requestData?.request ?? null;
  const messageCount = requestData?.messageCount ?? 0;
  const linkedProjects = requestData?.linkedProjects ?? [];
  const hasLinkedProject = linkedProjects.length > 0;
  const [matchedProperty, setMatchedProperty] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [propertySaved, setPropertySaved] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');

  // Sync matchedProperty from requestData into local state so save-property can update it
  useEffect(() => {
    if (requestData?.matchedProperty) {
      setMatchedProperty(requestData.matchedProperty);
    }
  }, [requestData?.matchedProperty]);

  // Restore existing AI analysis (show collapsed)
  useEffect(() => {
    if (requestData?.existingAnalysis && !aiAnalysis) {
      setAiAnalysis(requestData.existingAnalysis);
      setAiCollapsed(true);
    }
  }, [requestData?.existingAnalysis]);

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
      showToast('success', confirmAction === 'archived' ? t('requests.markedComplete') : t('requestDetail.statusUpdated'));
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
      case 'archived': return t('requestDetail.confirmMarkComplete');
      default: return '';
    }
  };

  const handleConvertToProject = async () => {
    if (!request || !user) return;
    try {
      const { data: newProject, error } = await supabase.from('projects').insert({
        name: request.title,
        description: request.description || request.project_description || null,
        client_id: request.client_id,
        status: 'active',
        request_id: request.id,
        user_id: user.id,
      } as any).select('id').single();
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('requests.convertSuccess'));
      refresh();
      if (newProject) {
        router.push({ pathname: '/(app)/project-detail', params: { id: newProject.id } } as any);
      }
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
  // AI ACTIONS
  // ================================================================
  const handleAiAnalyze = async () => {
    if (!request) return;
    setAiAnalyzing(true);
    try {
      const { analysis } = await analyzeRequest(request.id);
      setAiAnalysis(analysis);
      haptics.notification(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      secureLog.error('AI analysis error:', error);
      showToast('error', error.message || t('ai.analysisError'));
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleAiDraftProject = async () => {
    if (!request || !user || !aiAnalysis) return;
    setAiDrafting(true);
    try {
      const { draft } = await draftProject(request.id, aiAnalysis.id);
      // Create the project in DB
      const { data: newProject, error: projError } = await supabase.from('projects').insert({
        name: draft.name,
        description: draft.description,
        client_id: request.client_id,
        status: 'active',
        project_stage: 'planning',
        budget_total: draft.budgetTotal,
        estimated_duration_days: draft.estimatedDurationDays,
        request_id: request.id,
        user_id: user.id,
      } as any).select('id').single();
      if (projError) throw projError;
      // Insert line items
      if (draft.lineItems?.length && newProject) {
        const items = draft.lineItems.map((li) => ({
          project_id: newProject.id,
          item_type: li.type,
          description: li.description,
          quantity: 1,
          unit_price: li.amount,
          total_price: li.amount,
        }));
        await supabase.from('project_line_items').insert(items as any);
      }
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('ai.projectCreated'));
      router.push({ pathname: '/(app)/project-detail', params: { id: newProject.id } } as any);
    } catch (error: any) {
      secureLog.error('AI draft project error:', error);
      showToast('error', error.message || t('ai.draftError'));
    } finally {
      setAiDrafting(false);
    }
  };

  const handleAiFollowUp = async () => {
    if (!request) return;
    setAiResponding(true);
    try {
      const { draft } = await respondToClient(request.id);
      setFollowUpDraft(draft || '');
      setShowFollowUpModal(true);
    } catch (error: any) {
      secureLog.error('AI follow-up error:', error);
      showToast('error', error.message || t('ai.respondError'));
    } finally {
      setAiResponding(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!request || !followUpDraft.trim()) return;
    setAiResponding(true);
    try {
      await respondToClient(request.id, followUpDraft.trim(), true);
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('success', t('ai.followUpSent'));
      setShowFollowUpModal(false);
      setFollowUpDraft('');
      refresh();
    } catch (error: any) {
      secureLog.error('AI send follow-up error:', error);
      showToast('error', error.message || t('ai.respondError'));
    } finally {
      setAiResponding(false);
    }
  };

  const handleAiFeedback = async (feedback: 'helpful' | 'not_helpful') => {
    if (!aiAnalysis) return;
    try {
      await submitAiFeedback(aiAnalysis.id, feedback);
      setAiAnalysis({ ...aiAnalysis, feedback });
      showToast('success', t('ai.thanksFeedback'));
    } catch (error: any) {
      secureLog.error('AI feedback error:', error);
    }
  };

  const toggleAiCollapsed = () => setAiCollapsed(prev => !prev);

  const sentimentColors = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    positive: { bg: colors.successLight, text: colors.success },
    neutral: { bg: colors.infoLight, text: colors.info },
    cautious: { bg: colors.warningLight, text: colors.warning },
    urgent: { bg: colors.errorLight || colors.warningLight, text: colors.error },
  }), [colors]);

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
  const isActive = request.status === 'new' || REVIEWING_STATUSES.includes(request.status);
  const isAccepted = ACCEPTED_STATUSES.includes(request.status);

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

        {/* Linked Projects */}
        {linkedProjects.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="folder-open-outline" size={18} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('requestDetail.linkedProjects')} ({linkedProjects.length})
              </Text>
            </View>
            {linkedProjects.map((proj) => {
              const stageKey = proj.project_stage === 'completed' ? 'completed'
                : proj.project_stage === 'in_progress' ? 'in_progress'
                : proj.status === 'archived' ? 'archived'
                : 'planning';
              const stageColors = stageKey === 'completed'
                ? { bg: colors.successLight, text: colors.success }
                : stageKey === 'in_progress'
                ? { bg: colors.infoLight, text: colors.info }
                : stageKey === 'archived'
                ? { bg: colors.surfaceSecondary, text: colors.textTertiary }
                : { bg: colors.warningLight, text: colors.warning };
              return (
                <TouchableOpacity
                  key={proj.id}
                  style={[styles.linkedProjectItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: '/(app)/project-detail', params: { id: proj.id } } as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.linkedProjectRow}>
                    <Text style={[styles.linkedProjectName, { color: colors.text }]} numberOfLines={1}>{proj.name}</Text>
                    <View style={[styles.linkedProjectBadge, { backgroundColor: stageColors.bg }]}>
                      <Text style={[styles.linkedProjectBadgeText, { color: stageColors.text }]}>
                        {t(`requestDetail.projectStage.${stageKey}`)}
                      </Text>
                    </View>
                  </View>
                  {proj.budget_total != null && (
                    <Text style={[styles.linkedProjectBudget, { color: colors.textSecondary }]}>
                      ${proj.budget_total.toLocaleString()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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
              {!hasLinkedProject && (
                <Button
                  title={t('requestDetail.createProposal')}
                  onPress={handleConvertToProject}
                  variant="secondary"
                  style={styles.actionButton}
                />
              )}
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
              {!hasLinkedProject && (
                <Button
                  title={t('requestDetail.createProposal')}
                  onPress={handleConvertToProject}
                  style={styles.actionButton}
                />
              )}
              <Button
                title={t('requests.requestInfo')}
                onPress={openMessages}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                title={t('requestDetail.markComplete')}
                onPress={() => promptStatusUpdate('archived')}
                variant="secondary"
                loading={updatingStatus}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}

        {/* AI Analysis Section */}
        {canUseAi && (isActive || isAccepted) && !aiAnalysis && (
          <TouchableOpacity
            style={[styles.aiAnalyzeButton, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
            onPress={handleAiAnalyze}
            disabled={aiAnalyzing}
          >
            {aiAnalyzing ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.aiAnalyzeText, { color: colors.primary }]}>{t('ai.analyzing')}</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.aiAnalyzeText, { color: colors.primary }]}>{t('ai.analyzeWithAi')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!canUseAi && (isActive || isAccepted) && (
          <View style={[styles.aiUpgradeCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="sparkles-outline" size={20} color={colors.textTertiary} />
            <View style={styles.aiUpgradeContent}>
              <Text style={[styles.aiUpgradeTitle, { color: colors.text }]}>{t('ai.upgradeRequired')}</Text>
              <Text style={[styles.aiUpgradeDesc, { color: colors.textSecondary }]}>{t('ai.upgradeRequiredDesc')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.aiUpgradeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/plans' as any)}
            >
              <Text style={styles.aiUpgradeBtnText}>{t('ai.upgrade')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {aiAnalysis && (
          <View style={[styles.aiCard, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
            {/* Collapsible Header */}
            <TouchableOpacity style={styles.aiCardHeader} onPress={toggleAiCollapsed} activeOpacity={0.7}>
              <View style={styles.aiCardHeaderLeft}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>{t('ai.analysisComplete')}</Text>
              </View>
              <Ionicons name={aiCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            {!aiCollapsed && (
              <>
                {/* Summary */}
                <Text style={[styles.aiSummary, { color: colors.textSecondary }]}>{aiAnalysis.summary}</Text>

                {/* Metrics Row */}
                <View style={styles.aiMetricsRow}>
                  <View style={[styles.aiMetric, { backgroundColor: (sentimentColors[aiAnalysis.sentiment] || sentimentColors.neutral).bg }]}>
                    <Text style={[styles.aiMetricLabel, { color: colors.textTertiary }]}>{t('ai.sentiment')}</Text>
                    <Text style={[styles.aiMetricValue, { color: (sentimentColors[aiAnalysis.sentiment] || sentimentColors.neutral).text }]}>
                      {t(`ai.sentiment${aiAnalysis.sentiment.charAt(0).toUpperCase() + aiAnalysis.sentiment.slice(1)}`)}
                    </Text>
                  </View>
                  <View style={[styles.aiMetric, { backgroundColor: colors.infoLight }]}>
                    <Text style={[styles.aiMetricLabel, { color: colors.textTertiary }]}>{t('ai.estimatedValue')}</Text>
                    <Text style={[styles.aiMetricValue, { color: colors.text }]}>{aiAnalysis.estimated_value || '—'}</Text>
                  </View>
                  <View style={[styles.aiMetric, { backgroundColor: colors.warningLight }]}>
                    <Text style={[styles.aiMetricLabel, { color: colors.textTertiary }]}>{t('ai.priorityScore')}</Text>
                    <Text style={[styles.aiMetricValue, { color: colors.text }]}>{aiAnalysis.priority_score}/10</Text>
                  </View>
                </View>

                {/* Recommended Actions */}
                {aiAnalysis.recommended_actions?.length > 0 && (
                  <View style={styles.aiSection}>
                    <Text style={[styles.aiSectionTitle, { color: colors.text }]}>{t('ai.recommendedActions')}</Text>
                    {aiAnalysis.recommended_actions.map((action, idx) => (
                      <View key={idx} style={[styles.aiActionItem, { backgroundColor: colors.background }]}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                        <View style={styles.aiActionContent}>
                          <Text style={[styles.aiActionText, { color: colors.text }]}>{action.action}</Text>
                          <Text style={[styles.aiActionReason, { color: colors.textTertiary }]}>{action.reason}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Follow-up Questions */}
                {aiAnalysis.follow_up_questions?.length > 0 && (
                  <View style={styles.aiSection}>
                    <Text style={[styles.aiSectionTitle, { color: colors.text }]}>{t('ai.followUpQuestions')}</Text>
                    <View style={styles.aiQuestionChips}>
                      {aiAnalysis.follow_up_questions.map((q, idx) => (
                        <View key={idx} style={[styles.aiQuestionChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.aiQuestionText, { color: colors.textSecondary }]}>{q}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* AI Action Buttons */}
                <View style={styles.aiActionsColumn}>
                  {!aiAnalysis.project_created && !hasLinkedProject && (
                    <TouchableOpacity
                      style={[styles.aiActionBtn, { backgroundColor: colors.primary }]}
                      onPress={handleAiDraftProject}
                      disabled={aiDrafting}
                    >
                      {aiDrafting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="folder-outline" size={16} color="#fff" />
                          <Text style={styles.aiActionBtnText}>{t('ai.draftProjectWithAi')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.aiActionBtn, { backgroundColor: colors.info }]}
                    onPress={handleAiFollowUp}
                    disabled={aiResponding}
                  >
                    {aiResponding && !showFollowUpModal ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send-outline" size={16} color="#fff" />
                        <Text style={styles.aiActionBtnText}>{t('ai.draftFollowUp')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Feedback */}
                {!aiAnalysis.feedback ? (
                  <View style={[styles.aiFeedbackRow, { borderTopColor: colors.borderLight }]}>
                    <TouchableOpacity style={[styles.aiFeedbackBtn, { borderColor: colors.border }]} onPress={() => handleAiFeedback('helpful')}>
                      <Ionicons name="thumbs-up-outline" size={16} color={colors.success} />
                      <Text style={[styles.aiFeedbackText, { color: colors.textSecondary }]}>{t('ai.helpful')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.aiFeedbackBtn, { borderColor: colors.border }]} onPress={() => handleAiFeedback('not_helpful')}>
                      <Ionicons name="thumbs-down-outline" size={16} color={colors.error} />
                      <Text style={[styles.aiFeedbackText, { color: colors.textSecondary }]}>{t('ai.notHelpful')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.aiFeedbackRow, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.aiFeedbackThanks, { color: colors.textTertiary }]}>{t('ai.thanksFeedback')}</Text>
                  </View>
                )}
              </>
            )}
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
      {/* Follow-up Compose Modal */}
      <RNModal
        visible={showFollowUpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFollowUpModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.followUpOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowFollowUpModal(false)}
          />
          <View style={[styles.followUpSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.followUpHeader}>
              <Text style={[styles.followUpTitle, { color: colors.text }]}>{t('ai.followUpDraft')}</Text>
              <TouchableOpacity onPress={() => setShowFollowUpModal(false)}>
                <Ionicons name="close" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.followUpScrollArea} keyboardShouldPersistTaps="handled">
              <TextInput
                style={[styles.followUpInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={followUpDraft}
                onChangeText={setFollowUpDraft}
                placeholder={t('ai.followUpPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </ScrollView>
            <TouchableOpacity
              style={[styles.followUpSendBtn, { backgroundColor: colors.primary }, aiResponding && { opacity: 0.7 }]}
              onPress={handleSendFollowUp}
              disabled={aiResponding || !followUpDraft.trim()}
            >
              {aiResponding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.followUpSendText}>{t('ai.editAndSend')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

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

  // Linked Projects
  linkedProjectItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  linkedProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  linkedProjectName: { fontSize: FontSizes.sm, fontWeight: '600', flex: 1 },
  linkedProjectBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  linkedProjectBadgeText: { fontSize: 10, fontWeight: '600' },
  linkedProjectBudget: { fontSize: FontSizes.xs, marginTop: 4 },

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

  // AI Analyze button
  aiAnalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  aiAnalyzeText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // AI Upgrade card
  aiUpgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  aiUpgradeContent: { flex: 1 },
  aiUpgradeTitle: { fontSize: FontSizes.xs, fontWeight: '700' },
  aiUpgradeDesc: { fontSize: FontSizes.xs, lineHeight: 16, marginTop: 2 },
  aiUpgradeBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg },
  aiUpgradeBtnText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },

  // AI Analysis card
  aiCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  aiCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  aiCardTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  aiSummary: { fontSize: FontSizes.sm, lineHeight: 20, marginBottom: Spacing.md },

  // Metrics
  aiMetricsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  aiMetric: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  aiMetricLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  aiMetricValue: { fontSize: FontSizes.xs, fontWeight: '700' },

  // Actions & Questions
  aiSection: { marginBottom: Spacing.md },
  aiSectionTitle: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm },
  aiActionItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  aiActionContent: { flex: 1 },
  aiActionText: { fontSize: FontSizes.sm, fontWeight: '500' },
  aiActionReason: { fontSize: FontSizes.xs, lineHeight: 16, marginTop: 2 },
  aiQuestionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.sm },
  aiQuestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  aiQuestionText: { fontSize: FontSizes.xs },

  // AI Action buttons
  aiActionsColumn: { gap: Spacing.sm, marginBottom: Spacing.md },
  aiActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    minHeight: 40,
  },
  aiActionBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },

  // Feedback
  aiFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  aiFeedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  aiFeedbackText: { fontSize: FontSizes.xs },
  aiFeedbackThanks: { fontSize: FontSizes.xs, fontStyle: 'italic' },

  // Follow-up modal
  followUpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  followUpSheet: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  followUpTitle: { fontSize: FontSizes.lg, fontWeight: '600' },
  followUpScrollArea: {
    maxHeight: 300,
  },
  followUpInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSizes.sm,
    minHeight: 160,
    lineHeight: 22,
  },
  followUpSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    minHeight: 48,
  },
  followUpSendText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },
});
