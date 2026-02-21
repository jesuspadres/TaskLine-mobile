import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  RefreshControl,
  Alert,
  Share,
  Linking,
  Modal as RNModal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import {
  Modal, Input, Button, Badge, Select, EmptyState, StatusBadge,
  ListSkeleton, DatePicker, SearchBar, showToast,
} from '@/components';
import type { SelectOption } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { invalidateCache, updateCacheData } from '@/lib/offlineStorage';
import { secureLog } from '@/lib/security';
import { ENV } from '@/lib/env';
import { useSubscription } from '@/hooks/useSubscription';
import { draftTasks } from '@/lib/websiteApi';
import type { AiDraftTask } from '@/lib/websiteApi';
import type { Project, Task, Invoice, Client, ProjectLineItem } from '@/lib/database.types';

type ProjectStage = 'planning' | 'in_progress' | 'completed';
type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';

interface ProjectDetailData {
  project: Project | null;
  client: Client | null;
  tasks: Task[];
  invoices: Invoice[];
  lineItems: ProjectLineItem[];
  properties: Array<{
    id: string;
    name: string;
    address_formatted: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
  }>;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const { isPlus, isBusiness } = useSubscription();
  const canUseAi = isPlus || isBusiness;

  // --- AI Draft Tasks ---
  const [aiDraftedTasks, setAiDraftedTasks] = useState<AiDraftTask[]>([]);
  const [aiDraftingTasks, setAiDraftingTasks] = useState(false);
  const [selectedDraftTasks, setSelectedDraftTasks] = useState<Set<number>>(new Set());
  const [aiTasksAdded, setAiTasksAdded] = useState(false);

