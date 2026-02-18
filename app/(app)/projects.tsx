import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import {
  SearchBar, FilterChips, Badge, Avatar, EmptyState,
  Modal, Input, Button, Select, DatePicker, ListSkeleton,
  StatusBadge, showToast,
} from '@/components';
import type { ProjectWithRelations, Client } from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';
import { secureLog } from '@/lib/security';

export default function ProjectsScreen() {
  const router = useRouter();
  const { create, filter } = useLocalSearchParams<{ create?: string; filter?: string }>();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();

  const [clients, setClients] = useState<Client[]>([]);
  const { mutate } = useOfflineMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(filter || 'all');

  const { data: projects, loading, refreshing, refresh } = useOfflineData<ProjectWithRelations[]>(
    'projects',
    async () => {
      let query = supabase
        .from('projects')
        .select('*, client:clients(id, name, email)')
        .order('created_at', { ascending: false });

      if (filterStatus === 'archived') {
        query = query.eq('status', 'archived' as any);
      } else if (filterStatus === 'needs_approval') {
        query = query.eq('status', 'active')
          .or('approval_status.is.null,approval_status.eq.not_required,approval_status.eq.declined');
      } else if (filterStatus === 'pending') {
        query = query.eq('status', 'active').eq('approval_status', 'pending');
      } else if (filterStatus === 'approved') {
        query = query.eq('status', 'active').eq('approval_status', 'approved');
      } else if (filterStatus === 'in_progress') {
        query = query.eq('status', 'active').eq('project_stage', 'in_progress' as any);
      } else if (filterStatus === 'completed') {
        query = query.eq('status', 'active').eq('project_stage', 'completed' as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [filterStatus] },
  );
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    project_stage: 'planning',
    approval_status: 'draft',
    budget_total: '',
    deadline: null as Date | null,
    estimated_duration_days: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // i18n-safe options inside component
  const filterOptions = useMemo(() => [
    { key: 'all', label: t('projects.allActive') },
    { key: 'needs_approval', label: t('projects.needsApproval') },
    { key: 'pending', label: t('projects.pending') },
    { key: 'approved', label: t('projects.approved') },
    { key: 'in_progress', label: t('projectDetail.inProgress') },
    { key: 'completed', label: t('projectDetail.stageCompleted') },
    { key: 'archived', label: t('status.archived') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { key: 'newest', label: t('projects.newest') },
    { key: 'oldest', label: t('projects.oldest') },
    { key: 'nameAZ', label: t('projects.nameAZ') },
    { key: 'nameZA', label: t('projects.nameZA') },
    { key: 'deadline', label: t('projects.deadline') },
  ], [t]);

  const stageOptions = useMemo(() => [
    { key: 'planning', label: t('projectDetail.planning') },
    { key: 'in_progress', label: t('projectDetail.inProgress') },
    { key: 'completed', label: t('projectDetail.stageCompleted') },
  ], [t]);

  const approvalOptions = useMemo(() => [
    { key: 'draft', label: t('projects.draft') },
    { key: 'pending', label: t('projects.pending') },
    { key: 'approved', label: t('projects.approved') },
    { key: 'rejected', label: t('projects.rejected') },
  ], [t]);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error: any) {
      secureLog.error('Error fetching clients:', error);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('projects.nameRequired');
    }

    if (!formData.client_id) {
      errors.client_id = t('projects.clientRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddProject = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setSaving(true);
    try {
      const newProject = {
        user_id: user.id,
        client_id: formData.client_id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        status: 'active',
        project_stage: formData.project_stage,
        approval_status: formData.approval_status,
        budget_total: formData.budget_total ? parseFloat(formData.budget_total) : null,
        deadline: formData.deadline?.toISOString() || null,
        estimated_duration_days: formData.estimated_duration_days ? parseInt(formData.estimated_duration_days) : null,
      } as any;

      const { error } = await mutate({
        table: 'projects',
        operation: 'insert',
        data: newProject,
        cacheKeys: ['projects'],
      });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      refresh();
      showToast('success', t('projects.projectAdded'));
    } catch (error: any) {
      secureLog.error('Error adding project:', error);
      showToast('error', error.message || t('projects.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = (project: ProjectWithRelations) => {
    Alert.alert(
      t('projects.deleteTitle'),
      t('projects.deleteMessage', { name: project.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'projects',
                operation: 'delete',
                matchValue: project.id,
                cacheKeys: ['projects'],
              });

              if (error) throw error;

              refresh();
              showToast('success', t('projects.projectDeleted'));
            } catch (error: any) {
              secureLog.error('Error deleting project:', error);
              showToast('error', error.message || t('projects.loadError'));
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      client_id: '',
      project_stage: 'planning',
      approval_status: 'draft',
      budget_total: '',
      deadline: null,
      estimated_duration_days: '',
    });
    setFormErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Auto-open create modal or set filter when navigated with params
  useEffect(() => {
    if (create === 'true') {
      openAddModal();
      router.setParams({ create: '' });
    }
    if (filter) {
      setFilterStatus(filter);
      router.setParams({ filter: '' });
    }
  }, [create, filter]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = (projects ?? []).filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(query) ||
        (project.description?.toLowerCase().includes(query) ?? false) ||
        ((project.client as any)?.name?.toLowerCase().includes(query) ?? false);
      return matchesSearch;
    });

    // Apply sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'nameAZ':
          return a.name.localeCompare(b.name);
        case 'nameZA':
          return b.name.localeCompare(a.name);
        case 'deadline':
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [projects, searchQuery, sortBy]);

  const formatCurrency = useCallback((amount: number | null) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }, [locale]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, [locale]);

  const clientOptions = useMemo(() =>
    clients.map((c) => ({ key: c.id, label: c.email ? `${c.name} (${c.email})` : c.name })),
    [clients]
  );

  const renderProject = useCallback(({ item }: { item: ProjectWithRelations }) => (
    <TouchableOpacity
      style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/(app)/project-detail', params: { id: item.id } } as any)}
      onLongPress={() => handleDeleteProject(item)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.badges}>
          <StatusBadge status={(item as any).project_stage || 'planning'} size="sm" />
          {item.approval_status && (item.approval_status as string) !== 'not_required' && (
            <StatusBadge status={item.approval_status} size="sm" />
          )}
          {(item.status as string) === 'archived' && (
            <StatusBadge status="archived" size="sm" />
          )}
        </View>
      </View>

      <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>

      {item.description && (
        <Text style={[styles.projectDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.projectMeta}>
        <View style={styles.clientInfo}>
          <Avatar name={(item.client as any)?.name} size="sm" />
          <Text style={[styles.clientName, { color: colors.textSecondary }]}>
            {(item.client as any)?.name || t('projects.noClient')}
          </Text>
        </View>

        {item.budget_total != null && item.budget_total > 0 && (
          <Text style={[styles.budgetText, { color: colors.success }]}>
            {formatCurrency(item.budget_total)}
          </Text>
        )}
      </View>

      <View style={[styles.projectFooter, { borderTopColor: colors.borderLight }]}>
        {item.deadline && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {formatDate(item.deadline)}
            </Text>
          </View>
        )}
        {item.estimated_duration_days != null && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {t('projects.days', { count: item.estimated_duration_days })}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  ), [colors, t, router, handleDeleteProject, formatCurrency, formatDate]);

  const renderFormContent = () => (
    <View>
      <Input
        label={`${t('projects.name')} *`}
        placeholder={t('projects.namePlaceholder')}
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        error={formErrors.name}
        leftIcon="folder-outline"
      />

      <Select
        label={`${t('projects.client')} *`}
        placeholder={t('projects.selectClient')}
        options={clientOptions}
        value={formData.client_id}
        onChange={(value) => setFormData({ ...formData, client_id: value })}
        error={formErrors.client_id}
        searchable
      />

      <Input
        label={t('projects.description')}
        placeholder={t('projects.descriptionPlaceholder')}
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Select
            label={t('projectDetail.stage')}
            options={stageOptions}
            value={formData.project_stage}
            onChange={(value) => setFormData({ ...formData, project_stage: value })}
          />
        </View>
        <View style={styles.halfWidth}>
          <Select
            label={t('projects.approval')}
            options={approvalOptions}
            value={formData.approval_status}
            onChange={(value) => setFormData({ ...formData, approval_status: value })}
          />
        </View>
      </View>

      <Input
        label={t('projects.budget')}
        placeholder={t('projects.budgetPlaceholder')}
        value={formData.budget_total}
        onChangeText={(text) => setFormData({ ...formData, budget_total: text.replace(/[^0-9.]/g, '') })}
        leftIcon="cash-outline"
        keyboardType="decimal-pad"
      />

      <DatePicker
        label={t('projects.deadlineLabel')}
        value={formData.deadline}
        onChange={(date) => setFormData({ ...formData, deadline: date })}
        placeholder={t('projects.deadlineLabel')}
        minDate={new Date()}
      />

      <Input
        label={t('projects.estimatedDuration')}
        placeholder={t('projects.estimatedDurationPlaceholder')}
        value={formData.estimated_duration_days}
        onChangeText={(text) => setFormData({ ...formData, estimated_duration_days: text.replace(/[^0-9]/g, '') })}
        leftIcon="time-outline"
        keyboardType="number-pad"
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: colors.text }]}>{t('projects.title')}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={5} />
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
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t('projects.title')}</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{(projects ?? []).length}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search + Filters + Sort + Project List */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
          <View style={styles.searchContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('projects.searchPlaceholder')}
            />
          </View>
          <View style={styles.filterContainer}>
            <FilterChips
              options={filterOptions}
              selected={filterStatus}
              onSelect={setFilterStatus}
              scrollable
            />
          </View>
          <View style={styles.filterContainer}>
            <FilterChips
              options={sortOptions}
              selected={sortBy}
              onSelect={setSortBy}
            />
          </View>
        </Animated.View>

        <Animated.FlatList
          data={filteredProjects}
          renderItem={renderProject}
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
              icon="folder-outline"
              title={t('projects.noProjects')}
              description={
                searchQuery
                  ? t('projects.noProjectsSearch')
                  : t('projects.noProjectsDesc')
              }
              actionLabel={!searchQuery ? t('projects.addProject') : undefined}
              onAction={!searchQuery ? openAddModal : undefined}
            />
          }
        />
      </View>

      {/* Add Project Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('projects.addProject')}
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowAddModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('projects.createProject')}
            onPress={handleAddProject}
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
  headerLeft: {
    flex: 1,
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
    minWidth: 26,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  projectCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  projectHeader: {
    marginBottom: Spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  projectName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  projectDescription: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clientName: {
    fontSize: FontSizes.sm,
  },
  budgetText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  projectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSizes.sm,
  },
  chevron: {
    marginLeft: 'auto',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
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
});
