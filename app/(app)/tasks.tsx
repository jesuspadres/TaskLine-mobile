import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotificationFeedbackType } from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { updateCacheData } from '@/lib/offlineStorage';
import {
  Modal, Input, Button, Select, DatePicker, EmptyState,
  SearchBar, FilterChips, ListSkeleton, ConfirmDialog,
  showToast,
} from '@/components';
import type { TaskWithProject, Project } from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';
import { secureLog } from '@/lib/security';

// DB uses: backlog, pending, in_progress, completed
type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';
type ViewMode = 'board' | 'list';

const { width: screenWidth } = Dimensions.get('window');
const COLUMN_WIDTH = screenWidth * 0.78;

export default function TasksScreen() {
  const router = useRouter();
  const { create, id: openTaskId } = useLocalSearchParams<{ create?: string; id?: string }>();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();

  const { data: tasks, loading, refreshing, isOffline, refresh } = useOfflineData<TaskWithProject[]>(
    'tasks',
    async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects(id, name, client:clients(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any;
    },
    { deps: [t] },
  );
  const { mutate } = useOfflineMutation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [backlogExpanded, setBacklogExpanded] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: null as Date | null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithProject | null>(null);

  // Archive state
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteArchivedConfirm, setShowDeleteArchivedConfirm] = useState(false);

  // i18n-safe status config
  const statusConfig = useMemo(() => ({
    backlog: {
      label: t('tasks.backlog'),
      color: colors.textTertiary,
      bgColor: colors.surfaceSecondary,
      icon: 'archive-outline' as const,
    },
    pending: {
      label: t('tasks.todo'),
      color: colors.warning || colors.priorityMedium,
      bgColor: (colors as any).warningLight || colors.surfaceSecondary,
      icon: 'ellipse-outline' as const,
    },
    in_progress: {
      label: t('tasks.inProgress'),
      color: colors.primary,
      bgColor: colors.infoLight,
      icon: 'time-outline' as const,
    },
    completed: {
      label: t('tasks.completed'),
      color: colors.success,
      bgColor: colors.successLight,
      icon: 'checkmark-circle' as const,
    },
  }), [colors, t]);

  const priorityColors = useMemo(() => ({
    low: colors.priorityLow,
    medium: colors.priorityMedium,
    high: colors.priorityHigh,
  }), [colors]);

  const statusFilterOptions = useMemo(() => [
    { key: 'all', label: t('tasks.allStatuses') },
    { key: 'pending', label: t('tasks.todo') },
    { key: 'in_progress', label: t('tasks.inProgress') },
    { key: 'completed', label: t('tasks.completed') },
    { key: 'backlog', label: t('tasks.backlog') },
  ], [t]);

  const priorityFilterOptions = useMemo(() => [
    { key: 'all', label: t('tasks.allPriorities') },
    { key: 'high', label: t('tasks.high') },
    { key: 'medium', label: t('tasks.medium') },
    { key: 'low', label: t('tasks.low') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { key: 'newest', label: t('tasks.newest') },
    { key: 'oldest', label: t('tasks.oldest') },
    { key: 'dueEarliest', label: t('tasks.dueEarliest') },
    { key: 'dueLatest', label: t('tasks.dueLatest') },
    { key: 'priorityHigh', label: t('tasks.priorityHighFirst') },
    { key: 'priorityLow', label: t('tasks.priorityLowFirst') },
  ], [t]);

  const formStatusOptions = useMemo(() => [
    { key: 'backlog', label: t('tasks.backlog') },
    { key: 'pending', label: t('tasks.todo') },
    { key: 'in_progress', label: t('tasks.inProgress') },
    { key: 'completed', label: t('tasks.completed') },
  ], [t]);

  const formPriorityOptions = useMemo(() => [
    { key: 'low', label: t('tasks.low') },
    { key: 'medium', label: t('tasks.medium') },
    { key: 'high', label: t('tasks.high') },
  ], [t]);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(name)')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProjects((data as any[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Separate active vs archived tasks
  const activeTasks = useMemo(() =>
    (tasks ?? []).filter((t) => !(t as any).archived_at),
    [tasks]
  );
  const archivedTasks = useMemo(() =>
    (tasks ?? []).filter((t) => !!(t as any).archived_at),
    [tasks]
  );

  // Filter and sort
  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = activeTasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        (task.description?.toLowerCase().includes(query) ?? false) ||
        ((task.project as any)?.name?.toLowerCase().includes(query) ?? false);

      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'dueEarliest':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'dueLatest':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        case 'priorityHigh':
          return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        case 'priorityLow':
          return (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, searchQuery, filterStatus, filterPriority, sortBy]);

  // Stats (cast to any for status values not in outdated generated types)
  const stats = useMemo(() => ({
    total: activeTasks.length,
    pending: activeTasks.filter((t) => (t.status as string) === 'pending').length,
    inProgress: activeTasks.filter((t) => (t.status as string) === 'in_progress').length,
    completed: activeTasks.filter((t) => (t.status as string) === 'completed').length,
    backlog: activeTasks.filter((t) => (t.status as string) === 'backlog').length,
  }), [activeTasks]);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterPriority !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [filterPriority, sortBy]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = t('tasks.titleRequired');
    }
    if (!formData.project_id) {
      errors.project_id = t('tasks.projectRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTask = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const newTask: any = {
        project_id: formData.project_id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date?.toISOString() || null,
      };

      const { error } = await mutate({
        table: 'tasks',
        operation: 'insert',
        data: newTask,
        cacheKeys: ['tasks'],
      });
      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      refresh();
      haptics.notification(NotificationFeedbackType.Success);
      showToast('success', t('tasks.taskAdded'));
    } catch (error: any) {
      secureLog.error('Error adding task:', error);
      showToast('error', error.message || t('tasks.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = async () => {
    if (!validateForm() || !selectedTask) return;

    setSaving(true);
    try {
      const { error } = await mutate({
        table: 'tasks',
        operation: 'update',
        data: {
          project_id: formData.project_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          priority: formData.priority,
          due_date: formData.due_date?.toISOString() || null,
        },
        matchValue: selectedTask.id,
        cacheKeys: ['tasks'],
      });

      if (error) throw error;

      setShowEditModal(false);
      setSelectedTask(null);
      resetForm();
      refresh();
      haptics.notification(NotificationFeedbackType.Success);
      showToast('success', t('tasks.taskUpdated'));
    } catch (error: any) {
      secureLog.error('Error updating task:', error);
      showToast('error', error.message || t('tasks.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTask = (task: TaskWithProject) => {
    setTaskToDelete(task);
    setShowDeleteConfirm(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      const deletedId = taskToDelete.id;
      const { error } = await mutate({
        table: 'tasks',
        operation: 'delete',
        matchValue: deletedId,
        cacheKeys: [],
      });

      if (error) throw error;

      setShowDeleteConfirm(false);
      setShowEditModal(false);
      setShowViewModal(false);
      setSelectedTask(null);
      setTaskToDelete(null);
      await updateCacheData<any[]>('tasks', (cached) =>
        (cached ?? []).filter((t: any) => t.id !== deletedId)
      );
      showToast('success', t('tasks.taskDeleted'));
    } catch (error: any) {
      secureLog.error('Error deleting task:', error);
      showToast('error', error.message || t('tasks.loadError'));
    }
  };

  // ─── Archive Functions ──────────────────────────────────
  const archiveTask = async (task: TaskWithProject) => {
    haptics.impact();
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase.from('tasks') as any)
        .update({ archived_at: now })
        .eq('id', task.id)
        .eq('user_id', user?.id);
      if (error) throw error;
      await updateCacheData<any[]>('tasks', (cached) =>
        (cached ?? []).map((t: any) => t.id === task.id ? { ...t, archived_at: now } : t)
      );
      showToast('success', t('tasks.taskArchived'));
    } catch (error: any) {
      secureLog.error('Error archiving task:', error);
      showToast('error', error.message || t('tasks.loadError'));
    }
  };

  const unarchiveTask = async (task: TaskWithProject) => {
    haptics.impact();
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ archived_at: null })
        .eq('id', task.id)
        .eq('user_id', user?.id);
      if (error) throw error;
      await updateCacheData<any[]>('tasks', (cached) =>
        (cached ?? []).map((t: any) => t.id === task.id ? { ...t, archived_at: null } : t)
      );
      showToast('success', t('tasks.taskUnarchived'));
    } catch (error: any) {
      secureLog.error('Error unarchiving task:', error);
      showToast('error', error.message || t('tasks.loadError'));
    }
  };

  const massArchiveCompleted = async () => {
    setShowArchiveConfirm(false);
    haptics.impact();
    try {
      const completedTasks = activeTasks.filter((t) => (t.status as string) === 'completed');
      if (completedTasks.length === 0) return;
      const ids = completedTasks.map((t) => t.id);
      const now = new Date().toISOString();
      const { error } = await (supabase.from('tasks') as any)
        .update({ archived_at: now })
        .in('id', ids)
        .eq('user_id', user?.id);
      if (error) throw error;
      const idSet = new Set(ids);
      await updateCacheData<any[]>('tasks', (cached) =>
        (cached ?? []).map((t: any) => idSet.has(t.id) ? { ...t, archived_at: now } : t)
      );
      showToast('success', t('tasks.tasksArchived', { count: String(ids.length) }));
    } catch (error: any) {
      secureLog.error('Error mass archiving:', error);
      showToast('error', error.message || t('tasks.loadError'));
    }
  };

  const massDeleteArchived = async () => {
    setShowDeleteArchivedConfirm(false);
    if (!user?.id) return;
    haptics.impact();
    try {
      if (archivedTasks.length === 0) return;
      const ids = archivedTasks.map((t) => t.id);
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) throw error;
      const idSet = new Set(ids);
      await updateCacheData<any[]>('tasks', (cached) =>
        (cached ?? []).filter((t: any) => !idSet.has(t.id))
      );
      showToast('success', t('tasks.archivedDeleted'));
    } catch (error: any) {
      secureLog.error('Error deleting archived:', error);
      showToast('error', error.message || t('tasks.loadError'));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      status: 'pending',
      priority: 'medium',
      due_date: null,
    });
    setFormErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  useEffect(() => {
    if (create === 'true') {
      openAddModal();
      router.setParams({ create: '' });
    }
  }, [create]);

  useEffect(() => {
    if (openTaskId && !loading && (tasks ?? []).length > 0) {
      const task = (tasks ?? []).find(t => t.id === openTaskId);
      if (task) {
        openViewModal(task);
      }
      router.setParams({ id: '' });
    }
  }, [openTaskId, loading, tasks]);

  // View modal — read-only task details
  const openViewModal = (task: TaskWithProject) => {
    haptics.selection();
    setSelectedTask(task);
    setShowViewModal(true);
  };

  // Edit modal — editable form
  const openEditFromView = () => {
    if (!selectedTask) return;
    setShowViewModal(false);
    setFormData({
      title: selectedTask.title,
      description: selectedTask.description || '',
      project_id: selectedTask.project_id,
      status: selectedTask.status as TaskStatus,
      priority: selectedTask.priority as TaskPriority,
      due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : null,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter((task) => task.status === status);
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    haptics.impact();
    try {
      const { error } = await mutate({
        table: 'tasks',
        operation: 'update',
        data: { status: newStatus },
        matchValue: taskId,
        cacheKeys: ['tasks'],
      });

      if (error) throw error;

      // Refresh to get updated data
      refresh();

      // Also update selected task if viewing it
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: newStatus } as any : null);
      }
    } catch (error) {
      secureLog.error('Error updating task status:', error);
      showToast('error', t('tasks.loadError'));
      // Revert on error
      refresh();
    }
  };

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, [locale]);

  const formatDateLong = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [locale]);

  const isOverdue = useCallback((dueDateStr: string | null, status: string) => {
    if (!dueDateStr || status === 'completed') return false;
    return new Date(dueDateStr) < new Date();
  }, []);

  const projectOptions = useMemo(() =>
    projects.map((p) => {
      const clientName = (p as any).client?.name;
      return { key: p.id, label: clientName ? `${p.name} (${clientName})` : p.name };
    }),
    [projects]
  );

  // ─── Status Action Buttons (larger, with text) ──────────
  const renderStatusActions = (task: TaskWithProject) => {
    const actions: { label: string; icon: string; status: TaskStatus; color: string; bgColor: string }[] = [];

    if ((task.status as string) === 'backlog') {
      actions.push({
        label: t('tasks.todo'),
        icon: 'arrow-forward',
        status: 'pending',
        color: statusConfig.pending.color,
        bgColor: statusConfig.pending.bgColor,
      });
    }
    if ((task.status as string) === 'pending') {
      actions.push({
        label: t('tasks.addToBacklog'),
        icon: 'archive-outline',
        status: 'backlog',
        color: statusConfig.backlog.color,
        bgColor: statusConfig.backlog.bgColor,
      });
      actions.push({
        label: t('tasks.start'),
        icon: 'play',
        status: 'in_progress',
        color: statusConfig.in_progress.color,
        bgColor: statusConfig.in_progress.bgColor,
      });
    }
    if (task.status === 'in_progress') {
      actions.push({
        label: t('tasks.todo'),
        icon: 'arrow-back',
        status: 'pending',
        color: statusConfig.pending.color,
        bgColor: statusConfig.pending.bgColor,
      });
      actions.push({
        label: t('tasks.done'),
        icon: 'checkmark',
        status: 'completed',
        color: statusConfig.completed.color,
        bgColor: statusConfig.completed.bgColor,
      });
    }
    if (task.status === 'completed') {
      actions.push({
        label: t('tasks.reopen'),
        icon: 'refresh',
        status: 'in_progress',
        color: statusConfig.in_progress.color,
        bgColor: statusConfig.in_progress.bgColor,
      });
    }

    return (
      <View style={[styles.statusActions, { borderTopColor: colors.borderLight }]}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.status}
            style={[styles.statusButton, { backgroundColor: action.bgColor }]}
            onPress={() => updateTaskStatus(task.id, action.status)}
            activeOpacity={0.7}
          >
            <Ionicons name={action.icon as any} size={14} color={action.color} />
            <Text style={[styles.statusButtonText, { color: action.color }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
        {task.status === 'completed' && (
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => archiveTask(task)}
            activeOpacity={0.7}
          >
            <Ionicons name="archive-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.statusButtonText, { color: colors.textTertiary }]}>
              {t('tasks.archiveTask')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Task Card ──────────────────────────────────────────
  const renderTaskCard = (task: TaskWithProject) => {
    const overdue = isOverdue(task.due_date, task.status);
    const config = statusConfig[task.status as TaskStatus] || statusConfig.pending;

    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openViewModal(task)}
        activeOpacity={0.7}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <View
              style={[styles.priorityDot, { backgroundColor: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]}
            />
            <Text style={[styles.taskPriority, { color: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]}>
              {t(`tasks.${task.priority}`)}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.statusChipText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <Text
          style={[
            styles.taskTitle,
            { color: colors.text },
            task.status === 'completed' && styles.taskTitleCompleted,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {task.description && (
          <Text style={[styles.taskDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        <View style={styles.taskFooter}>
          <Text style={[styles.projectName, { color: colors.textTertiary }]} numberOfLines={1}>
            {(task.project as any)?.name || t('tasks.noProject')}
          </Text>

          {task.due_date && (
            <View style={[styles.dueDate, overdue && { backgroundColor: colors.errorLight, borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={overdue ? colors.error : colors.textTertiary}
              />
              <Text style={[styles.dueDateText, { color: overdue ? colors.error : colors.textTertiary }]}>
                {formatDate(task.due_date)}
              </Text>
              {overdue && (
                <Text style={[styles.overdueLabel, { color: colors.error }]}>
                  {t('tasks.overdue')}
                </Text>
              )}
            </View>
          )}
        </View>

        {renderStatusActions(task)}
      </TouchableOpacity>
    );
  };

  // ─── Board Card (compact, no status chip) ───────────────
  const renderBoardCard = (task: TaskWithProject) => {
    const overdue = isOverdue(task.due_date, task.status);

    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openViewModal(task)}
        activeOpacity={0.7}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]} />
            <Text style={[styles.taskPriority, { color: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]}>
              {t(`tasks.${task.priority}`)}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.taskTitle, { color: colors.text }, task.status === 'completed' && styles.taskTitleCompleted]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <View style={styles.taskFooter}>
          <Text style={[styles.projectName, { color: colors.textTertiary }]} numberOfLines={1}>
            {(task.project as any)?.name || t('tasks.noProject')}
          </Text>
          {task.due_date && (
            <View style={[styles.dueDate, overdue && { backgroundColor: colors.errorLight, borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Ionicons name="calendar-outline" size={12} color={overdue ? colors.error : colors.textTertiary} />
              <Text style={[styles.dueDateText, { color: overdue ? colors.error : colors.textTertiary }]}>
                {formatDate(task.due_date)}
              </Text>
            </View>
          )}
        </View>

        {renderStatusActions(task)}
      </TouchableOpacity>
    );
  };

  // ─── Board Column ───────────────────────────────────────
  const renderColumn = (status: TaskStatus) => {
    const config = statusConfig[status];
    const columnTasks = getTasksByStatus(status);

    return (
      <View key={status} style={[styles.column, { width: COLUMN_WIDTH }]}>
        <View style={[styles.columnHeader, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={18} color={config.color} />
          <Text style={[styles.columnTitle, { color: config.color }]}>
            {config.label}
          </Text>
          <View style={[styles.columnCount, { backgroundColor: config.color + '20' }]}>
            <Text style={[styles.columnCountText, { color: config.color }]}>
              {columnTasks.length}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.columnContent} showsVerticalScrollIndicator={false}>
          {columnTasks.map((task) => renderBoardCard(task))}

          {columnTasks.length === 0 && (
            <View style={styles.emptyColumn}>
              <Ionicons name={config.icon} size={32} color={colors.textTertiary + '40'} />
              <Text style={[styles.emptyColumnText, { color: colors.textTertiary }]}>
                {t('tasks.noTasks')}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // ─── Backlog Drawer (board view) ─────────────────────────
  const backlogTasks = useMemo(() => getTasksByStatus('backlog'), [filteredTasks]);

  const renderBacklogDrawer = () => {
    if (backlogTasks.length === 0 && !backlogExpanded) return null;

    const config = statusConfig.backlog;

    return (
      <View style={[styles.backlogDrawer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backlogHandle}
          onPress={() => {
            haptics.selection();
            setBacklogExpanded(!backlogExpanded);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.backlogHandleLeft}>
            <Ionicons name={config.icon} size={22} color={config.color} />
            <Text style={[styles.backlogTitle, { color: config.color }]}>
              {t('tasks.backlogDrawer')}
            </Text>
            <View style={[styles.backlogCount, { backgroundColor: config.bgColor }]}>
              <Text style={[styles.backlogCountText, { color: config.color }]}>
                {backlogTasks.length}
              </Text>
            </View>
          </View>
          <Ionicons
            name={backlogExpanded ? 'chevron-down' : 'chevron-up'}
            size={24}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {backlogExpanded && (
          <View style={styles.backlogContent}>
            {backlogTasks.length === 0 ? (
              <View style={styles.backlogEmpty}>
                <Ionicons name="archive-outline" size={28} color={colors.textTertiary + '60'} />
                <Text style={[styles.backlogEmptyText, { color: colors.textTertiary }]}>
                  {t('tasks.backlogEmpty')}
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.backlogScroll}
              >
                {backlogTasks.map((task) => {
                  const overdue = isOverdue(task.due_date, task.status);
                  return (
                    <TouchableOpacity
                      key={task.id}
                      style={[styles.backlogCard, { backgroundColor: colors.background, borderColor: colors.borderLight }]}
                      onPress={() => openViewModal(task)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.taskHeader}>
                        <View style={styles.taskHeaderLeft}>
                          <View style={[styles.priorityDot, { backgroundColor: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]} />
                          <Text style={[styles.taskPriority, { color: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]}>
                            {t(`tasks.${task.priority}`)}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
                        {task.title}
                      </Text>

                      <View style={styles.taskFooter}>
                        <Text style={[styles.projectName, { color: colors.textTertiary }]} numberOfLines={1}>
                          {(task.project as any)?.name || t('tasks.noProject')}
                        </Text>
                        {task.due_date && (
                          <View style={[styles.dueDate, overdue && { backgroundColor: colors.errorLight, borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 }]}>
                            <Ionicons name="calendar-outline" size={12} color={overdue ? colors.error : colors.textTertiary} />
                            <Text style={[styles.dueDateText, { color: overdue ? colors.error : colors.textTertiary }]}>
                              {formatDate(task.due_date)}
                            </Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.addToBoardButton, { backgroundColor: statusConfig.pending.bgColor }]}
                        onPress={() => updateTaskStatus(task.id, 'pending')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle-outline" size={14} color={statusConfig.pending.color} />
                        <Text style={[styles.addToBoardText, { color: statusConfig.pending.color }]}>
                          {t('tasks.addToBoard')}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    );
  };

  // ─── Stats Bar ──────────────────────────────────────────
  const renderStats = () => (
    <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('tasks.totalTasks')}</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: statusConfig.pending.color }]}>{stats.pending}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('tasks.todo')}</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: statusConfig.in_progress.color }]}>{stats.inProgress}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('tasks.inProgress')}</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: statusConfig.completed.color }]}>{stats.completed}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('tasks.completed')}</Text>
      </View>
    </View>
  );

  // ─── List View with Status Sections ─────────────────────
  const renderListView = () => {
    if (filteredTasks.length === 0) {
      return (
        <EmptyState
          icon="checkbox-outline"
          title={searchQuery || filterStatus !== 'all' || filterPriority !== 'all' ? t('tasks.noResults') : t('tasks.noTasks')}
          description={
            searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
              ? t('tasks.tryDifferentSearch')
              : t('tasks.noTasksDesc')
          }
          actionLabel={!searchQuery && filterStatus === 'all' ? t('tasks.addTask') : undefined}
          onAction={!searchQuery && filterStatus === 'all' ? openAddModal : undefined}
          offline={isOffline && !(tasks ?? []).length && !searchQuery}
        />
      );
    }

    // If filtering by specific status, show flat list
    if (filterStatus !== 'all') {
      return filteredTasks.map((task) => renderTaskCard(task));
    }

    // Otherwise group by status
    const allSections: { status: TaskStatus; tasks: TaskWithProject[] }[] = [
      { status: 'in_progress' as TaskStatus, tasks: getTasksByStatus('in_progress') },
      { status: 'pending' as TaskStatus, tasks: getTasksByStatus('pending') },
      { status: 'backlog' as TaskStatus, tasks: getTasksByStatus('backlog') },
      { status: 'completed' as TaskStatus, tasks: getTasksByStatus('completed') },
    ];
    const sections = allSections.filter((s) => s.tasks.length > 0);

    return sections.map((section) => {
      const config = statusConfig[section.status];
      return (
        <View key={section.status}>
          <View style={styles.sectionHeader}>
            <Ionicons name={config.icon} size={16} color={config.color} />
            <Text style={[styles.sectionTitle, { color: config.color }]}>
              {config.label}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: config.bgColor }]}>
              <Text style={[styles.sectionCountText, { color: config.color }]}>
                {section.tasks.length}
              </Text>
            </View>
          </View>
          {section.tasks.map((task) => renderTaskCard(task))}
        </View>
      );
    });
  };

  // ─── Archived Section (collapsible, list view) ──────────
  const renderArchivedSection = () => {
    if (archivedTasks.length === 0 && !archivedExpanded) return null;

    return (
      <View style={{ marginTop: Spacing.lg }}>
        {/* Archive all completed button */}
        {stats.completed > 0 && (
          <TouchableOpacity
            style={[styles.archiveAllButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowArchiveConfirm(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="archive-outline" size={16} color={colors.primary} />
            <Text style={[styles.archiveAllText, { color: colors.primary }]}>
              {t('tasks.massArchive')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Archived drawer */}
        {(archivedTasks.length > 0) && (
          <View style={[styles.archivedDrawer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.archivedHandle}
              onPress={() => {
                haptics.selection();
                setArchivedExpanded(!archivedExpanded);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.archivedHandleLeft}>
                <Ionicons name="archive" size={18} color={colors.textTertiary} />
                <Text style={[styles.archivedTitle, { color: colors.textTertiary }]}>
                  {t('tasks.archived')}
                </Text>
                <View style={[styles.archivedCount, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.archivedCountText, { color: colors.textTertiary }]}>
                    {archivedTasks.length}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={archivedExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {archivedExpanded && (
              <View style={styles.archivedContent}>
                {/* Mass delete button */}
                <TouchableOpacity
                  style={[styles.massDeleteButton, { backgroundColor: colors.errorLight }]}
                  onPress={() => setShowDeleteArchivedConfirm(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <Text style={[styles.massDeleteText, { color: colors.error }]}>
                    {t('tasks.deleteAllArchived')}
                  </Text>
                </TouchableOpacity>

                {archivedTasks.map((task) => (
                  <View
                    key={task.id}
                    style={[styles.archivedCard, { backgroundColor: colors.background, borderColor: colors.borderLight }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.archivedTaskTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.archivedTaskMeta, { color: colors.textTertiary }]}>
                        {t('tasks.archivedOn', { date: formatDate((task as any).archived_at) })}
                        {' · '}
                        {(task.project as any)?.name || t('tasks.noProject')}
                      </Text>
                    </View>
                    <View style={styles.archivedActions}>
                      <TouchableOpacity
                        style={[styles.archivedActionBtn, { backgroundColor: colors.infoLight }]}
                        onPress={() => unarchiveTask(task)}
                      >
                        <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.archivedActionBtn, { backgroundColor: colors.errorLight }]}
                        onPress={() => confirmDeleteTask(task)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ─── View Modal (read-only) ─────────────────────────────
  const renderViewModal = () => {
    if (!selectedTask) return null;
    const task = selectedTask;
    const config = statusConfig[task.status as TaskStatus] || statusConfig.pending;
    const overdue = isOverdue(task.due_date, task.status);

    return (
      <View>
        {/* Status + Priority badges */}
        <View style={styles.viewBadgeRow}>
          <View style={[styles.viewBadge, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.viewBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          <View style={[styles.viewBadge, { backgroundColor: (priorityColors[task.priority as TaskPriority] || colors.textTertiary) + '18' }]}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]} />
            <Text style={[styles.viewBadgeText, { color: priorityColors[task.priority as TaskPriority] || colors.textTertiary }]}>
              {t(`tasks.${task.priority}`)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.viewTitle, { color: colors.text }, task.status === 'completed' && styles.taskTitleCompleted]}>
          {task.title}
        </Text>

        {/* Description */}
        <View style={[styles.viewSection, { borderColor: colors.borderLight }]}>
          <Text style={[styles.viewSectionLabel, { color: colors.textTertiary }]}>{t('tasks.description')}</Text>
          <Text style={[styles.viewDescription, { color: task.description ? colors.textSecondary : colors.textTertiary }]}>
            {task.description || t('tasks.noDescription')}
          </Text>
        </View>

        {/* Details grid */}
        <View style={[styles.viewDetailsGrid, { borderColor: colors.borderLight }]}>
          <View style={styles.viewDetailItem}>
            <Ionicons name="folder-outline" size={16} color={colors.textTertiary} />
            <View>
              <Text style={[styles.viewDetailLabel, { color: colors.textTertiary }]}>{t('tasks.project')}</Text>
              <Text style={[styles.viewDetailValue, { color: colors.text }]}>
                {(task.project as any)?.name || t('tasks.noProject')}
              </Text>
            </View>
          </View>

          {task.due_date && (
            <View style={styles.viewDetailItem}>
              <Ionicons name="calendar-outline" size={16} color={overdue ? colors.error : colors.textTertiary} />
              <View>
                <Text style={[styles.viewDetailLabel, { color: colors.textTertiary }]}>{t('tasks.dueDate')}</Text>
                <Text style={[styles.viewDetailValue, { color: overdue ? colors.error : colors.text }]}>
                  {formatDateLong(task.due_date)}
                  {overdue ? ` — ${t('tasks.overdue')}` : ''}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.viewDetailItem}>
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <View>
              <Text style={[styles.viewDetailLabel, { color: colors.textTertiary }]}>{t('tasks.created')}</Text>
              <Text style={[styles.viewDetailValue, { color: colors.text }]}>
                {formatDateLong(task.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick move buttons */}
        <Text style={[styles.viewMoveLabel, { color: colors.textTertiary }]}>{t('tasks.moveTo')}</Text>
        <View style={styles.viewMoveRow}>
          {(['backlog', 'pending', 'in_progress', 'completed'] as TaskStatus[])
            .filter((s) => s !== task.status)
            .map((targetStatus) => {
              const targetConfig = statusConfig[targetStatus];
              return (
                <TouchableOpacity
                  key={targetStatus}
                  style={[styles.viewMoveButton, { backgroundColor: targetConfig.bgColor }]}
                  onPress={() => {
                    updateTaskStatus(task.id, targetStatus);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={targetConfig.icon} size={16} color={targetConfig.color} />
                  <Text style={[styles.viewMoveButtonText, { color: targetConfig.color }]}>
                    {targetConfig.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>

        {/* Actions */}
        <View style={[styles.viewActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.delete')}
            onPress={() => confirmDeleteTask(task)}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title={t('common.edit')}
            onPress={openEditFromView}
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  };

  // ─── Form Content ───────────────────────────────────────
  const renderFormContent = () => (
    <View>
      <Input
        label={`${t('tasks.taskTitle')} *`}
        placeholder={t('tasks.taskTitlePlaceholder')}
        value={formData.title}
        onChangeText={(text) => setFormData({ ...formData, title: text })}
        error={formErrors.title}
        leftIcon="checkbox-outline"
      />

      <Select
        label={`${t('tasks.project')} *`}
        placeholder={t('tasks.selectProject')}
        options={projectOptions}
        value={formData.project_id}
        onChange={(value) => setFormData({ ...formData, project_id: value })}
        error={formErrors.project_id}
        searchable
      />

      <Input
        label={t('tasks.description')}
        placeholder={t('tasks.descriptionPlaceholder')}
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Select
            label={t('tasks.status')}
            options={formStatusOptions}
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
          />
        </View>
        <View style={styles.halfWidth}>
          <Select
            label={t('tasks.priority')}
            options={formPriorityOptions}
            value={formData.priority}
            onChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}
          />
        </View>
      </View>

      <DatePicker
        label={t('tasks.dueDate')}
        value={formData.due_date}
        onChange={(date) => setFormData({ ...formData, due_date: date })}
        placeholder={t('tasks.dueDate')}
      />
    </View>
  );

  // ─── Filter/Sort Modal Content ──────────────────────────
  const renderFilterModal = () => (
    <View>
      <Text style={[styles.filterModalLabel, { color: colors.textSecondary }]}>{t('tasks.priority')}</Text>
      <View style={styles.filterModalChips}>
        {priorityFilterOptions.map((opt) => {
          const isActive = filterPriority === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterModalChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilterPriority(opt.key)}
            >
              <Text style={[styles.filterModalChipText, { color: colors.textSecondary }, isActive && { color: '#fff' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.filterModalLabel, { color: colors.textSecondary, marginTop: Spacing.lg }]}>{t('tasks.sortBy')}</Text>
      <View style={styles.filterModalChips}>
        {sortOptions.map((opt) => {
          const isActive = sortBy === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterModalChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.filterModalChipText, { color: colors.textSecondary }, isActive && { color: '#fff' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
        <Button
          title={t('tasks.allStatuses')}
          onPress={() => { setFilterPriority('all'); setSortBy('newest'); }}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title={t('tasks.done')}
          onPress={() => setShowFilterModal(false)}
          style={styles.actionButton}
        />
      </View>
    </View>
  );

  // ─── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: colors.text }]}>{t('tasks.title')}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={6} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Render ────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t('tasks.title')}</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{activeTasks.length}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'list' && { backgroundColor: colors.primary }]}
              onPress={() => { setViewMode('list'); haptics.selection(); }}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? '#fff' : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, viewMode === 'board' && { backgroundColor: colors.primary }]}
              onPress={() => { setViewMode('board'); haptics.selection(); }}
            >
              <Ionicons name="grid-outline" size={18} color={viewMode === 'board' ? '#fff' : colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search + Filters + Stats + Content */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
          <View style={styles.searchRow}>
            <View style={styles.searchFlex}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('tasks.searchPlaceholder')}
              />
            </View>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.filterContainer}>
            <FilterChips
              options={statusFilterOptions}
              selected={filterStatus}
              onSelect={setFilterStatus}
              scrollable
            />
          </View>
          <View style={styles.statsContainer}>
            {renderStats()}
          </View>
        </Animated.View>

        {/* Content */}
        {viewMode === 'board' ? (
          <View style={[styles.boardWrapper, { paddingTop: filterHeight }]}>
            <ScrollView
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.boardContainer}
              style={styles.boardScroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map(renderColumn)}
            </ScrollView>

            {/* Backlog Drawer */}
            {renderBacklogDrawer()}
          </View>
        ) : (
          <Animated.ScrollView
            style={styles.listContainer}
            contentContainerStyle={[styles.listContent, { paddingTop: filterHeight }]}
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {renderListView()}
            {renderArchivedSection()}
          </Animated.ScrollView>
        )}
      </View>

      {/* View Task Modal (read-only) */}
      <Modal
        visible={showViewModal}
        onClose={() => { setShowViewModal(false); setSelectedTask(null); }}
        title={t('tasks.viewTask')}
        size="full"
      >
        {renderViewModal()}
      </Modal>

      {/* Add Task Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('tasks.addTask')}
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
            title={t('tasks.createTask')}
            onPress={handleAddTask}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedTask(null); }}
        title={t('tasks.editTask')}
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.delete')}
            onPress={() => selectedTask && confirmDeleteTask(selectedTask)}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title={t('common.cancel')}
            onPress={() => { setShowEditModal(false); setSelectedTask(null); }}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleEditTask}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Filter/Sort Modal */}
      <Modal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title={t('tasks.filterSort')}
      >
        {renderFilterModal()}
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('tasks.deleteTitle')}
        message={t('tasks.deleteMessage', { name: taskToDelete?.title || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={handleDeleteTask}
        onCancel={() => { setShowDeleteConfirm(false); setTaskToDelete(null); }}
      />

      {/* Archive All Completed Confirm */}
      <ConfirmDialog
        visible={showArchiveConfirm}
        title={t('tasks.archiveConfirmTitle')}
        message={t('tasks.archiveConfirmMessage')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={massArchiveCompleted}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Delete All Archived Confirm */}
      <ConfirmDialog
        visible={showDeleteArchivedConfirm}
        title={t('tasks.deleteArchivedTitle')}
        message={t('tasks.deleteArchivedMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={massDeleteArchived}
        onCancel={() => setShowDeleteArchivedConfirm(false)}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 3,
    borderWidth: 1,
  },
  viewButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search + filter row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchFlex: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  filterContainer: {
    marginBottom: Spacing.sm,
  },
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
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
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  // Board
  boardWrapper: {
    flex: 1,
  },
  boardScroll: {
    flex: 1,
  },
  boardContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  column: {
    marginRight: Spacing.md,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  columnTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  columnCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  columnCountText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  columnContent: {
    flex: 1,
  },
  emptyColumn: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
  },
  emptyColumnText: {
    fontSize: FontSizes.sm,
  },
  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  sectionCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Task Card
  taskCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  taskPriority: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  taskTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskDescription: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  projectName: {
    fontSize: FontSizes.xs,
    flex: 1,
  },
  dueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: FontSizes.xs,
  },
  overdueLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    marginLeft: 2,
  },
  // Status action buttons — pill shaped with text
  statusActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statusButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // View modal
  viewBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  viewBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  viewTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  viewSection: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  viewSectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  viewDescription: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  viewDetailsGrid: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  viewDetailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  viewDetailLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  viewDetailValue: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  viewMoveLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  viewMoveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  viewMoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  viewMoveButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  viewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  // Filter modal
  filterModalLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  filterModalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterModalChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterModalChipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  // Form / Modal
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
  deleteButton: {
    marginRight: 'auto',
  },
  // Backlog Drawer
  backlogDrawer: {
    borderTopWidth: 1,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing['4xl'],
    overflow: 'hidden',
  },
  backlogHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    minHeight: 56,
  },
  backlogHandleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backlogTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  backlogCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  backlogCountText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  backlogContent: {
    paddingBottom: Spacing.md,
  },
  backlogScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  backlogCard: {
    width: 200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  backlogEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  backlogEmptyText: {
    fontSize: FontSizes.sm,
  },
  addToBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  addToBoardText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Archive section
  archiveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  archiveAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  archivedDrawer: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  archivedHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  archivedHandleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  archivedTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  archivedCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  archivedCountText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  archivedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  massDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  massDeleteText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  archivedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  archivedTaskTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  archivedTaskMeta: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  archivedActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  archivedActionBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