  // --- Offline Data ---
  const { data: projectData, loading, refreshing, isOffline, refresh } = useOfflineData<ProjectDetailData>(
    `project_detail:${id}`,
    async () => {
      // Fetch project
      const { data: projData, error: projError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .single();

      if (projError) throw projError;
      const projectResult = projData as Project;

      // Fetch related data in parallel
      const [tasksResult, invoicesResult, lineItemsResult, clientResult, propertiesResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', id!)
          .order('created_at', { ascending: true }),
        supabase
          .from('invoices')
          .select('*')
          .eq('project_id', id!)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_line_items')
          .select('*')
          .eq('project_id', id!)
          .order('created_at', { ascending: true }),
        projectResult.client_id
          ? supabase
              .from('clients')
              .select('*')
              .eq('id', projectResult.client_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        (supabase.from('project_properties') as any)
          .select('property_id, properties:property_id(id, name, address_formatted, address_street, address_unit, address_city, address_state)')
          .eq('project_id', id!)
          .order('created_at', { ascending: false }),
      ]);

      return {
        project: projectResult,
        client: (clientResult.data as Client) ?? null,
        tasks: ((tasksResult.data as Task[]) ?? []),
        invoices: ((invoicesResult.data as Invoice[]) ?? []),
        lineItems: ((lineItemsResult.data as ProjectLineItem[]) ?? []),
        properties: ((propertiesResult.data as any[]) ?? []).map((row: any) => row.properties).filter(Boolean),
      };
    },
    { enabled: !!id },
  );

  const { mutate } = useOfflineMutation();

  // Destructure from cached/fetched data with null defaults
  const project = projectData?.project ?? null;
  const client = projectData?.client ?? null;
  const tasks = projectData?.tasks ?? [];
  const invoices = projectData?.invoices ?? [];
  const lineItems = projectData?.lineItems ?? [];
  const properties = projectData?.properties ?? [];

  // i18n-safe select options
  const PROJECT_STAGE_OPTIONS: SelectOption[] = useMemo(() => [
    { key: 'planning', label: t('projectDetail.planning') },
    { key: 'in_progress', label: t('projectDetail.inProgress') },
    { key: 'completed', label: t('projectDetail.stageCompleted') },
  ], [t]);

  const TASK_STATUS_OPTIONS: SelectOption[] = useMemo(() => [
    { key: 'pending', label: t('tasks.todo') },
    { key: 'in_progress', label: t('tasks.inProgress') },
    { key: 'completed', label: t('tasks.completed') },
  ], [t]);

  const TASK_PRIORITY_OPTIONS: SelectOption[] = useMemo(() => [
    { key: 'low', label: t('tasks.low') },
    { key: 'medium', label: t('tasks.medium') },
    { key: 'high', label: t('tasks.high') },
  ], [t]);

  const ITEM_TYPE_OPTIONS: SelectOption[] = useMemo(() => [
    { key: 'labor', label: t('projectDetail.labor') },
    { key: 'materials', label: t('projectDetail.materials') },
    { key: 'other', label: t('projectDetail.other') },
  ], [t]);

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Edit project modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    budget_total: '',
    deadline: null as Date | null,
    start_date: null as Date | null,
    estimated_duration_days: '',
    project_stage: 'planning' as ProjectStage,
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Add task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    due_date: null as Date | null,
  });
  const [taskFormErrors, setTaskFormErrors] = useState<Record<string, string>>({});

  // Location picker modal state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [allProperties, setAllProperties] = useState<Array<{
    id: string;
    name: string;
    address_formatted: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    client_id: string | null;
  }>>([]);
  const [linkingProperty, setLinkingProperty] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // Add line item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectLineItem | null>(null);
  const [itemForm, setItemForm] = useState({
    item_type: 'labor' as 'labor' | 'materials' | 'other',
    description: '',
    quantity: '',
    unit_price: '',
    notes: '',
  });
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});

  // --- Formatters ---

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }, [locale]);

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return t('projectDetail.notSet');
    return new Date(dateString).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [locale, t]);

  const getPriorityColor = useCallback((priority: TaskPriority) => {
    switch (priority) {
      case 'high': return colors.priorityHigh;
      case 'medium': return colors.priorityMedium;
      case 'low': return colors.priorityLow;
      default: return colors.textTertiary;
    }
  }, [colors]);

  const getTaskStatusIcon = (status: TaskStatus): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'in_progress': return 'time';
      case 'pending': default: return 'ellipse-outline';
    }
  };

  const getTaskStatusColor = useCallback((status: TaskStatus) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'in_progress': return colors.info;
      case 'pending': default: return colors.textTertiary;
    }
  }, [colors]);

  // --- Location Picker Data (stays as local fetch since it's on-demand) ---

  const fetchAllProperties = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address_formatted, address_street, address_city, address_state, client_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllProperties((data as any) || []);
    } catch (error: any) {
      secureLog.error('Error fetching all properties:', error);
    }
  }, [user]);

  const handleLinkProperty = async (propertyId: string) => {
    if (!project || !user) return;
    setLinkingProperty(true);
    try {
      const { error } = await (supabase.from('project_properties') as any)
        .upsert({
          project_id: id!,
          property_id: propertyId,
          user_id: user.id,
        }, { onConflict: 'project_id,property_id' });

      if (error) throw error;
      await invalidateCache(`project_detail:${id}`);
      showToast('success', t('projectDetail.propertyLinked'));
      setShowLocationPicker(false);
      refresh();
    } catch (error: any) {
      secureLog.error('Error linking property:', error);
      showToast('error', t('projectDetail.updateError'));
    } finally {
      setLinkingProperty(false);
    }
  };

  const handleUnlinkProperty = (propertyId: string, propertyName: string) => {
    Alert.alert(
      t('projectDetail.unlinkProperty'),
      t('projectDetail.unlinkPropertyConfirm', { name: propertyName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('projectDetail.unlink'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await (supabase.from('project_properties') as any)
                .delete()
                .eq('project_id', id!)
                .eq('property_id', propertyId);
              if (error) throw error;
              await invalidateCache(`project_detail:${id}`);
              showToast('success', t('projectDetail.propertyUnlinked'));
              refresh();
            } catch (error: any) {
              secureLog.error('Error unlinking property:', error);
              showToast('error', t('projectDetail.updateError'));
            }
          },
        },
      ]
    );
  };

  const openLocationPicker = async () => {
    await fetchAllProperties();
    setShowLocationPicker(true);
  };

  // --- Computed Values ---

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks]);
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalBilled = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
    [invoices]
  );
  const totalPaid = useMemo(
    () => invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total || 0), 0),
    [invoices]
  );

  const lineItemsTotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + ((item as any).total_price || item.amount || 0), 0),
    [lineItems]
  );

  // --- Edit Project ---

  const openEditModal = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      description: project.description || '',
      budget_total: project.budget_total != null ? String(project.budget_total) : '',
      deadline: project.deadline ? new Date(project.deadline) : null,
      start_date: project.start_date ? new Date(project.start_date) : null,
      estimated_duration_days: project.estimated_duration_days?.toString() || '',
      project_stage: ((project as any).project_stage || 'planning') as ProjectStage,
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    if (!editForm.name.trim()) {
      errors.name = t('projects.nameRequired');
    }
    if (editForm.budget_total && isNaN(Number(editForm.budget_total))) {
      errors.budget_total = t('propertyDetail.invalidNumber');
    }
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProject = async () => {
    if (!validateEditForm() || !project) return;

    setSaving(true);
    try {
      const { error } = await mutate({
        table: 'projects',
        operation: 'update',
        data: {
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          budget_total: editForm.budget_total ? Number(editForm.budget_total) : null,
          deadline: editForm.deadline?.toISOString() || null,
          start_date: editForm.start_date?.toISOString() || null,
          estimated_duration_days: editForm.estimated_duration_days ? parseInt(editForm.estimated_duration_days) : null,
          project_stage: editForm.project_stage,
        },
        matchColumn: 'id',
        matchValue: project.id,
        cacheKeys: [`project_detail:${id}`, 'projects'],
      });

      if (error) throw error;

      setShowEditModal(false);
      refresh();
      showToast('success', t('projectDetail.projectUpdated'));
    } catch (error: any) {
      secureLog.error('Error updating project:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    } finally {
      setSaving(false);
    }
  };

  // --- Quick Status Change ---

  const handleQuickStageChange = async (newStage: ProjectStage) => {
    if (!project || (project as any).project_stage === newStage) {
      setShowStatusPicker(false);
      return;
    }
    setShowStatusPicker(false);
    try {
      const { error } = await mutate({
        table: 'projects',
        operation: 'update',
        data: { project_stage: newStage },
        matchColumn: 'id',
        matchValue: project.id,
        cacheKeys: [`project_detail:${id}`, 'projects'],
      });
      if (error) throw error;
      refresh();
      showToast('success', t('projectDetail.projectUpdated'));
    } catch (error: any) {
      secureLog.error('Error updating project stage:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    }
  };

  // --- Archive Project ---

  const handleArchiveProject = () => {
    if (!project) return;

    Alert.alert(
      t('projectDetail.archiveTitle'),
      t('projectDetail.archiveMessage', { name: project.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('projectDetail.archive'),
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'projects',
                operation: 'update',
                data: { status: 'archived' },
                matchColumn: 'id',
                matchValue: project.id,
                cacheKeys: [`project_detail:${id}`],
              });

              if (error) throw error;
              await updateCacheData<any[]>('projects', (cached) =>
                (cached ?? []).filter((p: any) => p.id !== project.id)
              );
              showToast('success', t('projectDetail.projectArchived'));
              router.back();
            } catch (error: any) {
              secureLog.error('Error archiving project:', error);
              showToast('error', error.message || t('projectDetail.updateError'));
            }
          },
        },
      ]
    );
  };

  // --- Delete Project ---

  const handleDeleteProject = () => {
    if (!project) return;

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
              const { error: tasksError } = await mutate({
                table: 'tasks',
                operation: 'delete',
                matchColumn: 'project_id',
                matchValue: project.id,
                cacheKeys: [`project_detail:${id}`, 'tasks'],
              });

              if (tasksError) throw tasksError;

              const { error } = await mutate({
                table: 'projects',
                operation: 'delete',
                matchColumn: 'id',
                matchValue: project.id,
                cacheKeys: [`project_detail:${id}`],
              });

              if (error) throw error;

              await updateCacheData<any[]>('projects', (cached) =>
                (cached ?? []).filter((p: any) => p.id !== project.id)
              );
              showToast('success', t('projectDetail.projectDeleted'));
              router.back();
            } catch (error: any) {
              secureLog.error('Error deleting project:', error);
              showToast('error', error.message || t('projectDetail.deleteError'));
            }
          },
        },
      ]
    );
  };

  // --- Approval Workflow ---

  const handleSendApproval = async () => {
    if (!project || !client) return;

    try {
      // Generate approval token and update project
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('projects')
        .update({
          approval_status: 'pending' as any,
          approval_token: token,
          approval_token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;

      // Build approval link and offer to share it
      const approvalUrl = `${ENV.APP_URL}/project-approval?token=${token}`;
      await Share.share({
        message: `${t('projectDetail.approvalShareMessage', { projectName: project.name, clientName: client.name })}\n\n${approvalUrl}`,
      });

      await invalidateCache('projects');
      refresh();
      showToast('success', t('projectDetail.approvalSent'));
    } catch (error: any) {
      if (error?.message === 'User did not share') return; // Share cancelled
      secureLog.error('Error sending approval:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    }
  };

  // --- Task Actions ---

  const handleTaskStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const { error } = await mutate({
        table: 'tasks',
        operation: 'update',
        data: { status: newStatus },
        matchColumn: 'id',
        matchValue: task.id,
        cacheKeys: [`project_detail:${id}`, 'tasks'],
      });

      if (error) throw error;
      refresh();
    } catch (error: any) {
      secureLog.error('Error updating task status:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    }
  };

  const getNextTaskStatus = (current: TaskStatus): TaskStatus => {
    switch (current) {
      case 'pending': return 'in_progress';
      case 'in_progress': return 'completed';
      case 'completed': return 'pending';
      default: return 'pending';
    }
  };

  // --- Add Task ---

  const openAddTaskModal = () => {
    setTaskForm({ title: '', description: '', priority: 'medium', due_date: null });
    setTaskFormErrors({});
    setShowAddTaskModal(true);
  };

  const validateTaskForm = () => {
    const errors: Record<string, string> = {};
    if (!taskForm.title.trim()) {
      errors.title = t('projectDetail.taskTitleRequired');
    }
    setTaskFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTask = async () => {
    if (!validateTaskForm() || !project) return;

    setSavingTask(true);
    try {
      const { error } = await mutate({
        table: 'tasks',
        operation: 'insert',
        data: {
          project_id: project.id,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          priority: taskForm.priority,
          due_date: taskForm.due_date?.toISOString().split('T')[0] || null,
          status: 'pending',
        },
        cacheKeys: [`project_detail:${id}`, 'tasks'],
      });

      if (error) throw error;

      setShowAddTaskModal(false);
      refresh();
      showToast('success', t('projectDetail.taskAdded'));
    } catch (error: any) {
      secureLog.error('Error adding task:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      t('projectDetail.deleteTask'),
      t('projectDetail.deleteTaskConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'tasks',
                operation: 'delete',
                matchColumn: 'id',
                matchValue: task.id,
                cacheKeys: [`project_detail:${id}`, 'tasks'],
              });
              if (error) throw error;
              refresh();
              showToast('success', t('projectDetail.taskDeleted'));
            } catch (error: any) {
              secureLog.error('Error deleting task:', error);
              showToast('error', error.message || t('projectDetail.updateError'));
            }
          },
        },
      ]
    );
  };

  // --- AI Draft Tasks ---

  const handleAiDraftTasks = async () => {
    if (!project) return;
    setAiDraftingTasks(true);
    try {
      const { tasks: drafted } = await draftTasks(project.id);
      setAiDraftedTasks(drafted);
      setSelectedDraftTasks(new Set(drafted.map((_, i) => i)));
    } catch (error: any) {
      secureLog.error('AI draft tasks error:', error);
      showToast('error', error.message || t('ai.draftTasksError'));
    } finally {
      setAiDraftingTasks(false);
    }
  };

  const handleAddAiDraftedTasks = async () => {
    if (!project || selectedDraftTasks.size === 0) {
      showToast('error', t('ai.noTasksSelected'));
      return;
    }
    try {
      const tasksToAdd = aiDraftedTasks
        .filter((_, i) => selectedDraftTasks.has(i))
        .map((dt) => ({
          project_id: project.id,
          title: dt.title,
          description: dt.description,
          priority: dt.priority,
          status: 'pending',
        }));

      const { error } = await mutate({
        table: 'tasks',
        operation: 'insert',
        data: tasksToAdd,
        cacheKeys: [`project_detail:${id}`, 'tasks'],
      });
      if (error) throw error;

      setAiDraftedTasks([]);
      setSelectedDraftTasks(new Set());
      setAiTasksAdded(true);
      refresh();
      showToast('success', t('ai.tasksDrafted'));
    } catch (error: any) {
      secureLog.error('Error adding AI drafted tasks:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    }
  };

  const toggleDraftTask = (index: number) => {
    setSelectedDraftTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllDraftTasks = () => {
    if (selectedDraftTasks.size === aiDraftedTasks.length) {
      setSelectedDraftTasks(new Set());
    } else {
      setSelectedDraftTasks(new Set(aiDraftedTasks.map((_, i) => i)));
    }
  };

  // --- Line Item Actions ---

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemForm({ item_type: 'labor', description: '', quantity: '1', unit_price: '', notes: '' });
    setItemFormErrors({});
    setShowAddItemModal(true);
  };

  const openEditItemModal = (item: ProjectLineItem) => {
    setEditingItem(item);
    setItemForm({
      item_type: (item as any).item_type || 'labor',
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      notes: (item as any).notes || '',
    });
    setItemFormErrors({});
    setShowAddItemModal(true);
  };

  const validateItemForm = () => {
    const errors: Record<string, string> = {};
    if (!itemForm.description.trim()) {
      errors.description = t('common.required');
    }
    if (!itemForm.quantity || isNaN(Number(itemForm.quantity)) || Number(itemForm.quantity) <= 0) {
      errors.quantity = t('propertyDetail.invalidNumber');
    }
    if (!itemForm.unit_price || isNaN(Number(itemForm.unit_price)) || Number(itemForm.unit_price) < 0) {
      errors.unit_price = t('propertyDetail.invalidNumber');
    }
    setItemFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveItem = async () => {
    if (!validateItemForm() || !project) return;

    setSavingItem(true);
    try {
      const qty = Number(itemForm.quantity);
      const price = Number(itemForm.unit_price);
      const amount = qty * price;

      if (editingItem) {
        const { error } = await mutate({
          table: 'project_line_items',
          operation: 'update',
          data: {
            item_type: itemForm.item_type,
            description: itemForm.description.trim(),
            quantity: qty,
            unit_price: price,
            total_price: amount,
            notes: itemForm.notes.trim() || null,
          },
          matchColumn: 'id',
          matchValue: editingItem.id,
          cacheKeys: [`project_detail:${id}`],
        });

        if (error) throw error;
        showToast('success', t('projectDetail.itemUpdated'));
      } else {
        const { error } = await mutate({
          table: 'project_line_items',
          operation: 'insert',
          data: {
            project_id: project.id,
            item_type: itemForm.item_type,
            description: itemForm.description.trim(),
            quantity: qty,
            unit_price: price,
            total_price: amount,
            notes: itemForm.notes.trim() || null,
          },
          cacheKeys: [`project_detail:${id}`],
        });
        if (error) throw error;
        showToast('success', t('projectDetail.itemAdded'));
      }

      setShowAddItemModal(false);
      setEditingItem(null);
      refresh();
    } catch (error: any) {
      secureLog.error('Error saving line item:', error);
      showToast('error', error.message || t('projectDetail.updateError'));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = (item: ProjectLineItem) => {
    Alert.alert(
      t('projectDetail.deleteItem'),
      t('projectDetail.deleteItemConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'project_line_items',
                operation: 'delete',
                matchColumn: 'id',
                matchValue: item.id,
                cacheKeys: [`project_detail:${id}`],
              });
              if (error) throw error;
              refresh();
              showToast('success', t('projectDetail.itemDeleted'));
            } catch (error: any) {
              secureLog.error('Error deleting line item:', error);
              showToast('error', error.message || t('projectDetail.updateError'));
            }
          },
        },
      ]
    );
  };

  // --- Loading / Not Found States ---

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('projectDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('projectDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon="folder-outline"
          title={t('projectDetail.notFound')}
          description={t('projectDetail.notFoundDesc')}
          offline={isOffline}
        />
      </SafeAreaView>
    );
  }

  // --- Main Render ---

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {project.name}
          </Text>
          <TouchableOpacity
            style={styles.statusPickerTrigger}
            onPress={() => setShowStatusPicker(true)}
            activeOpacity={0.7}
          >
            <StatusBadge status={(project as any).project_stage || 'planning'} size="sm" />
            <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openEditModal}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDeleteProject}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        keyboardDismissMode="on-drag"
      >
        {/* Project Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Client */}
          {client && (
            <TouchableOpacity
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/client-detail', params: { id: client.id } } as any)}
            >
              <Ionicons name="person-outline" size={16} color={colors.primary} />
              <Text style={[styles.clientName, { color: colors.primary }]}>{client.name}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Original Request Link */}
          {!!(project as any).request_id && (
            <TouchableOpacity
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/(app)/request-detail', params: { id: (project as any).request_id } } as any)}
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.clientName, { color: colors.primary }]}>{t('projectDetail.viewOriginalRequest')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Description */}
          {project.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {project.description}
            </Text>
          )}

          {/* Details Grid */}
          <View style={[styles.detailsGrid, { borderTopColor: colors.borderLight }]}>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.budget')}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {project.budget_total != null ? formatCurrency(project.budget_total) : t('projectDetail.notSet')}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.deadline')}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDate(project.deadline)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.approval')}</Text>
              {project.approval_status ? (
                <StatusBadge status={project.approval_status} size="sm" />
              ) : (
                <Text style={[styles.detailValue, { color: colors.text }]}>{t('projectDetail.notSet')}</Text>
              )}
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.created')}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDate(project.created_at)}
              </Text>
            </View>
            {project.start_date && (
              <View style={styles.detailItem}>
                <Ionicons name="play-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.startDate')}</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatDate(project.start_date)}
                </Text>
              </View>
            )}
            {project.estimated_duration_days != null && (
              <View style={styles.detailItem}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{t('projectDetail.estimatedDuration')}</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {t('projects.days', { count: project.estimated_duration_days })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Approval Workflow */}
        {client && project.approval_status !== 'approved' && (
          <View style={[styles.workflowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.workflowHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
              <Text style={[styles.workflowTitle, { color: colors.text }]}>{t('projectDetail.workflow')}</Text>
            </View>
            <Text style={[styles.workflowDesc, { color: colors.textSecondary }]}>
              {t('projectDetail.approvalDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.workflowButton, { backgroundColor: colors.primary }]}
              onPress={handleSendApproval}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.workflowButtonText}>
                {project.approval_status === 'pending'
                  ? t('projectDetail.resendApproval')
                  : t('projectDetail.sendApproval')}
              </Text>
            </TouchableOpacity>
            {project.approval_status === 'pending' && (
              <Text style={[styles.workflowStatusNote, { color: colors.warning }]}>
                {t('projectDetail.awaitingClientApproval')}
              </Text>
            )}
          </View>
        )}

        {/* Project Location */}
        <View style={[styles.propertiesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.propertiesHeader}>
            <Ionicons name="location-outline" size={18} color={colors.text} />
            <Text style={[styles.propertiesTitle, { color: colors.text }]}>{t('projectDetail.projectLocation')}</Text>
            <TouchableOpacity
              style={[styles.addLocationBtn, { backgroundColor: colors.primary }]}
              onPress={openLocationPicker}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addLocationBtnText}>{t('projectDetail.addLocation')}</Text>
            </TouchableOpacity>
          </View>
          {properties.length > 0 ? (
            properties.map((property, idx) => {
              const unit = (property as any).address_unit || null;
              let address = property.address_formatted || [property.address_street, property.address_city, property.address_state].filter(Boolean).join(', ') || null;
              if (address && unit && !address.includes(unit)) address = `${address}, ${unit}`;

              return (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.propertyItem,
                    idx < properties.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                  ]}
                  onPress={() => router.push({ pathname: '/(app)/property-detail', params: { id: property.id } } as any)}
                >
                  <View style={[styles.propertyIcon, { backgroundColor: colors.infoLight }]}>
                    <Ionicons name="home-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.propertyInfo}>
                    <Text style={[styles.propertyItemName, { color: colors.text }]} numberOfLines={1}>
                      {property.name}
                    </Text>
                    {address && (
                      <Text style={[styles.propertyItemAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                        {address}
                      </Text>
                    )}
                  </View>
                  <View style={styles.propertyActions}>
                    {address && (
                      <TouchableOpacity
                        style={[styles.propertyMapsBtn, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)}
                      >
                        <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.propertyUnlinkBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleUnlinkProperty(property.id, property.name);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.locationEmptyState}>
              <Ionicons name="location-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.locationEmptyText, { color: colors.textTertiary }]}>{t('projectDetail.noLocation')}</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>{t('projectDetail.taskProgress')}</Text>
            <Text style={[styles.progressCount, { color: colors.textSecondary }]}>
              {t('projectDetail.tasksCompleted', { completed: completedTasks, total: totalTasks })}
            </Text>
          </View>
          <View style={[styles.progressBarBackground, { backgroundColor: colors.borderLight }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: progressPercent === 100 ? colors.success : colors.primary,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, { color: colors.textTertiary }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>

        {/* Tasks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('projectDetail.tasks')}</Text>
            <View style={styles.sectionHeaderActions}>
              {canUseAi && aiDraftedTasks.length === 0 && !aiTasksAdded && (
                <TouchableOpacity
                  style={[styles.aiDraftBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
                  onPress={handleAiDraftTasks}
                  disabled={aiDraftingTasks}
                >
                  {aiDraftingTasks ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                  )}
                  <Text style={[styles.aiDraftBtnText, { color: colors.primary }]}>{t('ai.draftTasks')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={openAddTaskModal}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>{t('projectDetail.addTask')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Drafted Tasks Review */}
          {aiDraftedTasks.length > 0 && (
            <View style={[styles.aiDraftPanel, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
              <View style={styles.aiDraftPanelHeader}>
                <View style={styles.aiDraftPanelHeaderLeft}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={[styles.aiDraftPanelTitle, { color: colors.text }]}>{t('ai.draftTasks')}</Text>
                </View>
                <TouchableOpacity onPress={toggleAllDraftTasks}>
                  <Text style={[styles.aiDraftSelectAll, { color: colors.primary }]}>
                    {selectedDraftTasks.size === aiDraftedTasks.length ? t('ai.deselectAll') : t('ai.selectAll')}
                  </Text>
                </TouchableOpacity>
              </View>
              {aiDraftedTasks.map((dt, idx) => {
                const selected = selectedDraftTasks.has(idx);
                const prioColor = dt.priority === 'high' ? colors.priorityHigh : dt.priority === 'medium' ? colors.priorityMedium : colors.priorityLow;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.aiDraftItem, selected && { backgroundColor: colors.primary + '08' }]}
                    onPress={() => toggleDraftTask(idx)}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.textTertiary}
                    />
                    <View style={styles.aiDraftItemContent}>
                      <Text style={[styles.aiDraftItemTitle, { color: colors.text }]}>{dt.title}</Text>
                      <Text style={[styles.aiDraftItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>{dt.description}</Text>
                    </View>
                    <View style={[styles.aiDraftPrioBadge, { backgroundColor: prioColor + '20' }]}>
                      <Text style={[styles.aiDraftPrioText, { color: prioColor }]}>{dt.priority}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.aiDraftActions}>
                <TouchableOpacity
                  style={[styles.aiDraftCancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setAiDraftedTasks([]); setSelectedDraftTasks(new Set()); }}
                >
                  <Text style={[styles.aiDraftCancelText, { color: colors.textSecondary }]}>{t('ai.dismiss')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiDraftAddBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAddAiDraftedTasks}
                  disabled={selectedDraftTasks.size === 0}
                >
                  <Text style={styles.aiDraftAddText}>{t('ai.addSelectedTasks')} ({selectedDraftTasks.size})</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {tasks.length === 0 ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="checkbox-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>{t('projectDetail.noTasks')}</Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View
                key={task.id}
                style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <TouchableOpacity
                  style={styles.taskStatusButton}
                  onPress={() => handleTaskStatusChange(task, getNextTaskStatus(task.status as string as TaskStatus))}
                >
                  <Ionicons
                    name={getTaskStatusIcon(task.status as string as TaskStatus)}
                    size={22}
                    color={getTaskStatusColor(task.status as string as TaskStatus)}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.taskContent}
                  onPress={() => router.push({ pathname: '/(app)/tasks', params: { id: task.id } } as any)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.taskTitle,
                      { color: colors.text },
                      task.status === 'completed' && styles.taskTitleCompleted,
                      task.status === 'completed' && { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                  <View style={styles.taskMeta}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                    <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
                      {task.priority}
                    </Text>
                    {task.due_date && (
                      <>
                        <Text style={[styles.taskMetaDivider, { color: colors.textTertiary }]}>|</Text>
                        <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
                          {formatDate(task.due_date)}
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.taskActions}>
                  {task.status !== 'completed' && (
                    <TouchableOpacity
                      style={[styles.taskQuickAction, { backgroundColor: colors.successLight }]}
                      onPress={() => handleTaskStatusChange(task, 'completed')}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                    </TouchableOpacity>
                  )}
                  {task.status === 'completed' && (
                    <TouchableOpacity
                      style={[styles.taskQuickAction, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => handleTaskStatusChange(task, 'pending')}
                    >
                      <Ionicons name="refresh" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.taskQuickAction, { backgroundColor: colors.errorLight || colors.surfaceSecondary }]}
                    onPress={() => handleDeleteTask(task)}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Budget Breakdown Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('projectDetail.lineItems')}</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={openAddItemModal}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>{t('projectDetail.addItem')}</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>{t('projectDetail.noLineItems')}</Text>
            </View>
          ) : (
            <>
              {lineItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.lineItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openEditItemModal(item)}
                  onLongPress={() => handleDeleteItem(item)}
                >
                  <View style={styles.lineItemContent}>
                    <Text style={[styles.lineItemDescription, { color: colors.text }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={[styles.lineItemFormula, { color: colors.textTertiary }]}>
                      {item.quantity} x {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                  <Text style={[styles.lineItemAmount, { color: colors.text }]}>
                    {formatCurrency((item as any).total_price || item.amount || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={[styles.lineItemTotalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.lineItemTotalLabel, { color: colors.textSecondary }]}>{t('projectDetail.budgetTotal')}</Text>
                <Text style={[styles.lineItemTotalValue, { color: colors.text }]}>{formatCurrency(lineItemsTotal)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Invoices Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('projectDetail.invoices')}</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push({ pathname: '/(app)/invoices', params: { create: 'true', project_id: project.id, client_id: project.client_id || '' } } as any)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>{t('projectDetail.createInvoice')}</Text>
            </TouchableOpacity>
          </View>

          {/* Invoice Summary */}
          {invoices.length > 0 && (
            <View style={styles.invoiceSummaryRow}>
              <View style={[styles.invoiceSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.invoiceSummaryLabel, { color: colors.textTertiary }]}>{t('projectDetail.totalBilled')}</Text>
                <Text style={[styles.invoiceSummaryValue, { color: colors.text }]}>
                  {formatCurrency(totalBilled)}
                </Text>
              </View>
              <View style={[styles.invoiceSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.invoiceSummaryLabel, { color: colors.textTertiary }]}>{t('projectDetail.totalPaid')}</Text>
                <Text style={[styles.invoiceSummaryValue, { color: colors.success }]}>
                  {formatCurrency(totalPaid)}
                </Text>
              </View>
            </View>
          )}

          {invoices.length === 0 ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>{t('projectDetail.noInvoices')}</Text>
            </View>
          ) : (
            invoices.map((invoice) => (
              <TouchableOpacity
                key={invoice.id}
                style={[styles.invoiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/(app)/invoices', params: { id: invoice.id } } as any)}
                activeOpacity={0.7}
              >
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceHeaderLeft}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                    <Text style={[styles.invoiceNumber, { color: colors.text }]}>
                      {invoice.invoice_number}
                    </Text>
                  </View>
                  <StatusBadge status={invoice.status} size="sm" />
                </View>
                <View style={styles.invoiceDetails}>
                  <Text style={[styles.invoiceAmount, { color: colors.text }]}>
                    {formatCurrency(invoice.total)}
                  </Text>
                  {invoice.due_date && (
                    <View style={styles.invoiceDateRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                      <Text style={[styles.invoiceDateText, { color: colors.textTertiary }]}>
                        {t('projectDetail.due', { date: formatDate(invoice.due_date) })}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Complete / Archive Buttons */}
        {(project.status as string) !== 'archived' && (
          <View style={styles.section}>
            {(project as any).project_stage !== 'completed' && (
              <TouchableOpacity
                style={[styles.completeButton, { backgroundColor: colors.successLight, borderColor: colors.success + '30' }]}
                onPress={() => handleQuickStageChange('completed')}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                <Text style={[styles.completeButtonText, { color: colors.success }]}>
                  {t('projectDetail.completeProject')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.archiveButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleArchiveProject}
            >
              <Ionicons name="archive-outline" size={20} color={colors.warning} />
              <Text style={[styles.archiveButtonText, { color: colors.warning }]}>
                {t('projectDetail.archive')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Status Picker */}
      <RNModal
        visible={showStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowStatusPicker(false)}>
          <View style={styles.statusPickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.statusPickerSheet, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statusPickerTitle, { color: colors.text }]}>
                  {t('projectDetail.changeStatus')}
                </Text>
                {PROJECT_STAGE_OPTIONS.map((option) => {
                  const isActive = ((project as any).project_stage || 'planning') === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.statusPickerOption,
                        isActive && { backgroundColor: `${colors.primary}14` },
                      ]}
                      onPress={() => handleQuickStageChange(option.key as ProjectStage)}
                      activeOpacity={0.7}
                    >
                      <StatusBadge status={option.key} size="sm" />
                      <Text style={[styles.statusPickerLabel, { color: colors.text }]}>
                        {option.label}
                      </Text>
                      {isActive && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </RNModal>

      {/* Edit Project Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('projectDetail.editProject')}
        size="full"
      >
        <Input
          label={`${t('projectDetail.projectName')} *`}
          placeholder={t('projectDetail.projectNamePlaceholder')}
          value={editForm.name}
          onChangeText={(text) => setEditForm({ ...editForm, name: text })}
          error={editFormErrors.name}
          leftIcon="folder-outline"
        />

        <Input
          label={t('projects.description')}
          placeholder={t('projects.descriptionPlaceholder')}
          value={editForm.description}
          onChangeText={(text) => setEditForm({ ...editForm, description: text })}
          leftIcon="document-text-outline"
          multiline
          numberOfLines={3}
        />

        <Input
          label={t('projects.budget')}
          placeholder={t('projects.budgetPlaceholder')}
          value={editForm.budget_total}
          onChangeText={(text) => setEditForm({ ...editForm, budget_total: text.replace(/[^0-9.]/g, '') })}
          error={editFormErrors.budget_total}
          leftIcon="cash-outline"
          keyboardType="decimal-pad"
        />

        <DatePicker
          label={t('projectDetail.startDate')}
          value={editForm.start_date}
          onChange={(date) => setEditForm({ ...editForm, start_date: date })}
          placeholder={t('projectDetail.startDate')}
        />

        <DatePicker
          label={t('projectDetail.deadline')}
          value={editForm.deadline}
          onChange={(date) => setEditForm({ ...editForm, deadline: date })}
          placeholder={t('projectDetail.deadline')}
        />

        <Input
          label={t('projects.estimatedDuration')}
          placeholder={t('projects.estimatedDurationPlaceholder')}
          value={editForm.estimated_duration_days}
          onChangeText={(text) => setEditForm({ ...editForm, estimated_duration_days: text.replace(/[^0-9]/g, '') })}
          leftIcon="time-outline"
          keyboardType="number-pad"
        />

        <Select
          label={t('projectDetail.stage')}
          options={PROJECT_STAGE_OPTIONS}
          value={editForm.project_stage}
          onChange={(value) => setEditForm({ ...editForm, project_stage: value as ProjectStage })}
        />

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowEditModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleSaveProject}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        visible={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        title={t('projectDetail.addTask')}
        size="full"
      >
        <Input
          label={`${t('projectDetail.taskTitle')} *`}
          placeholder={t('projectDetail.taskTitlePlaceholder')}
          value={taskForm.title}
          onChangeText={(text) => setTaskForm({ ...taskForm, title: text })}
          error={taskFormErrors.title}
          leftIcon="checkbox-outline"
        />

        <Input
          label={t('projectDetail.taskDescription')}
          placeholder={t('projectDetail.taskDescriptionPlaceholder')}
          value={taskForm.description}
          onChangeText={(text) => setTaskForm({ ...taskForm, description: text })}
          leftIcon="document-text-outline"
          multiline
          numberOfLines={3}
        />

        <Select
          label={t('projectDetail.taskPriority')}
          options={TASK_PRIORITY_OPTIONS}
          value={taskForm.priority}
          onChange={(value) => setTaskForm({ ...taskForm, priority: value as TaskPriority })}
        />

        <DatePicker
          label={t('projectDetail.taskDueDate')}
          value={taskForm.due_date}
          onChange={(date) => setTaskForm({ ...taskForm, due_date: date })}
          placeholder={t('projectDetail.taskDueDate')}
        />

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowAddTaskModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('projectDetail.addTask')}
            onPress={handleAddTask}
            loading={savingTask}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        onClose={() => { setShowLocationPicker(false); setPropertySearch(''); }}
        title={t('projectDetail.selectProperty')}
        size="full"
      >
        <View style={styles.propertySearchContainer}>
          <SearchBar
            value={propertySearch}
            onChangeText={setPropertySearch}
            placeholder={t('properties.searchPlaceholder')}
          />
        </View>
        <ScrollView style={styles.locationPickerList} keyboardShouldPersistTaps="handled">
          {(() => {
            const available = allProperties.filter(p => {
              if (properties.some(cp => cp.id === p.id)) return false;
              if (!propertySearch.trim()) return true;
              const q = propertySearch.toLowerCase();
              return (
                p.name?.toLowerCase().includes(q) ||
                p.address_formatted?.toLowerCase().includes(q) ||
                p.address_street?.toLowerCase().includes(q) ||
                p.address_city?.toLowerCase().includes(q) ||
                p.address_state?.toLowerCase().includes(q)
              );
            });
            return available.length > 0 ? (
            available
              .map((property) => {
                const pUnit = (property as any).address_unit || null;
                let address = property.address_formatted || [property.address_street, property.address_city, property.address_state].filter(Boolean).join(', ') || null;
                if (address && pUnit && !address.includes(pUnit)) address = `${address}, ${pUnit}`;
                return (
                  <TouchableOpacity
                    key={property.id}
                    style={[styles.locationPickerItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleLinkProperty(property.id)}
                    disabled={linkingProperty}
                  >
                    <View style={[styles.propertyIcon, { backgroundColor: colors.infoLight }]}>
                      <Ionicons name="home-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.propertyInfo}>
                      <Text style={[styles.propertyItemName, { color: colors.text }]} numberOfLines={1}>
                        {property.name}
                      </Text>
                      {address && (
                        <Text style={[styles.propertyItemAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                          {address}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                );
              })
          ) : (
            <View style={styles.locationEmptyState}>
              <Ionicons name="home-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.locationEmptyText, { color: colors.textTertiary }]}>
                {t('projectDetail.noPropertiesAvailable')}
              </Text>
            </View>
          );
          })()}
        </ScrollView>
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowLocationPicker(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('projectDetail.createNewProperty')}
            onPress={() => {
              setShowLocationPicker(false);
              router.push({ pathname: '/(app)/properties', params: { create: 'true', client_id: project?.client_id || '' } } as any);
            }}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Add/Edit Line Item Modal */}
      <Modal
        visible={showAddItemModal}
        onClose={() => { setShowAddItemModal(false); setEditingItem(null); }}
        title={editingItem ? t('projectDetail.editItem') : t('projectDetail.addItem')}
        size="full"
      >
        <Select
          label={t('projectDetail.itemType')}
          options={ITEM_TYPE_OPTIONS}
          value={itemForm.item_type}
          onChange={(value) => setItemForm({ ...itemForm, item_type: value as 'labor' | 'materials' | 'other' })}
        />

        <Input
          label={`${t('projectDetail.itemDescription')} *`}
          placeholder={t('projectDetail.itemDescriptionPlaceholder')}
          value={itemForm.description}
          onChangeText={(text) => setItemForm({ ...itemForm, description: text })}
          error={itemFormErrors.description}
          leftIcon="document-text-outline"
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={t('projectDetail.quantity')}
              placeholder={t('projectDetail.quantityPlaceholder')}
              value={itemForm.quantity}
              onChangeText={(text) => setItemForm({ ...itemForm, quantity: text.replace(/[^0-9.]/g, '') })}
              error={itemFormErrors.quantity}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfWidth}>
            <Input
              label={t('projectDetail.unitPrice')}
              placeholder={t('projectDetail.unitPricePlaceholder')}
              value={itemForm.unit_price}
              onChangeText={(text) => setItemForm({ ...itemForm, unit_price: text.replace(/[^0-9.]/g, '') })}
              error={itemFormErrors.unit_price}
              leftIcon="cash-outline"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {itemForm.quantity && itemForm.unit_price && (
          <View style={[styles.itemTotalPreview, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.itemTotalLabel, { color: colors.textSecondary }]}>{t('projectDetail.itemTotal')}</Text>
            <Text style={[styles.itemTotalValue, { color: colors.text }]}>
              {formatCurrency(Number(itemForm.quantity || 0) * Number(itemForm.unit_price || 0))}
            </Text>
          </View>
        )}

        <Input
          label={t('projectDetail.notes')}
          placeholder={t('projectDetail.notesPlaceholder')}
          value={itemForm.notes}
          onChangeText={(text) => setItemForm({ ...itemForm, notes: text })}
          leftIcon="document-text-outline"
          multiline
          numberOfLines={2}
        />

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => { setShowAddItemModal(false); setEditingItem(null); }}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleSaveItem}
            loading={savingItem}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flexShrink: 1,
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  // Info Card
  infoCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  clientName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  detailItem: {
    width: '46%',
    gap: Spacing.xs,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
  },
  detailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Properties Card
  propertiesCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  propertiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: 2,
    marginLeft: 'auto',
  },
  addLocationBtnText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: '#fff',
  },
  locationEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  locationEmptyText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  propertySearchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  locationPickerList: {
    maxHeight: 300,
  },
  locationPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  propertiesTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  propertyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  propertyIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
  },
  propertyItemName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  propertyItemAddress: {
    fontSize: FontSizes.xs,
  },
  propertyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  propertyMapsBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyUnlinkBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Workflow Card
  workflowCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  workflowTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  workflowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  workflowButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress
  progressCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: FontSizes.sm,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressPercent: {
    fontSize: FontSizes.xs,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  addButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  emptySectionText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
  },

  // Line Items
  lineItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemDescription: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  lineItemFormula: {
    fontSize: FontSizes.xs,
  },
  lineItemAmount: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginLeft: Spacing.md,
  },
  lineItemTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
  },
  lineItemTotalLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  lineItemTotalValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  // Item Total Preview
  itemTotalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  itemTotalLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  itemTotalValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  // Tasks
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  taskStatusButton: {
    padding: Spacing.xs,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskMetaText: {
    fontSize: FontSizes.xs,
    textTransform: 'capitalize',
  },
  taskMetaDivider: {
    fontSize: FontSizes.xs,
    marginHorizontal: 2,
  },
  taskActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  taskQuickAction: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Invoices
  invoiceSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  invoiceSummaryCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  invoiceSummaryLabel: {
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
  },
  invoiceSummaryValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  invoiceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  invoiceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  invoiceNumber: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceAmount: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  invoiceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  invoiceDateText: {
    fontSize: FontSizes.xs,
  },

  // Archive
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  archiveButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  completeButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Workflow extras
  workflowDesc: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  workflowStatusNote: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Modal shared
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

  // Status picker
  statusPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  statusPickerSheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  statusPickerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  statusPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  statusPickerLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },

  // Section header actions row
  sectionHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },

  // AI Draft Tasks
  aiDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    borderWidth: 1,
  },
  aiDraftBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },
  aiDraftPanel: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  aiDraftPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  aiDraftPanelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  aiDraftPanelTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  aiDraftSelectAll: { fontSize: FontSizes.xs, fontWeight: '600' },
  aiDraftItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  aiDraftItemContent: { flex: 1 },
  aiDraftItemTitle: { fontSize: FontSizes.sm, fontWeight: '500' },
  aiDraftItemDesc: { fontSize: FontSizes.xs, lineHeight: 16, marginTop: 2 },
  aiDraftPrioBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  aiDraftPrioText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  aiDraftActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  aiDraftCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  aiDraftCancelText: { fontSize: FontSizes.sm, fontWeight: '500' },
  aiDraftAddBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  aiDraftAddText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },
});
