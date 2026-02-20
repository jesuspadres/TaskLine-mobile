import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotificationFeedbackType } from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { ENV } from '@/lib/env';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useCollapsibleFilters } from '@/hooks/useCollapsibleFilters';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import {
  Modal, Input, Button, Select, DatePicker, EmptyState,
  SearchBar, ListSkeleton, ConfirmDialog,
  showToast,
} from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { secureLog } from '@/lib/security';
import type { Client, Project } from '@/lib/database.types';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface InvoiceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  payment_terms: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string } | null;
  client?: { id: string; name: string; email: string; company: string | null } | null;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  order_index: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export default function InvoicesScreen() {
  const router = useRouter();
  const { create, project_id, client_id, id: openInvoiceId } = useLocalSearchParams<{
    create?: string;
    project_id?: string;
    client_id?: string;
    id?: string;
  }>();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();

  const { data: invoices, loading, refreshing, isOffline, refresh } = useOfflineData<InvoiceRow[]>(
    'invoices',
    async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, project:projects(id, name), client:clients(id, name, email, company)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as InvoiceRow[]) || [];
    },
  );
  const { mutate } = useOfflineMutation();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showSortModal, setShowSortModal] = useState(false);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [viewLineItems, setViewLineItems] = useState<InvoiceItemRow[]>([]);

  // Add/edit modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceRow | null>(null);

  // Form state
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formStatus, setFormStatus] = useState('draft');
  const [formIssueDate, setFormIssueDate] = useState<Date | null>(new Date());
  const [formDueDate, setFormDueDate] = useState<Date | null>(null);
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0 },
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ─── Theme-dependent configs ────────────────────────────
  const statusConfig = useMemo(() => ({
    draft: {
      label: t('invoices.draft'),
      color: colors.textTertiary,
      bgColor: colors.surfaceSecondary,
      icon: 'document-outline' as const,
    },
    sent: {
      label: t('invoices.sent'),
      color: colors.primary,
      bgColor: colors.infoLight,
      icon: 'send-outline' as const,
    },
    paid: {
      label: t('invoices.paid'),
      color: colors.success,
      bgColor: colors.successLight,
      icon: 'checkmark-circle-outline' as const,
    },
    overdue: {
      label: t('invoices.overdue'),
      color: colors.error,
      bgColor: colors.errorLight,
      icon: 'alert-circle-outline' as const,
    },
    cancelled: {
      label: t('invoices.cancelled'),
      color: colors.textTertiary,
      bgColor: colors.surfaceSecondary,
      icon: 'close-circle-outline' as const,
    },
  }), [colors, t]);

  const statusFilterOptions = useMemo(() => [
    { key: 'all', label: t('invoices.all') },
    { key: 'draft', label: t('invoices.draft') },
    { key: 'sent', label: t('invoices.sent') },
    { key: 'paid', label: t('invoices.paid') },
    { key: 'overdue', label: t('invoices.overdue') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { key: 'newest', label: t('invoices.newest') },
    { key: 'oldest', label: t('invoices.oldest') },
    { key: 'amountHigh', label: t('invoices.amountHigh') },
    { key: 'amountLow', label: t('invoices.amountLow') },
    { key: 'dueEarliest', label: t('invoices.dueEarliest') },
    { key: 'dueLatest', label: t('invoices.dueLatest') },
  ], [t]);

  const formStatusOptions = useMemo(() => [
    { key: 'draft', label: t('invoices.draft') },
    { key: 'sent', label: t('invoices.sent') },
    { key: 'paid', label: t('invoices.paid') },
    { key: 'overdue', label: t('invoices.overdue') },
    { key: 'cancelled', label: t('invoices.cancelled') },
  ], [t]);

  const clientOptions = useMemo(() =>
    clients.map(c => ({ key: c.id, label: c.email ? `${c.name} (${c.email})` : c.name })),
    [clients]
  );

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [clients]);

  const projectOptions = useMemo(() => [
    { key: '', label: t('invoices.noProject') },
    ...projects.map(p => {
      const clientName = (p as any).client_id ? clientMap[(p as any).client_id] : null;
      return { key: p.id, label: clientName ? `${p.name} (${clientName})` : p.name };
    }),
  ], [projects, t, clientMap]);

  // ─── Data fetching (clients/projects for dropdowns) ────
  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching clients:', error);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');
      if (error) throw error;
      setProjects((data as Project[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching projects:', error);
    }
  }, []);

  const fetchInvoiceItems = useCallback(async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('order_index');

      if (error) throw error;
      return (data as InvoiceItemRow[]) || [];
    } catch (error) {
      secureLog.error('Error fetching invoice items:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchProjects();
  }, [fetchClients, fetchProjects]);

  // ─── Compute display status (auto-detect overdue) ──────
  const getDisplayStatus = useCallback((invoice: InvoiceRow): InvoiceStatus => {
    if (invoice.status === 'sent' && invoice.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(invoice.due_date) < today) return 'overdue';
    }
    return invoice.status;
  }, []);

  // ─── Filter & sort ─────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = (invoices ?? []).filter((inv) => {
      const displayStatus = getDisplayStatus(inv);
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(query) ||
        ((inv.client as any)?.name?.toLowerCase().includes(query) ?? false) ||
        ((inv.project as any)?.name?.toLowerCase().includes(query) ?? false);

      const matchesStatus = filterStatus === 'all' || displayStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'amountHigh':
          return b.total - a.total;
        case 'amountLow':
          return a.total - b.total;
        case 'dueEarliest':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'dueLatest':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [invoices, searchQuery, filterStatus, sortBy, getDisplayStatus]);

  // ─── Stats (current month only) ────────────────────────
  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let outstanding = 0;
    let draftCount = 0;
    let sentCount = 0;
    let paidCount = 0;
    let overdueCount = 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    (invoices ?? []).forEach((inv) => {
      const issueDate = inv.issue_date ? new Date(inv.issue_date) : null;
      if (!issueDate || issueDate < monthStart || issueDate >= monthEnd) return;

      const displayStatus = getDisplayStatus(inv);
      total += inv.total;
      if (displayStatus === 'paid') {
        paid += inv.total;
        paidCount++;
      }
      if (displayStatus === 'sent' || displayStatus === 'overdue') {
        outstanding += inv.total;
      }
      if (displayStatus === 'draft') draftCount++;
      if (displayStatus === 'sent') sentCount++;
      if (displayStatus === 'overdue') overdueCount++;
    });

    return { total, paid, outstanding, draftCount, sentCount, paidCount, overdueCount };
  }, [invoices, getDisplayStatus]);

  const activeSortCount = useMemo(() => sortBy !== 'newest' ? 1 : 0, [sortBy]);

  // ─── Formatting ────────────────────────────────────────
  const formatCurrency = useCallback((amount: number, decimals = true) => {
    return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(amount);
  }, [locale]);

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

  // ─── Invoice number generation ─────────────────────────
  const generateInvoiceNumber = useCallback(async (): Promise<string> => {
    if (!user) return fallbackInvoiceNumber();
    try {
      const { data, error } = await (supabase.rpc as any)('generate_invoice_number', {
        p_user_id: user.id,
      });
      if (error || !data) return fallbackInvoiceNumber();
      return data as string;
    } catch {
      return fallbackInvoiceNumber();
    }
  }, [user]);

  const fallbackInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  // ─── Line item helpers ─────────────────────────────────
  const calculateSubtotal = useCallback(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [lineItems]);

  const calculateTaxAmount = useCallback(() => {
    const rate = parseFloat(formTaxRate) || 0;
    return Math.round(calculateSubtotal() * (rate / 100) * 100) / 100;
  }, [calculateSubtotal, formTaxRate]);

  const calculateTotal = useCallback(() => {
    return calculateSubtotal() + calculateTaxAmount();
  }, [calculateSubtotal, calculateTaxAmount]);

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // ─── Form helpers ──────────────────────────────────────
  const resetForm = () => {
    setFormInvoiceNumber('');
    setFormClientId('');
    setFormProjectId('');
    setFormStatus('draft');
    setFormIssueDate(new Date());
    setFormDueDate(null);
    setFormPaymentTerms('');
    setFormTaxRate('0');
    setFormNotes('');
    setLineItems([{ id: '1', description: '', quantity: 1, unit_price: 0 }]);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formInvoiceNumber.trim()) errors.invoiceNumber = t('invoices.numberRequired');
    if (!formClientId) errors.client = t('invoices.clientRequired');
    if (!formIssueDate) errors.issueDate = t('invoices.issueDateRequired');
    if (lineItems.every(item => !item.description.trim() || item.unit_price === 0)) {
      errors.lineItems = t('invoices.lineItemRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── CRUD operations ──────────────────────────────────
  const openAddModal = async () => {
    resetForm();
    const invoiceNumber = await generateInvoiceNumber();
    setFormInvoiceNumber(invoiceNumber);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (create === 'true') {
      openAddModal().then(() => {
        if (project_id) setFormProjectId(project_id);
        if (client_id) setFormClientId(client_id);
      });
      router.setParams({ create: '', project_id: '', client_id: '' });
    }
  }, [create]);

  useEffect(() => {
    if (openInvoiceId && !loading && (invoices ?? []).length > 0) {
      const invoice = (invoices ?? []).find(inv => inv.id === openInvoiceId);
      if (invoice) {
        openViewModal(invoice);
      }
      router.setParams({ id: '' });
    }
  }, [openInvoiceId, loading, invoices]);

  const openViewModal = async (invoice: InvoiceRow) => {
    haptics.selection();
    setSelectedInvoice(invoice);
    const items = await fetchInvoiceItems(invoice.id);
    setViewLineItems(items);
    setShowViewModal(true);
  };

  const openEditFromView = async () => {
    if (!selectedInvoice) return;
    setShowViewModal(false);

    setFormInvoiceNumber(selectedInvoice.invoice_number);
    setFormClientId(selectedInvoice.client_id || '');
    setFormProjectId(selectedInvoice.project_id || '');
    setFormStatus(selectedInvoice.status);
    setFormIssueDate(new Date(selectedInvoice.issue_date));
    setFormDueDate(selectedInvoice.due_date ? new Date(selectedInvoice.due_date) : null);
    setFormPaymentTerms(selectedInvoice.payment_terms || '');
    setFormTaxRate(String(selectedInvoice.tax_rate || 0));
    setFormNotes(selectedInvoice.notes || '');

    // Load line items from DB
    const items = viewLineItems.length > 0 ? viewLineItems : await fetchInvoiceItems(selectedInvoice.id);
    if (items.length > 0) {
      setLineItems(items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })));
    } else {
      setLineItems([{
        id: '1',
        description: t('invoices.itemDescriptionPlaceholder'),
        quantity: 1,
        unit_price: selectedInvoice.total,
      }]);
    }

    setFormErrors({});
    setShowEditModal(true);
  };

  const handleAddInvoice = async () => {
    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const taxRate = parseFloat(formTaxRate) || 0;
      const taxAmount = calculateTaxAmount();
      const total = subtotal + taxAmount;

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: formInvoiceNumber.trim(),
          client_id: formClientId,
          project_id: formProjectId || null,
          status: formStatus as InvoiceStatus,
          issue_date: formIssueDate?.toISOString().split('T')[0],
          due_date: formDueDate?.toISOString().split('T')[0] || null,
          payment_terms: formPaymentTerms.trim() || null,
          notes: formNotes.trim() || null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Save line items
      const validItems = lineItems.filter(item => item.description.trim());
      if (validItems.length > 0 && invoiceData) {
        const itemsToInsert = validItems.map((item, index) => ({
          invoice_id: (invoiceData as any).id,
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
          order_index: index,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) secureLog.error('Error saving line items:', itemsError);
      }

      setShowAddModal(false);
      resetForm();
      refresh();
      haptics.notification(NotificationFeedbackType.Success);
      showToast('success', t('invoices.invoiceCreated'));
    } catch (error: any) {
      secureLog.error('Error creating invoice:', error);
      showToast('error', error.message || t('invoices.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateInvoice = async () => {
    if (!validateForm() || !selectedInvoice) return;

    setSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const taxRate = parseFloat(formTaxRate) || 0;
      const taxAmount = calculateTaxAmount();
      const total = subtotal + taxAmount;

      const { error: invoiceError } = await mutate({
        table: 'invoices',
        operation: 'update',
        data: {
          invoice_number: formInvoiceNumber.trim(),
          client_id: formClientId,
          project_id: formProjectId || null,
          status: formStatus as InvoiceStatus,
          issue_date: formIssueDate?.toISOString().split('T')[0],
          due_date: formDueDate?.toISOString().split('T')[0] || null,
          payment_terms: formPaymentTerms.trim() || null,
          notes: formNotes.trim() || null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
        },
        matchValue: selectedInvoice.id,
        cacheKeys: ['invoices'],
      });

      if (invoiceError) throw invoiceError;

      // Replace line items: delete old, insert new
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', selectedInvoice.id);

      const validItems = lineItems.filter(item => item.description.trim());
      if (validItems.length > 0) {
        const itemsToInsert = validItems.map((item, index) => ({
          invoice_id: selectedInvoice.id,
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
          order_index: index,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) secureLog.error('Error saving line items:', itemsError);
      }

      setShowEditModal(false);
      setSelectedInvoice(null);
      resetForm();
      refresh();
      haptics.notification(NotificationFeedbackType.Success);
      showToast('success', t('invoices.invoiceUpdated'));
    } catch (error: any) {
      secureLog.error('Error updating invoice:', error);
      showToast('error', error.message || t('invoices.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (invoice: InvoiceRow) => {
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      // Delete line items first
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceToDelete.id);

      const { error } = await mutate({
        table: 'invoices',
        operation: 'delete',
        matchValue: invoiceToDelete.id,
        cacheKeys: ['invoices'],
      });

      if (error) throw error;

      setShowDeleteConfirm(false);
      setShowEditModal(false);
      setShowViewModal(false);
      setSelectedInvoice(null);
      setInvoiceToDelete(null);
      refresh();
      showToast('success', t('invoices.invoiceDeleted'));
    } catch (error: any) {
      secureLog.error('Error deleting invoice:', error);
      showToast('error', error.message || t('invoices.loadError'));
    }
  };

  const handleMarkSent = async (invoice: InvoiceRow) => {
    haptics.impact();
    try {
      const { error } = await mutate({
        table: 'invoices',
        operation: 'update',
        data: { status: 'sent' },
        matchValue: invoice.id,
        cacheKeys: ['invoices'],
      });

      if (error) throw error;

      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'sent' as InvoiceStatus } : null);
      }
      refresh();
      showToast('success', t('invoices.markedSent'));
    } catch (error) {
      secureLog.error('Error marking sent:', error);
      showToast('error', t('invoices.loadError'));
      refresh();
    }
  };

  const handleMarkPaid = async (invoice: InvoiceRow) => {
    haptics.impact();
    try {
      const { error } = await mutate({
        table: 'invoices',
        operation: 'update',
        data: { status: 'paid' },
        matchValue: invoice.id,
        cacheKeys: ['invoices'],
      });

      if (error) throw error;

      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'paid' as InvoiceStatus } : null);
      }
      haptics.notification(NotificationFeedbackType.Success);
      refresh();
      showToast('success', t('invoices.markedPaid'));
    } catch (error) {
      secureLog.error('Error marking paid:', error);
      showToast('error', t('invoices.loadError'));
      refresh();
    }
  };

  const handleSendInvoice = async (invoice: InvoiceRow) => {
    haptics.impact();
    const clientEmail = (invoice.client as any)?.email;
    const clientName = (invoice.client as any)?.name || '';

    try {
      // Try server-side send first
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await fetch(`${ENV.APP_URL}/api/invoices/${invoice.id}/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          if (selectedInvoice?.id === invoice.id) {
            setSelectedInvoice(prev => prev ? { ...prev, status: 'sent' as InvoiceStatus } : null);
          }
          haptics.notification(NotificationFeedbackType.Success);
          refresh();
          showToast('success', t('invoices.invoiceSent'));
          return;
        }
      }

      // Fallback: compose email manually
      if (clientEmail) {
        const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
        const body = encodeURIComponent(
          `Hi ${clientName},\n\nPlease find invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total)}.\n\nDue: ${invoice.due_date ? formatDateLong(invoice.due_date) : 'Upon receipt'}\n\nThank you!`
        );
        await Linking.openURL(`mailto:${clientEmail}?subject=${subject}&body=${body}`);

        // Mark as sent after composing email
        await mutate({
          table: 'invoices',
          operation: 'update',
          data: { status: 'sent' },
          matchValue: invoice.id,
          cacheKeys: ['invoices'],
        });

        if (selectedInvoice?.id === invoice.id) {
          setSelectedInvoice(prev => prev ? { ...prev, status: 'sent' as InvoiceStatus } : null);
        }
        refresh();
        showToast('success', t('invoices.markedSent'));
      } else {
        showToast('error', t('invoices.noClientEmail'));
      }
    } catch (error: any) {
      secureLog.error('Error sending invoice:', error);
      showToast('error', error.message || t('invoices.sendError'));
    }
  };

  const handleDownloadPdf = async (invoice: InvoiceRow) => {
    haptics.impact();
    try {
      // Fetch line items for this invoice
      const items = viewLineItems.length > 0 && selectedInvoice?.id === invoice.id
        ? viewLineItems
        : await fetchInvoiceItems(invoice.id);

      const clientName = (invoice.client as any)?.name || t('invoices.noClient');
      const clientEmail = (invoice.client as any)?.email || '';
      const clientCompany = (invoice.client as any)?.company || '';
      const projectName = (invoice.project as any)?.name || '';
      const localeStr = locale === 'es' ? 'es-MX' : 'en-US';

      const fmtCurrency = (amount: number) =>
        new Intl.NumberFormat(localeStr, { style: 'currency', currency: 'USD' }).format(amount);

      const fmtDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString(localeStr, { year: 'numeric', month: 'long', day: 'numeric' });

      const lineItemsHtml = items.map(item => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtCurrency(item.unit_price)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtCurrency(item.amount)}</td>
        </tr>
      `).join('');

      const html = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .invoice-title { font-size: 28px; font-weight: 700; color: #0B3D91; }
            .invoice-number { font-size: 14px; color: #6b7280; margin-top: 4px; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .meta-block { }
            .meta-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 4px; }
            .meta-value { font-size: 14px; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
            th:nth-child(2) { text-align: center; }
            th:nth-child(3), th:nth-child(4) { text-align: right; }
            .totals { margin-left: auto; width: 250px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .total-row.grand { border-top: 2px solid #0B3D91; padding-top: 10px; margin-top: 6px; font-weight: 700; font-size: 18px; color: #0B3D91; }
            .notes { margin-top: 30px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 13px; color: #6b7280; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="invoice-title">${t('invoices.invoice')}</div>
              <div class="invoice-number">${invoice.invoice_number}</div>
            </div>
            <div style="text-align:right;">
              <div class="meta-label">${t('invoices.status')}</div>
              <div class="meta-value">${invoice.status.toUpperCase()}</div>
            </div>
          </div>

          <div class="meta-row">
            <div class="meta-block">
              <div class="meta-label">${t('invoices.client')}</div>
              <div class="meta-value">${clientName}</div>
              ${clientCompany ? `<div style="font-size:13px;color:#6b7280;">${clientCompany}</div>` : ''}
              ${clientEmail ? `<div style="font-size:13px;color:#6b7280;">${clientEmail}</div>` : ''}
            </div>
            <div class="meta-block" style="text-align:right;">
              <div class="meta-label">${t('invoices.issueDate')}</div>
              <div class="meta-value">${fmtDate(invoice.issue_date)}</div>
              ${invoice.due_date ? `
                <div class="meta-label" style="margin-top:10px;">${t('invoices.dueDate')}</div>
                <div class="meta-value">${fmtDate(invoice.due_date)}</div>
              ` : ''}
            </div>
          </div>

          ${projectName ? `
            <div style="margin-bottom:20px;">
              <span class="meta-label">${t('invoices.project')}: </span>
              <span class="meta-value">${projectName}</span>
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th>${t('invoices.description')}</th>
                <th>${t('invoices.qty')}</th>
                <th>${t('invoices.unitPrice')}</th>
                <th>${t('invoices.amount')}</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml || `
                <tr>
                  <td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">
                    ${t('invoices.noLineItems')}
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>${t('invoices.subtotal')}</span>
              <span>${fmtCurrency(invoice.subtotal)}</span>
            </div>
            ${invoice.tax_rate > 0 ? `
              <div class="total-row">
                <span>${t('invoices.tax')} (${invoice.tax_rate}%)</span>
                <span>${fmtCurrency(invoice.tax_amount)}</span>
              </div>
            ` : ''}
            <div class="total-row grand">
              <span>${t('invoices.total')}</span>
              <span>${fmtCurrency(invoice.total)}</span>
            </div>
          </div>

          ${invoice.notes ? `
            <div class="notes">
              <strong>${t('invoices.notes')}:</strong> ${invoice.notes}
            </div>
          ` : ''}

          ${invoice.payment_terms ? `
            <div class="notes">
              <strong>${t('invoices.paymentTerms')}:</strong> ${invoice.payment_terms}
            </div>
          ` : ''}

          <div class="footer">
            ${t('invoices.generatedBy')} TaskLine
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        // On web, use Print.printAsync to open browser print dialog
        await Print.printAsync({ html });
      } else {
        // On native, generate PDF file and share
        const { uri } = await Print.printToFileAsync({ html });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `${invoice.invoice_number}.pdf`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          showToast('info', t('invoices.pdfSaved'));
        }
      }
    } catch (error: any) {
      secureLog.error('Error generating PDF:', error);
      showToast('error', t('invoices.downloadError'));
    }
  };

  // ─── Render invoice card ──────────────────────────────
  const renderInvoice = useCallback(({ item }: { item: InvoiceRow }) => {
    const displayStatus = getDisplayStatus(item);
    const config = statusConfig[displayStatus] || statusConfig.draft;

    return (
      <TouchableOpacity
        style={[styles.invoiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openViewModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.invoiceHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.invoiceNumber, { color: colors.text }]}>{item.invoice_number}</Text>
            <Text style={[styles.clientName, { color: colors.textSecondary }]} numberOfLines={1}>
              {(item.client as any)?.name || t('invoices.noClient')}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.statusChipText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        {item.project && (
          <View style={styles.projectRow}>
            <Ionicons name="folder-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.projectName, { color: colors.textTertiary }]} numberOfLines={1}>
              {(item.project as any)?.name}
            </Text>
          </View>
        )}

        <View style={[styles.invoiceFooter, { borderTopColor: colors.borderLight }]}>
          <View style={styles.dateInfo}>
            <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>{t('invoices.issued')}</Text>
            <Text style={[styles.dateValue, { color: colors.textSecondary }]}>{formatDate(item.issue_date)}</Text>
          </View>
          {item.due_date && (
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: displayStatus === 'overdue' ? colors.error : colors.textTertiary }]}>
                {t('invoices.due')}
              </Text>
              <Text style={[styles.dateValue, { color: displayStatus === 'overdue' ? colors.error : colors.textSecondary }]}>
                {formatDate(item.due_date)}
              </Text>
            </View>
          )}
          <View style={styles.totalInfo}>
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>{t('invoices.total')}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(item.total)}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        {(displayStatus === 'draft' || displayStatus === 'sent' || displayStatus === 'overdue') && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderLight }]}>
            {displayStatus === 'draft' && (
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.infoLight }]}
                onPress={() => handleMarkSent(item)}
              >
                <Ionicons name="send-outline" size={14} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.primary }]}>{t('invoices.markSent')}</Text>
              </TouchableOpacity>
            )}
            {(displayStatus === 'sent' || displayStatus === 'overdue') && (
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.successLight }]}
                onPress={() => handleMarkPaid(item)}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text style={[styles.quickActionText, { color: colors.success }]}>{t('invoices.markPaid')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [colors, t, getDisplayStatus, statusConfig, formatDate, formatCurrency, openViewModal, handleMarkSent, handleMarkPaid]);

  // ─── Line items form (shared between add & edit) ──────
  const renderLineItemsForm = () => (
    <>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('invoices.lineItems')}</Text>
      {formErrors.lineItems && (
        <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.lineItems}</Text>
      )}
      {lineItems.map((item, index) => (
        <View key={item.id} style={[styles.lineItem, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.lineItemRow}>
            <Input
              label={index === 0 ? t('invoices.itemDescription') : ''}
              value={item.description}
              onChangeText={(text) => updateLineItem(item.id, 'description', text)}
              placeholder={t('invoices.itemDescriptionPlaceholder')}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            {lineItems.length > 1 && (
              <TouchableOpacity
                style={styles.removeLineItem}
                onPress={() => removeLineItem(item.id)}
              >
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.lineItemNumbers}>
            <Input
              label={t('invoices.quantity')}
              value={item.quantity.toString()}
              onChangeText={(text) => updateLineItem(item.id, 'quantity', parseInt(text) || 0)}
              placeholder="1"
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Input
              label={t('invoices.unitPrice')}
              value={item.unit_price.toString()}
              onChangeText={(text) => updateLineItem(item.id, 'unit_price', parseFloat(text) || 0)}
              placeholder="0.00"
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <View style={styles.lineItemTotal}>
              <Text style={[styles.lineItemTotalLabel, { color: colors.textTertiary }]}>{t('invoices.amount')}</Text>
              <Text style={[styles.lineItemTotalValue, { color: colors.text }]}>
                {formatCurrency(item.quantity * item.unit_price)}
              </Text>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addLineItemButton} onPress={addLineItem}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.addLineItemText, { color: colors.primary }]}>{t('invoices.addItem')}</Text>
      </TouchableOpacity>

      {/* Totals */}
      <View style={[styles.totalsContainer, { backgroundColor: colors.primary + '10' }]}>
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>{t('invoices.subtotal')}</Text>
          <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(calculateSubtotal())}</Text>
        </View>
        {(parseFloat(formTaxRate) || 0) > 0 && (
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>
              {t('invoices.tax')} ({formTaxRate}%)
            </Text>
            <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(calculateTaxAmount())}</Text>
          </View>
        )}
        <View style={[styles.totalsRow, styles.totalsFinal]}>
          <Text style={[styles.totalsFinalLabel, { color: colors.text }]}>{t('invoices.invoiceTotal')}</Text>
          <Text style={[styles.totalsFinalValue, { color: colors.primary }]}>{formatCurrency(calculateTotal())}</Text>
        </View>
      </View>
    </>
  );

  // ─── Invoice form (shared between add & edit) ─────────
  const renderInvoiceForm = () => (
    <>
      <Input
        label={t('invoices.invoiceNumber')}
        value={formInvoiceNumber}
        onChangeText={setFormInvoiceNumber}
        placeholder="INV-XXXX"
        error={formErrors.invoiceNumber}
      />

      <Select
        label={t('invoices.client')}
        options={clientOptions}
        value={formClientId}
        onChange={setFormClientId}
        placeholder={t('invoices.selectClient')}
        error={formErrors.client}
        searchable
      />

      <Select
        label={t('invoices.optionalProject')}
        options={projectOptions}
        value={formProjectId}
        onChange={setFormProjectId}
        placeholder={t('invoices.selectProject')}
        searchable
      />

      <Select
        label={t('invoices.status')}
        options={formStatusOptions}
        value={formStatus}
        onChange={setFormStatus}
        placeholder={t('invoices.status')}
      />

      <DatePicker
        label={t('invoices.issueDate')}
        value={formIssueDate}
        onChange={setFormIssueDate}
        placeholder={t('invoices.issueDate')}
        error={formErrors.issueDate}
      />

      <DatePicker
        label={t('invoices.dueDate')}
        value={formDueDate}
        onChange={setFormDueDate}
        placeholder={t('invoices.dueDate')}
      />

      <Input
        label={t('invoices.paymentTerms')}
        value={formPaymentTerms}
        onChangeText={setFormPaymentTerms}
        placeholder={t('invoices.paymentTermsPlaceholder')}
      />

      <Input
        label={t('invoices.taxRate')}
        value={formTaxRate}
        onChangeText={setFormTaxRate}
        placeholder="0"
        keyboardType="decimal-pad"
      />

      {renderLineItemsForm()}

      <Input
        label={t('invoices.notes')}
        value={formNotes}
        onChangeText={setFormNotes}
        placeholder={t('invoices.notesPlaceholder')}
        multiline
        numberOfLines={3}
      />
    </>
  );

  // ─── Main render ───────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('invoices.title')}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={4} />
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
        <Text style={[styles.title, { color: colors.text }]}>{t('invoices.title')}</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('invoices.totalInvoiced')}</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(stats.total, false)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('invoices.totalPaid')}</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(stats.paid, false)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('invoices.outstanding')}</Text>
          <Text style={[styles.summaryValue, { color: stats.outstanding > 0 ? colors.warning : colors.textSecondary }]}>
            {formatCurrency(stats.outstanding, false)}
          </Text>
        </View>
      </View>

      {/* Search + Sort + Status Tabs + Invoice List */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[filterContainerStyle, { backgroundColor: colors.background }]} onLayout={onFilterLayout}>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('invoices.searchPlaceholder')}
              />
            </View>
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowSortModal(true)}
            >
              <Ionicons name="funnel-outline" size={18} color={colors.textSecondary} />
              {activeSortCount > 0 && (
                <View style={[styles.sortBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.sortBadgeText}>{activeSortCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={[styles.tabBar, { borderBottomColor: colors.borderLight }]}>
            {statusFilterOptions.map((option) => {
              const isActive = filterStatus === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.tab, isActive && { borderBottomColor: colors.primary }]}
                  onPress={() => setFilterStatus(option.key)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: colors.textTertiary },
                      isActive && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <Animated.FlatList
          data={filteredInvoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: filterHeight }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          ListEmptyComponent={
            isOffline && !(invoices ?? []).length && !searchQuery ? (
              <EmptyState
                icon="document-text-outline"
                title={t('invoices.noInvoices')}
                offline
              />
            ) : searchQuery || filterStatus !== 'all' ? (
              <EmptyState
                icon="search-outline"
                title={t('invoices.noResults')}
                description={t('invoices.tryDifferentSearch')}
              />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title={t('invoices.noInvoices')}
                description={t('invoices.noInvoicesDesc')}
                actionLabel={t('invoices.addInvoice')}
                onAction={openAddModal}
              />
            )
          }
        />
      </View>

      {/* ─── View Invoice Modal ────────────────────────── */}
      <Modal
        visible={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={t('invoices.viewInvoice')}
        size="full"
      >
        {selectedInvoice && (
          <ScrollView style={styles.modalContent}>
            {/* Status & Invoice Number */}
            <View style={styles.viewHeader}>
              <Text style={[styles.viewInvoiceNumber, { color: colors.text }]}>
                {selectedInvoice.invoice_number}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: statusConfig[getDisplayStatus(selectedInvoice)]?.bgColor }]}>
                <Ionicons
                  name={statusConfig[getDisplayStatus(selectedInvoice)]?.icon || 'document-outline'}
                  size={14}
                  color={statusConfig[getDisplayStatus(selectedInvoice)]?.color}
                />
                <Text style={[styles.statusChipText, { color: statusConfig[getDisplayStatus(selectedInvoice)]?.color }]}>
                  {statusConfig[getDisplayStatus(selectedInvoice)]?.label}
                </Text>
              </View>
            </View>

            {/* Bill To */}
            <TouchableOpacity
              style={[styles.viewSection, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => {
                if (selectedInvoice.client_id) {
                  setShowViewModal(false);
                  router.push({ pathname: '/(app)/client-detail', params: { id: selectedInvoice.client_id } } as any);
                }
              }}
              activeOpacity={selectedInvoice.client_id ? 0.7 : 1}
            >
              <Text style={[styles.viewSectionLabel, { color: colors.textTertiary }]}>{t('invoices.billTo')}</Text>
              <View style={styles.viewClickableRow}>
                <Text style={[styles.viewSectionValue, { color: selectedInvoice.client_id ? colors.primary : colors.text }]}>
                  {(selectedInvoice.client as any)?.name || t('invoices.noClient')}
                </Text>
                {selectedInvoice.client_id && (
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                )}
              </View>
              {(selectedInvoice.client as any)?.company && (
                <Text style={[styles.viewSectionSub, { color: colors.textSecondary }]}>
                  {(selectedInvoice.client as any).company}
                </Text>
              )}
              {(selectedInvoice.client as any)?.email && (
                <Text style={[styles.viewSectionSub, { color: colors.textSecondary }]}>
                  {(selectedInvoice.client as any).email}
                </Text>
              )}
            </TouchableOpacity>

            {/* Invoice Details */}
            <View style={[styles.viewSection, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.viewSectionLabel, { color: colors.textTertiary }]}>{t('invoices.invoiceDetails')}</Text>
              <View style={styles.viewDetailRow}>
                <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('invoices.issueDate')}</Text>
                <Text style={[styles.viewDetailValue, { color: colors.text }]}>{formatDateLong(selectedInvoice.issue_date)}</Text>
              </View>
              {selectedInvoice.due_date && (
                <View style={styles.viewDetailRow}>
                  <Text style={[styles.viewDetailLabel, { color: getDisplayStatus(selectedInvoice) === 'overdue' ? colors.error : colors.textSecondary }]}>
                    {t('invoices.dueDate')}
                  </Text>
                  <Text style={[styles.viewDetailValue, { color: getDisplayStatus(selectedInvoice) === 'overdue' ? colors.error : colors.text }]}>
                    {formatDateLong(selectedInvoice.due_date)}
                  </Text>
                </View>
              )}
              {selectedInvoice.payment_terms && (
                <View style={styles.viewDetailRow}>
                  <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('invoices.paymentTerms')}</Text>
                  <Text style={[styles.viewDetailValue, { color: colors.text }]}>{selectedInvoice.payment_terms}</Text>
                </View>
              )}
              {selectedInvoice.project && (
                <TouchableOpacity
                  style={styles.viewDetailRow}
                  onPress={() => {
                    if (selectedInvoice.project_id) {
                      setShowViewModal(false);
                      router.push({ pathname: '/(app)/project-detail', params: { id: selectedInvoice.project_id } } as any);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('invoices.project')}</Text>
                  <View style={styles.viewClickableRow}>
                    <Text style={[styles.viewDetailValue, { color: colors.primary }]}>{(selectedInvoice.project as any)?.name}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Line Items */}
            {viewLineItems.length > 0 && (
              <View style={[styles.viewSection, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.viewSectionLabel, { color: colors.textTertiary }]}>{t('invoices.lineItems')}</Text>
                {viewLineItems.map((item, index) => (
                  <View key={item.id} style={[styles.viewLineItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
                    <View style={styles.viewLineItemLeft}>
                      <Text style={[styles.viewLineItemDesc, { color: colors.text }]}>{item.description}</Text>
                      <Text style={[styles.viewLineItemQty, { color: colors.textSecondary }]}>
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </Text>
                    </View>
                    <Text style={[styles.viewLineItemAmount, { color: colors.text }]}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Totals */}
            <View style={[styles.viewTotals, { backgroundColor: colors.primary + '10' }]}>
              <View style={styles.viewTotalRow}>
                <Text style={[styles.viewTotalLabel, { color: colors.textSecondary }]}>{t('invoices.subtotal')}</Text>
                <Text style={[styles.viewTotalValue, { color: colors.text }]}>{formatCurrency(selectedInvoice.subtotal)}</Text>
              </View>
              {selectedInvoice.tax_rate > 0 && (
                <View style={styles.viewTotalRow}>
                  <Text style={[styles.viewTotalLabel, { color: colors.textSecondary }]}>
                    {t('invoices.tax')} ({selectedInvoice.tax_rate}%)
                  </Text>
                  <Text style={[styles.viewTotalValue, { color: colors.text }]}>{formatCurrency(selectedInvoice.tax_amount)}</Text>
                </View>
              )}
              <View style={[styles.viewTotalRow, { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
                <Text style={[styles.viewTotalFinalLabel, { color: colors.text }]}>{t('invoices.invoiceTotal')}</Text>
                <Text style={[styles.viewTotalFinalValue, { color: colors.primary }]}>{formatCurrency(selectedInvoice.total)}</Text>
              </View>
            </View>

            {/* Notes */}
            {selectedInvoice.notes && (
              <View style={[styles.viewSection, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.viewSectionLabel, { color: colors.textTertiary }]}>{t('invoices.notes')}</Text>
                <Text style={[styles.viewNotesText, { color: colors.text }]}>{selectedInvoice.notes}</Text>
              </View>
            )}

            {/* View Actions */}
            <View style={styles.viewActionsColumn}>
              {/* Quick action pills */}
              <View style={styles.viewActionPillRow}>
                {getDisplayStatus(selectedInvoice) === 'draft' && (
                  <TouchableOpacity
                    style={[styles.viewActionPill, { backgroundColor: colors.infoLight }]}
                    onPress={() => handleSendInvoice(selectedInvoice)}
                  >
                    <Ionicons name="send-outline" size={16} color={colors.primary} />
                    <Text style={[styles.viewActionPillText, { color: colors.primary }]}>{t('invoices.sendInvoice')}</Text>
                  </TouchableOpacity>
                )}
                {getDisplayStatus(selectedInvoice) === 'draft' && (
                  <TouchableOpacity
                    style={[styles.viewActionPill, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => handleMarkSent(selectedInvoice)}
                  >
                    <Ionicons name="checkmark-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.viewActionPillText, { color: colors.textSecondary }]}>{t('invoices.markSent')}</Text>
                  </TouchableOpacity>
                )}
                {(getDisplayStatus(selectedInvoice) === 'sent' || getDisplayStatus(selectedInvoice) === 'overdue') && (
                  <TouchableOpacity
                    style={[styles.viewActionPill, { backgroundColor: colors.successLight }]}
                    onPress={() => handleMarkPaid(selectedInvoice)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                    <Text style={[styles.viewActionPillText, { color: colors.success }]}>{t('invoices.markPaid')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.viewActionPill, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => handleDownloadPdf(selectedInvoice)}
                >
                  <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.viewActionPillText, { color: colors.textSecondary }]}>{t('invoices.downloadPdf')}</Text>
                </TouchableOpacity>
              </View>

              {/* Edit + Delete row */}
              <View style={styles.viewActionsRow}>
                <Button
                  title={t('common.delete')}
                  onPress={() => confirmDelete(selectedInvoice)}
                  variant="danger"
                  style={{ flex: 1 }}
                />
                <Button
                  title={t('common.edit')}
                  onPress={openEditFromView}
                  variant="primary"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* ─── Add Invoice Modal ─────────────────────────── */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('invoices.addInvoice')}
        size="full"
      >
        <ScrollView style={styles.modalContent}>
          {renderInvoiceForm()}
          <View style={styles.modalActions}>
            <Button
              title={t('common.cancel')}
              onPress={() => setShowAddModal(false)}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <Button
              title={t('invoices.createInvoice')}
              onPress={handleAddInvoice}
              variant="primary"
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* ─── Edit Invoice Modal ────────────────────────── */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('invoices.editInvoice')}
        size="full"
      >
        <ScrollView style={styles.modalContent}>
          {renderInvoiceForm()}
          <View style={styles.modalActions}>
            <Button
              title={t('common.delete')}
              onPress={() => selectedInvoice && confirmDelete(selectedInvoice)}
              variant="danger"
              style={{ flex: 1 }}
            />
            <Button
              title={t('common.save')}
              onPress={handleUpdateInvoice}
              variant="primary"
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* ─── Sort Modal ────────────────────────────────── */}
      <Modal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        title={t('invoices.filterSort')}
        size="full"
      >
        <View style={styles.sortModalContent}>
          <Text style={[styles.sortModalLabel, { color: colors.textSecondary }]}>{t('invoices.sortBy')}</Text>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                { borderColor: colors.border },
                sortBy === option.key && { backgroundColor: colors.primary + '15', borderColor: colors.primary },
              ]}
              onPress={() => {
                setSortBy(option.key);
                setShowSortModal(false);
              }}
            >
              <Text style={[
                styles.sortOptionText,
                { color: colors.text },
                sortBy === option.key && { color: colors.primary, fontWeight: '600' },
              ]}>
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ─── Delete Confirm ────────────────────────────── */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('invoices.deleteTitle')}
        message={t('invoices.deleteMessage', { number: invoiceToDelete?.invoice_number || '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDeleteInvoice}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setInvoiceToDelete(null);
        }}
        variant="danger"
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
    marginBottom: Spacing.md,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['4xl'],
  },
  invoiceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  invoiceNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: 2,
  },
  clientName: {
    fontSize: FontSizes.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  projectName: {
    fontSize: FontSizes.sm,
    flex: 1,
  },
  invoiceFooter: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  dateInfo: {
    marginRight: Spacing.xl,
  },
  dateLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  totalInfo: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
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
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  lineItem: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  removeLineItem: {
    marginBottom: Spacing.sm,
  },
  lineItemNumbers: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  lineItemTotal: {
    flex: 1,
    alignItems: 'flex-end',
    paddingBottom: Spacing.sm,
  },
  lineItemTotalLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  lineItemTotalValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  addLineItemText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  totalsContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  totalsLabel: {
    fontSize: FontSizes.sm,
  },
  totalsValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  totalsFinal: {
    marginTop: Spacing.sm,
    marginBottom: 0,
  },
  totalsFinalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  totalsFinalValue: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
  },
  // View modal styles
  viewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  viewInvoiceNumber: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
  },
  viewSection: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  viewSectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  viewSectionValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  viewClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  viewSectionSub: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  viewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  viewDetailLabel: {
    fontSize: FontSizes.sm,
  },
  viewDetailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  viewLineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  viewLineItemLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  viewLineItemDesc: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  viewLineItemQty: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  viewLineItemAmount: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  viewTotals: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  viewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  viewTotalLabel: {
    fontSize: FontSizes.sm,
  },
  viewTotalValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  viewTotalFinalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  viewTotalFinalValue: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
  },
  viewNotesText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  viewActionsColumn: {
    marginTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  viewActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  viewActionPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  viewActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  viewActionPillText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  // Sort modal
  sortModalContent: {
    paddingTop: Spacing.sm,
  },
  sortModalLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  sortOptionText: {
    fontSize: FontSizes.md,
  },
});
