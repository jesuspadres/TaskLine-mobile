import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import {
  Modal, Input, Button, Badge, Avatar, EmptyState, StatusBadge,
  ListSkeleton, showToast,
} from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import type { Client } from '@/lib/database.types';

interface Property {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  gate_code: string | null;
  lockbox_code: string | null;
  alarm_code: string | null;
  pets: string | null;
  hazards: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientProject {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
}

interface ClientInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number | null;
  due_date: string | null;
}

interface ClientRequest {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface ClientBooking {
  id: string;
  title: string;
  status: string;
  start_time: string;
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();

  // ─── Offline Data ──────────────────────────────────────────

  interface ClientDetailData {
    client: Client | null;
    properties: Property[];
    projects: ClientProject[];
    invoices: ClientInvoice[];
    requests: ClientRequest[];
    bookings: ClientBooking[];
    invoicesTotal: number;
  }

  const { data: clientData, loading, refreshing, refresh } = useOfflineData<ClientDetailData>(
    `client_detail:${id}`,
    async () => {
      const [clientRes, propsRes, projRes, invRes, reqRes, bookRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id!).single(),
        supabase.from('properties').select('*').eq('client_id', id!)
          .order('is_primary', { ascending: false }).order('name', { ascending: true }),
        supabase.from('projects').select('id, name, status, deadline')
          .eq('client_id', id!).order('created_at', { ascending: false }).limit(5),
        supabase.from('invoices').select('id, invoice_number, status, total, due_date')
          .eq('client_id', id!).order('created_at', { ascending: false }).limit(5),
        supabase.from('client_requests').select('id, name, status, created_at')
          .eq('client_id', id!).order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('id, title, status, start_time')
          .eq('client_id', id!).order('start_time', { ascending: false }).limit(5),
      ]);

      if (clientRes.error) throw clientRes.error;

      const invData = (invRes.data as ClientInvoice[]) ?? [];

