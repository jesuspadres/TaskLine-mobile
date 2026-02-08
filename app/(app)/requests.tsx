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
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ENV } from '@/lib/env';
import { Modal, Input, Button, Select, DatePicker, EmptyState } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';
import type { RequestWithClient, Client } from '@/lib/database.types';

type RequestStatus = 'all' | 'new' | 'reviewing' | 'converted' | 'declined';

const statusOptions = [
  { key: 'new', label: 'New' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'converted', label: 'Converted' },
  { key: 'declined', label: 'Declined' },
];

export default function RequestsScreen() {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<RequestWithClient[]>([]);
  const [filterStatus, setFilterStatus] = useState<RequestStatus>('all');
  const [clients, setClients] = useState<Client[]>([]);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithClient | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formStatus, setFormStatus] = useState('new');
  const [formBudget, setFormBudget] = useState('');
  const [formDeadline, setFormDeadline] = useState<Date | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const statusColors = useMemo(() => ({
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    converted: { bg: colors.successLight, text: colors.success },
    declined: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  }), [colors]);

  const fetchRequests = useCallback(async () => {
    try {
      let query = supabase
        .from('requests')
        .select('*, client:clients(id, name, email)')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to load requests');
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
    fetchRequests();
    fetchClients();
  }, [fetchRequests, fetchClients]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormClientId('');
    setFormStatus('new');
    setFormBudget('');
    setFormDeadline(null);
    setFormErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (request: RequestWithClient) => {
    setSelectedRequest(request);
    setFormTitle(request.title);
    setFormDescription(request.description || '');
    setFormClientId(request.client_id || '');
    setFormStatus(request.status);
    setFormBudget(request.budget || '');
    setFormDeadline(request.deadline ? new Date(request.deadline) : null);
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formTitle.trim()) errors.title = 'Title is required';
    if (!formClientId) errors.client = 'Client is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddRequest = async () => {
    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('requests').insert({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        client_id: formClientId,
        status: formStatus as 'new' | 'reviewing' | 'converted' | 'declined',
        budget: formBudget.trim() || null,
        deadline: formDeadline?.toISOString().split('T')[0] || null,
        user_id: user.id,
      });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      fetchRequests();
      Alert.alert('Success', 'Request created successfully');
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert('Error', 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRequest = async () => {
    if (!validateForm() || !selectedRequest) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          client_id: formClientId,
          status: formStatus as 'new' | 'reviewing' | 'converted' | 'declined',
          budget: formBudget.trim() || null,
          deadline: formDeadline?.toISOString().split('T')[0] || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedRequest(null);
      resetForm();
      fetchRequests();
      Alert.alert('Success', 'Request updated successfully');
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert('Error', 'Failed to update request');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = () => {
    if (!selectedRequest) return;

    Alert.alert(
      'Delete Request',
      `Are you sure you want to delete "${selectedRequest.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('requests')
                .delete()
                .eq('id', selectedRequest.id);

              if (error) throw error;

              setShowEditModal(false);
              setSelectedRequest(null);
              fetchRequests();
              Alert.alert('Success', 'Request deleted');
            } catch (error) {
              console.error('Error deleting request:', error);
              Alert.alert('Error', 'Failed to delete request');
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
        { text: 'Cancel', style: 'cancel' },
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
              Alert.alert('Success', 'Request converted to project');
            } catch (error) {
              console.error('Error converting request:', error);
              Alert.alert('Error', 'Failed to convert request');
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

  const clientOptions = clients.map(c => ({ key: c.id, label: c.name }));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const navigateToDetail = (request: RequestWithClient) => {
    router.push({ pathname: '/(app)/request-detail', params: { id: request.id } });
  };

  const renderRequest = ({ item }: { item: RequestWithClient }) => {
    const itemColors = statusColors[item.status] || statusColors.new;

    return (
      <TouchableOpacity style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigateToDetail(item)}
        onLongPress={() => openEditModal(item)}>
        <View style={styles.requestHeader}>
          <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
            <Text style={[styles.statusText, { color: itemColors.text }]}>
              {item.status}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textTertiary }]}>{formatDate(item.created_at)}</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Requests</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.infoLight }]} onPress={handleShareLink}>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
            <Text style={[styles.shareText, { color: colors.primary }]}>Share Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterScroll}>
        {(['all', 'new', 'reviewing', 'converted', 'declined'] as RequestStatus[]).map(
          (status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                filterStatus === status && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterStatus === status && styles.filterChipTextActive,
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="mail-outline"
            title="No requests"
            description="Share your request link with clients to start receiving requests."
            actionLabel="Add Request"
            onAction={openAddModal}
          />
        }
      />

      {/* Add Request Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Request"
        size="full"
      >
        <ScrollView style={styles.modalContent} keyboardDismissMode="on-drag">
          <Input
            label="Title"
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Enter request title"
            error={formErrors.title}
          />

          <Input
            label="Description"
            value={formDescription}
            onChangeText={setFormDescription}
            placeholder="Describe the request..."
            multiline
            numberOfLines={4}
          />

          <Select
            label="Client"
            options={clientOptions}
            value={formClientId}
            onChange={setFormClientId}
            placeholder="Select a client"
            error={formErrors.client}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formStatus}
            onChange={setFormStatus}
            placeholder="Select status"
          />

          <Input
            label="Budget"
            value={formBudget}
            onChangeText={setFormBudget}
            placeholder="e.g., $1,000 - $5,000"
          />

          <DatePicker
            label="Deadline"
            value={formDeadline}
            onChange={setFormDeadline}
            placeholder="Select deadline (optional)"
            minDate={new Date()}
          />

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              onPress={() => setShowAddModal(false)}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <Button
              title="Create Request"
              onPress={handleAddRequest}
              variant="primary"
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* Edit Request Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Request"
        size="full"
      >
        <ScrollView style={styles.modalContent} keyboardDismissMode="on-drag">
          <Input
            label="Title"
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Enter request title"
            error={formErrors.title}
          />

          <Input
            label="Description"
            value={formDescription}
            onChangeText={setFormDescription}
            placeholder="Describe the request..."
            multiline
            numberOfLines={4}
          />

          <Select
            label="Client"
            options={clientOptions}
            value={formClientId}
            onChange={setFormClientId}
            placeholder="Select a client"
            error={formErrors.client}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formStatus}
            onChange={setFormStatus}
            placeholder="Select status"
          />

          <Input
            label="Budget"
            value={formBudget}
            onChangeText={setFormBudget}
            placeholder="e.g., $1,000 - $5,000"
          />

          <DatePicker
            label="Deadline"
            value={formDeadline}
            onChange={setFormDeadline}
            placeholder="Select deadline (optional)"
          />

          <View style={styles.modalActions}>
            <Button
              title="Delete"
              onPress={handleDeleteRequest}
              variant="danger"
              style={{ flex: 1 }}
            />
            <Button
              title="Save Changes"
              onPress={handleUpdateRequest}
              variant="primary"
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyStateTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
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
  modalContent: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
