import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import {
  SearchBar, FilterChips, Badge, Avatar, EmptyState,
  Modal, Input, Button, ListSkeleton, showToast,
} from '@/components';
import type { Client, ClientInsert } from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';
import { useRouter, useLocalSearchParams } from 'expo-router';

type SortKey = 'newest' | 'oldest' | 'nameAZ' | 'nameZA';

export default function ClientsScreen() {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const router = useRouter();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnboarded, setFilterOnboarded] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Edit/View state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const filterOptions = useMemo(() => [
    { key: 'all', label: t('clients.all') },
    { key: 'yes', label: t('clients.active') },
    { key: 'no', label: t('clients.pending') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { key: 'newest', label: t('clients.newest') },
    { key: 'oldest', label: t('clients.oldest') },
    { key: 'nameAZ', label: t('clients.nameAZ') },
    { key: 'nameZA', label: t('clients.nameZA') },
  ], [t]);

  const fetchClients = useCallback(async () => {
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterOnboarded === 'yes') {
        query = query.eq('onboarded', true);
      } else if (filterOnboarded === 'no') {
        query = query.eq('onboarded', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      showToast('error', t('clients.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterOnboarded, t]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClients();
  }, [fetchClients]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('clients.nameRequired');
    }

    if (!formData.email.trim()) {
      errors.email = t('clients.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('clients.invalidEmail');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddClient = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setSaving(true);
    try {
      const newClient: Record<string, any> = {
        user_id: user.id,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        company: formData.company.trim() || null,
        onboarded: false,
      };

      const { error } = await supabase.from('clients').insert(newClient as any);

      if (error) throw error;

      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '', company: '' });
      setFormErrors({});
      fetchClients();
      showToast('success', t('clients.clientAdded'));
    } catch (error: any) {
      console.error('Error adding client:', error);
      showToast('error', error.message || t('clients.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditClient = async () => {
    if (!validateForm() || !selectedClient) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          company: formData.company.trim() || null,
        } as any)
        .eq('id', selectedClient.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedClient(null);
      setFormData({ name: '', email: '', phone: '', company: '' });
      setFormErrors({});
      fetchClients();
      showToast('success', t('clients.clientUpdated'));
    } catch (error: any) {
      console.error('Error updating client:', error);
      showToast('error', error.message || t('clients.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    Alert.alert(
      t('clients.deleteTitle'),
      t('clients.deleteMessage', { name: client.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', client.id);

              if (error) throw error;

              setShowEditModal(false);
              setSelectedClient(null);
              fetchClients();
              showToast('success', t('clients.clientDeleted'));
            } catch (error: any) {
              showToast('error', error.message || t('clients.loadError'));
            }
          },
        },
      ]
    );
  };

  const handleToggleOnboarded = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ onboarded: !client.onboarded })
        .eq('id', client.id);

      if (error) throw error;

      setSelectedClient({ ...client, onboarded: !client.onboarded });
      fetchClients();
    } catch (error: any) {
      showToast('error', error.message || t('clients.loadError'));
    }
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      company: client.company || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setFormData({ name: '', email: '', phone: '', company: '' });
    setFormErrors({});
    setShowAddModal(true);
  };

  // Auto-open create modal when navigated with create param
  useEffect(() => {
    if (create === 'true') {
      openAddModal();
      router.setParams({ create: '' });
    }
  }, [create]);

  const filteredAndSortedClients = useMemo(() => {
    let result = clients.filter((client) => {
      const query = searchQuery.toLowerCase();
      return (
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        (client.company?.toLowerCase().includes(query) ?? false) ||
        (client.phone?.toLowerCase().includes(query) ?? false)
      );
    });

    switch (sortBy) {
      case 'oldest':
        result = [...result].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case 'nameAZ':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nameZA':
        result = [...result].sort((a, b) => b.name.localeCompare(a.name));
        break;
      // 'newest' is the default order from the query
    }

    return result;
  }, [clients, searchQuery, sortBy]);

  const navigateToDetail = (client: Client) => {
    router.push({ pathname: '/(app)/client-detail', params: { id: client.id } });
  };

  const dateLocale = locale === 'es' ? 'es-ES' : 'en-US';

  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[styles.clientCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigateToDetail(item)}
      onLongPress={() => openEditModal(item)}
    >
      <Avatar name={item.name} size="lg" />
      <View style={styles.clientInfo}>
        <Text style={[styles.clientName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.clientEmail, { color: colors.textSecondary }]}>{item.email}</Text>
        {item.phone ? (
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.clientPhone, { color: colors.textTertiary }]}>{item.phone}</Text>
          </View>
        ) : item.company ? (
          <Text style={[styles.clientCompany, { color: colors.textTertiary }]}>{item.company}</Text>
        ) : null}
      </View>
      <View style={styles.clientMeta}>
        <Badge
          text={item.onboarded ? t('clients.active') : t('clients.pending')}
          variant={item.onboarded ? 'active' : 'pending'}
        />
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  const renderFormContent = () => (
    <View>
      <Input
        label={`${t('clients.name')} *`}
        placeholder={t('clients.namePlaceholder')}
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        error={formErrors.name}
        leftIcon="person-outline"
        autoCapitalize="words"
      />
      <Input
        label={`${t('clients.email')} *`}
        placeholder={t('clients.emailPlaceholder')}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        error={formErrors.email}
        leftIcon="mail-outline"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={t('clients.phone')}
        placeholder={t('clients.phonePlaceholder')}
        value={formData.phone}
        onChangeText={(text) => setFormData({ ...formData, phone: text })}
        leftIcon="call-outline"
        keyboardType="phone-pad"
      />
      <Input
        label={t('clients.company')}
        placeholder={t('clients.companyPlaceholder')}
        value={formData.company}
        onChangeText={(text) => setFormData({ ...formData, company: text })}
        leftIcon="business-outline"
        autoCapitalize="words"
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('clients.title')}</Text>
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
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t('clients.title')}</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{clients.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('clients.searchPlaceholder')}
        />
      </View>

      {/* Filters + Sort */}
      <View style={styles.filterContainer}>
        <FilterChips
          options={filterOptions}
          selected={filterOnboarded}
          onSelect={setFilterOnboarded}
        />
      </View>
      <View style={styles.sortRow}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortChip,
              { borderColor: colors.border },
              sortBy === option.key && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSortBy(option.key as SortKey)}
          >
            <Text style={[
              styles.sortChipText,
              { color: colors.textSecondary },
              sortBy === option.key && { color: '#fff' },
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Client List */}
      <FlatList
        data={filteredAndSortedClients}
        renderItem={renderClient}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={t('clients.noResults')}
            description={
              searchQuery
                ? t('clients.tryDifferentSearch')
                : t('clients.noClientsDesc')
            }
            actionLabel={!searchQuery ? t('clients.addClient') : undefined}
            onAction={!searchQuery ? openAddModal : undefined}
          />
        }
      />

      {/* Add Client Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('clients.addClient')}
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
            title={t('clients.addClient')}
            onPress={handleAddClient}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('clients.editClient')}
        size="full"
      >
        {renderFormContent()}

        {selectedClient && (
          <View style={[styles.statusToggle, { borderTopColor: colors.border }]}>
            <Text style={[styles.statusLabel, { color: colors.text }]}>{t('clients.clientStatus')}</Text>
            <TouchableOpacity
              style={[
                styles.statusButton,
                { backgroundColor: colors.surfaceSecondary },
                selectedClient.onboarded && { backgroundColor: colors.successLight },
              ]}
              onPress={() => handleToggleOnboarded(selectedClient)}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  { color: colors.textSecondary },
                  selectedClient.onboarded && { color: colors.success },
                ]}
              >
                {selectedClient.onboarded ? t('clients.active') : t('clients.pending')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.delete')}
            onPress={() => selectedClient && handleDeleteClient(selectedClient)}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title={t('common.cancel')}
            onPress={() => setShowEditModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleEditClient}
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
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  clientInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  clientName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  clientEmail: {
    fontSize: FontSizes.sm,
  },
  clientPhone: {
    fontSize: FontSizes.xs,
    marginLeft: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  clientCompany: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  clientMeta: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
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
  statusToggle: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  statusLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  statusButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
  },
  statusButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
});