      return {
        client: clientRes.data as Client,
        properties: (propsRes.data as Property[]) ?? [],
        projects: (projRes.data as ClientProject[]) ?? [],
        invoices: invData,
        requests: (reqRes.data as ClientRequest[]) ?? [],
        bookings: (bookRes.data as ClientBooking[]) ?? [],
        invoicesTotal: invData.reduce((sum, inv) => sum + (inv.total || 0), 0),
      };
    },
    { enabled: !!id },
  );

  const { mutate } = useOfflineMutation();

  const {
    client,
    properties,
    projects,
    invoices,
    requests,
    bookings,
    invoicesTotal,
  } = clientData ?? {
    client: null,
    properties: [],
    projects: [],
    invoices: [],
    requests: [],
    bookings: [],
    invoicesTotal: 0,
  };

  // Edit client modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', company: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Property modals
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showEditPropertyModal, setShowEditPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    name: '', address_line1: '', city: '', state: '', zip_code: '',
    gate_code: '', lockbox_code: '', alarm_code: '',
    pets: '', hazards: '', notes: '', is_primary: false,
  });
  const [propertyFormErrors, setPropertyFormErrors] = useState<Record<string, string>>({});

  const dateLocale = locale === 'es' ? 'es-ES' : 'en-US';

  // ─── Client Edit ─────────────────────────────────────────────

  const openEditModal = () => {
    if (!client) return;
    setClientForm({
      name: client.name, email: client.email,
      phone: client.phone || '', company: client.company || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateClientForm = () => {
    const errors: Record<string, string> = {};
    if (!clientForm.name.trim()) errors.name = t('clients.nameRequired');
    if (!clientForm.email.trim()) errors.email = t('clients.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientForm.email)) errors.email = t('clients.invalidEmail');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveClient = async () => {
    if (!validateClientForm() || !client || !user) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: clientForm.name.trim(),
        email: clientForm.email.trim().toLowerCase(),
        phone: clientForm.phone.trim() || null,
        company: clientForm.company.trim() || null,
      };
      const { error } = await mutate({
        table: 'clients',
        operation: 'update',
        data: payload,
        matchColumn: 'id',
        matchValue: client.id,
        cacheKeys: [`client_detail:${id}`],
      });
      if (error) throw error;
      setShowEditModal(false);
      refresh();
      showToast('success', t('clientDetail.clientUpdated'));
    } catch (error: any) {
      secureLog.error('Client update error:', error);
      showToast('error', error.message || t('clientDetail.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = () => {
    if (!client) return;
    Alert.alert(
      t('clients.deleteTitle'),
      t('clientDetail.deleteConfirm', { name: client.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'clients',
                operation: 'delete',
                matchColumn: 'id',
                matchValue: client.id,
                cacheKeys: [`client_detail:${id}`],
              });
              if (error) throw error;
              showToast('success', t('clientDetail.clientDeleted'));
              router.back();
            } catch (error: any) {
              showToast('error', error.message || t('clientDetail.loadError'));
            }
          },
        },
      ]
    );
  };

  const handleToggleOnboarded = async () => {
    if (!client || !user) return;
    try {
      const { error } = await mutate({
        table: 'clients',
        operation: 'update',
        data: { onboarded: !client.onboarded },
        matchColumn: 'id',
        matchValue: client.id,
        cacheKeys: [`client_detail:${id}`],
      });
      if (error) throw error;
      refresh();
    } catch (error: any) {
      secureLog.error('Toggle onboarded error:', error);
      showToast('error', error.message || t('clientDetail.loadError'));
    }
  };

  // ─── Quick Contact ───────────────────────────────────────────

  const handleCall = () => { if (client?.phone) Linking.openURL(`tel:${client.phone}`); };
  const handleText = () => { if (client?.phone) Linking.openURL(`sms:${client.phone}`); };
  const handleEmail = () => { if (client?.email) Linking.openURL(`mailto:${client.email}`); };

  // ─── Property CRUD ───────────────────────────────────────────

  const resetPropertyForm = () => {
    setPropertyForm({
      name: '', address_line1: '', city: '', state: '', zip_code: '',
      gate_code: '', lockbox_code: '', alarm_code: '',
      pets: '', hazards: '', notes: '', is_primary: false,
    });
    setPropertyFormErrors({});
  };

  const validatePropertyForm = () => {
    const errors: Record<string, string> = {};
    if (!propertyForm.name.trim()) errors.name = t('clientDetail.propertyNameRequired');
    setPropertyFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddPropertyModal = () => { resetPropertyForm(); setShowAddPropertyModal(true); };

  const openEditPropertyModal = (property: Property) => {
    setSelectedProperty(property);
    setPropertyForm({
      name: property.name, address_line1: property.address_line1 || '',
      city: property.city || '', state: property.state || '',
      zip_code: property.zip_code || '', gate_code: property.gate_code || '',
      lockbox_code: property.lockbox_code || '', alarm_code: property.alarm_code || '',
      pets: property.pets || '', hazards: property.hazards || '',
      notes: property.notes || '', is_primary: property.is_primary,
    });
    setPropertyFormErrors({});
    setShowEditPropertyModal(true);
  };

  const propertyPayload = () => ({
    name: propertyForm.name.trim(),
    address_line1: propertyForm.address_line1.trim() || null,
    city: propertyForm.city.trim() || null,
    state: propertyForm.state.trim() || null,
    zip_code: propertyForm.zip_code.trim() || null,
    gate_code: propertyForm.gate_code.trim() || null,
    lockbox_code: propertyForm.lockbox_code.trim() || null,
    alarm_code: propertyForm.alarm_code.trim() || null,
    pets: propertyForm.pets.trim() || null,
    hazards: propertyForm.hazards.trim() || null,
    notes: propertyForm.notes.trim() || null,
    is_primary: propertyForm.is_primary,
  });

  const handleAddProperty = async () => {
    if (!validatePropertyForm() || !user || !id) return;
    setPropertySaving(true);
    try {
      const { error } = await mutate({
        table: 'properties',
        operation: 'insert',
        data: { ...propertyPayload(), client_id: id, user_id: user.id },
        cacheKeys: [`client_detail:${id}`],
      });
      if (error) throw error;
      setShowAddPropertyModal(false);
      resetPropertyForm();
      refresh();
      showToast('success', t('clientDetail.propertyAdded'));
    } catch (error: any) {
      showToast('error', error.message || t('clientDetail.loadError'));
    } finally {
      setPropertySaving(false);
    }
  };

  const handleEditProperty = async () => {
    if (!validatePropertyForm() || !selectedProperty) return;
    setPropertySaving(true);
    try {
      const { error } = await mutate({
        table: 'properties',
        operation: 'update',
        data: propertyPayload(),
        matchColumn: 'id',
        matchValue: selectedProperty.id,
        cacheKeys: [`client_detail:${id}`],
      });
      if (error) throw error;
      setShowEditPropertyModal(false);
      setSelectedProperty(null);
      resetPropertyForm();
      refresh();
      showToast('success', t('clientDetail.propertyUpdated'));
    } catch (error: any) {
      showToast('error', error.message || t('clientDetail.loadError'));
    } finally {
      setPropertySaving(false);
    }
  };

  const handleDeleteProperty = () => {
    if (!selectedProperty) return;
    Alert.alert(
      t('clientDetail.deleteProperty'),
      t('clientDetail.deletePropertyConfirm', { name: selectedProperty.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await mutate({
                table: 'properties',
                operation: 'delete',
                matchColumn: 'id',
                matchValue: selectedProperty.id,
                cacheKeys: [`client_detail:${id}`],
              });
              if (error) throw error;
              setShowEditPropertyModal(false);
              setSelectedProperty(null);
              refresh();
              showToast('success', t('clientDetail.propertyDeleted'));
            } catch (error: any) {
              showToast('error', error.message || t('clientDetail.loadError'));
            }
          },
        },
      ]
    );
  };

  // ─── Helpers ─────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(dateLocale, { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(dateLocale, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const maskCode = (code: string | null) => {
    if (!code) return null;
    if (code.length <= 2) return code;
    return code.slice(0, 1) + '*'.repeat(code.length - 2) + code.slice(-1);
  };

  const formatAddress = (property: Property) =>
    [property.address_line1, property.city, property.state, property.zip_code]
      .filter(Boolean).join(', ');

  // ─── Loading / Not Found ─────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('clientDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('clientDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon="person-outline"
          title={t('clientDetail.notFound')}
          description={t('clientDetail.notFoundDesc')}
        />
      </SafeAreaView>
    );
  }

  // ─── Property Form Content ───────────────────────────────────

  const renderPropertyFormContent = () => (
    <View>
      <Input
        label={`${t('properties.name')} *`}
        placeholder={t('properties.name')}
        value={propertyForm.name}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, name: text })}
        error={propertyFormErrors.name}
        leftIcon="home-outline"
      />
      <Input
        label={t('clientDetail.streetAddress')}
        placeholder={t('clientDetail.streetAddress')}
        value={propertyForm.address_line1}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, address_line1: text })}
        leftIcon="location-outline"
      />
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Input
            label={t('properties.city')}
            placeholder={t('properties.city')}
            value={propertyForm.city}
            onChangeText={(text) => setPropertyForm({ ...propertyForm, city: text })}
          />
        </View>
        <View style={styles.flex1}>
          <Input
            label={t('properties.state')}
            placeholder={t('properties.state')}
            value={propertyForm.state}
            onChangeText={(text) => setPropertyForm({ ...propertyForm, state: text })}
          />
        </View>
      </View>
      <Input
        label={t('properties.zip')}
        placeholder={t('properties.zip')}
        value={propertyForm.zip_code}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, zip_code: text })}
        keyboardType="numeric"
      />

      <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
        {t('clientDetail.accessCodes')}
      </Text>
      <Input
        label={t('properties.gateCode')}
        placeholder={t('properties.gateCode')}
        value={propertyForm.gate_code}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, gate_code: text })}
        leftIcon="key-outline"
      />
      <Input
        label={t('clientDetail.lockboxCode')}
        placeholder={t('clientDetail.lockboxCode')}
        value={propertyForm.lockbox_code}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, lockbox_code: text })}
        leftIcon="lock-closed-outline"
      />
      <Input
        label={t('clientDetail.alarmCode')}
        placeholder={t('clientDetail.alarmCode')}
        value={propertyForm.alarm_code}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, alarm_code: text })}
        leftIcon="shield-outline"
      />

      <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
        {t('clientDetail.additionalInfo')}
      </Text>
      <Input
        label={t('properties.hasPets')}
        placeholder={t('properties.petDetails')}
        value={propertyForm.pets}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, pets: text })}
        leftIcon="paw-outline"
      />
      <Input
        label={t('clientDetail.hazards')}
        placeholder={t('clientDetail.hazards')}
        value={propertyForm.hazards}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, hazards: text })}
        leftIcon="warning-outline"
      />
      <Input
        label={t('properties.notes')}
        placeholder={t('properties.notes')}
        value={propertyForm.notes}
        onChangeText={(text) => setPropertyForm({ ...propertyForm, notes: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
      />
      <View style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('clientDetail.primaryProperty')}</Text>
        <Switch
          value={propertyForm.is_primary}
          onValueChange={(value) => setPropertyForm({ ...propertyForm, is_primary: value })}
          trackColor={{ false: colors.border, true: colors.primary + '60' }}
          thumbColor={propertyForm.is_primary ? colors.primary : colors.surfaceSecondary}
        />
      </View>
    </View>
  );

  // ─── Main Render ─────────────────────────────────────────────

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('clientDetail.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openEditModal}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDeleteClient}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Client Info Card */}
        <View style={[styles.clientCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.clientCardHeader}>
            <Avatar name={client.name} size="lg" />
            <View style={styles.clientCardInfo}>
              <Text style={[styles.clientName, { color: colors.text }]}>{client.name}</Text>
              {client.company && (
                <Text style={[styles.clientCompany, { color: colors.textSecondary }]}>{client.company}</Text>
              )}
              <Badge
                text={client.onboarded ? t('clients.active') : t('clients.pending')}
                variant={client.onboarded ? 'active' : 'pending'}
              />
            </View>
          </View>

          <Text style={[styles.customerSince, { color: colors.textTertiary }]}>
            {t('clientDetail.customerSince', { date: formatDate(client.created_at) })}
          </Text>
        </View>

        {/* Quick Contact Actions */}
        <View style={styles.quickActions}>
          {client.phone && (
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: colors.successLight }]}
              onPress={handleCall}
            >
              <Ionicons name="call" size={20} color={colors.success} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>
                {t('clientDetail.call')}
              </Text>
            </TouchableOpacity>
          )}
          {client.phone && (
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: colors.infoLight }]}
              onPress={handleText}
            >
              <Ionicons name="chatbubble" size={20} color={colors.info} />
              <Text style={[styles.quickActionText, { color: colors.info }]}>
                {t('clientDetail.text')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.warningLight }]}
            onPress={handleEmail}
          >
            <Ionicons name="mail" size={20} color={colors.warning} />
            <Text style={[styles.quickActionText, { color: colors.warning }]}>
              {t('clientDetail.emailAction')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contact Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
            <View style={styles.infoItemContent}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{t('clients.email')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{client.email}</Text>
            </View>
          </View>
          {client.phone && (
            <View style={[styles.infoItem, { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
              <Ionicons name="call-outline" size={18} color={colors.textTertiary} />
              <View style={styles.infoItemContent}>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{t('clients.phone')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{client.phone}</Text>
              </View>
            </View>
          )}
          {client.company && (
            <View style={[styles.infoItem, { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
              <Ionicons name="business-outline" size={18} color={colors.textTertiary} />
              <View style={styles.infoItemContent}>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{t('clients.company')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{client.company}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: '/(app)/projects', params: { clientId: client.id } } as any)}
          >
            <Ionicons name="folder-outline" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{projects.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('clientDetail.projects')}</Text>
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="receipt-outline" size={20} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(invoicesTotal)}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('clientDetail.invoiced')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="home-outline" size={20} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text }]}>{properties.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('clientDetail.properties')}</Text>
          </View>
        </View>

        {/* Projects Section */}
        {projects.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clientDetail.projects')}</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/projects', params: { clientId: client.id } } as any)}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('clientDetail.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            {projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/(app)/project-detail', params: { id: proj.id } } as any)}
              >
                <Ionicons name="folder-outline" size={18} color={colors.primary} />
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{proj.name}</Text>
                  {proj.deadline && (
                    <Text style={[styles.listItemSubtitle, { color: colors.textTertiary }]}>
                      {t('dashboard.due')}: {formatDate(proj.deadline)}
                    </Text>
                  )}
                </View>
                <StatusBadge status={proj.status} />
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Invoices Section */}
        {invoices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clientDetail.invoices')}</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/invoices' as any)}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('clientDetail.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            {invoices.map((inv) => (
              <View
                key={inv.id}
                style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="receipt-outline" size={18} color={colors.success} />
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]}>#{inv.invoice_number}</Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textTertiary }]}>
                    {formatCurrency(inv.total || 0)}
                    {inv.due_date ? ` · ${t('dashboard.due')}: ${formatDate(inv.due_date)}` : ''}
                  </Text>
                </View>
                <StatusBadge status={inv.status} />
              </View>
            ))}
          </View>
        )}

        {/* Requests Section */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clientDetail.requests')}</Text>
            </View>
            {requests.map((req) => (
              <TouchableOpacity
                key={req.id}
                style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/(app)/request-detail', params: { id: req.id } } as any)}
              >
                <Ionicons name="mail-outline" size={18} color={colors.statusNew} />
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{req.name}</Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textTertiary }]}>{formatDate(req.created_at)}</Text>
                </View>
                <StatusBadge status={req.status} />
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bookings Section */}
        {bookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clientDetail.bookings')}</Text>
            </View>
            {bookings.map((booking) => (
              <View
                key={booking.id}
                style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.info} />
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>
                    {booking.title || t('dashboard.booking')}
                  </Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textTertiary }]}>
                    {formatDate(booking.start_time)}
                  </Text>
                </View>
                <StatusBadge status={booking.status} />
              </View>
            ))}
          </View>
        )}

        {/* Properties Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clientDetail.properties')}</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={openAddPropertyModal}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{t('clientDetail.addProperty')}</Text>
            </TouchableOpacity>
          </View>

          {properties.length === 0 ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="home-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>
                {t('clientDetail.noProperties')}
              </Text>
            </View>
          ) : (
            properties.map((property) => (
              <TouchableOpacity
                key={property.id}
                style={[styles.propertyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/(app)/property-detail', params: { id: property.id } } as any)}
              >
                <View style={styles.propertyHeader}>
                  <View style={styles.propertyHeaderLeft}>
                    <Ionicons name="home-outline" size={18} color={colors.primary} />
                    <Text style={[styles.propertyName, { color: colors.text }]}>{property.name}</Text>
                  </View>
                  {property.is_primary && (
                    <View style={[styles.primaryBadge, { backgroundColor: colors.infoLight }]}>
                      <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>
                        {t('clientDetail.primary')}
                      </Text>
                    </View>
                  )}
                </View>

                {formatAddress(property) ? (
                  <View style={styles.propertyRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.propertyText, { color: colors.textSecondary }]}>
                      {formatAddress(property)}
                    </Text>
                  </View>
                ) : null}

                {(property.gate_code || property.lockbox_code || property.alarm_code) && (
                  <View style={styles.codesRow}>
                    {property.gate_code && (
                      <View style={[styles.codeChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="key-outline" size={12} color={colors.textSecondary} />
                        <Text style={[styles.codeText, { color: colors.textSecondary }]}>
                          Gate: {maskCode(property.gate_code)}
                        </Text>
                      </View>
                    )}
                    {property.lockbox_code && (
                      <View style={[styles.codeChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="lock-closed-outline" size={12} color={colors.textSecondary} />
                        <Text style={[styles.codeText, { color: colors.textSecondary }]}>
                          Lock: {maskCode(property.lockbox_code)}
                        </Text>
                      </View>
                    )}
                    {property.alarm_code && (
                      <View style={[styles.codeChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="shield-outline" size={12} color={colors.textSecondary} />
                        <Text style={[styles.codeText, { color: colors.textSecondary }]}>
                          Alarm: {maskCode(property.alarm_code)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {property.pets && (
                  <View style={styles.propertyRow}>
                    <Ionicons name="paw-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.propertyText, { color: colors.textSecondary }]}>{property.pets}</Text>
                  </View>
                )}

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                  style={styles.propertyChevron}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Client Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('clients.editClient')}
        size="full"
      >
        <View>
          <Input
            label={`${t('clients.name')} *`}
            placeholder={t('clients.namePlaceholder')}
            value={clientForm.name}
            onChangeText={(text) => setClientForm({ ...clientForm, name: text })}
            error={formErrors.name}
            leftIcon="person-outline"
            autoCapitalize="words"
          />
          <Input
            label={`${t('clients.email')} *`}
            placeholder={t('clients.emailPlaceholder')}
            value={clientForm.email}
            onChangeText={(text) => setClientForm({ ...clientForm, email: text })}
            error={formErrors.email}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label={t('clients.phone')}
            placeholder={t('clients.phonePlaceholder')}
            value={clientForm.phone}
            onChangeText={(text) => setClientForm({ ...clientForm, phone: text })}
            leftIcon="call-outline"
            keyboardType="phone-pad"
          />
          <Input
            label={t('clients.company')}
            placeholder={t('clients.companyPlaceholder')}
            value={clientForm.company}
            onChangeText={(text) => setClientForm({ ...clientForm, company: text })}
            leftIcon="business-outline"
            autoCapitalize="words"
          />
        </View>

        {/* Onboarded Toggle */}
        <View style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('clients.clientStatus')}</Text>
          <TouchableOpacity
            style={[
              styles.statusButton,
              { backgroundColor: colors.surfaceSecondary },
              client.onboarded && { backgroundColor: colors.successLight },
            ]}
            onPress={handleToggleOnboarded}
          >
            <Text
              style={[
                styles.statusButtonText,
                { color: colors.textSecondary },
                client.onboarded && { color: colors.success },
              ]}
            >
              {client.onboarded ? t('clients.active') : t('clients.pending')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowEditModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleSaveClient}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Add Property Modal */}
      <Modal
        visible={showAddPropertyModal}
        onClose={() => setShowAddPropertyModal(false)}
        title={t('clientDetail.addPropertyTitle')}
        size="full"
      >
        {renderPropertyFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.cancel')}
            onPress={() => setShowAddPropertyModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('clientDetail.addProperty')}
            onPress={handleAddProperty}
            loading={propertySaving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Edit Property Modal */}
      <Modal
        visible={showEditPropertyModal}
        onClose={() => setShowEditPropertyModal(false)}
        title={t('clientDetail.editProperty')}
        size="full"
      >
        {renderPropertyFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('common.delete')}
            onPress={handleDeleteProperty}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title={t('common.cancel')}
            onPress={() => setShowEditPropertyModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleEditProperty}
            loading={propertySaving}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  clientCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  clientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  clientCardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    gap: Spacing.xs,
  },
  clientName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  clientCompany: {
    fontSize: FontSizes.sm,
  },
  customerSince: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  notesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  notesSectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  quickActionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  infoItemContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.lg,
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
  viewAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  addBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  listItemSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
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
  propertyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    position: 'relative',
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  propertyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  propertyName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  primaryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  primaryBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  propertyText: {
    fontSize: FontSizes.sm,
    flex: 1,
  },
  codesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  codeText: {
    fontSize: FontSizes.xs,
    fontFamily: 'monospace',
  },
  propertyChevron: {
    position: 'absolute',
    right: Spacing.lg,
    top: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  flex1: {
    flex: 1,
  },
  formSectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  toggleLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
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
});
