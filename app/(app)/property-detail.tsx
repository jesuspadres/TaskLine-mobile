import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import {
  Modal, Input, Button, Badge, Select, EmptyState, ListSkeleton, StatusBadge, DatePicker, ConfirmDialog, showToast,
} from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useOfflineData } from '@/hooks/useOfflineData';
import type { Property, Client } from '@/lib/database.types';

interface PropertyClient {
  id: string;
  name: string;
  email?: string;
}

interface Equipment {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  condition?: string;
  install_date?: string;
  warranty_expiration?: string;
  last_service_date?: string;
  service_interval_months?: number;
  notes?: string;
  created_at: string;
}

interface ServiceHistoryItem {
  id: string;
  project_name: string;
  project_status: string;
  project_description?: string;
  scheduled_date?: string;
  completed_date?: string;
  total_amount?: number;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();

  interface PropertyDetailData {
    property: Property | null;
    clientInfo: PropertyClient | null;
    equipment: Equipment[];
    serviceHistory: ServiceHistoryItem[];
    clients: Client[];
  }

  const { data: detailData, loading, refreshing, isOffline, refresh } = useOfflineData<PropertyDetailData>(
    `property_detail:${id}`,
    async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, clients(id, name, email)')
        .eq('id', id!)
        .single();
      if (error) throw error;

      const { clients: clientData, ...propData } = data as any;

      // Load equipment
      const { data: equipmentData } = await (supabase.from('property_equipment') as any)
        .select('*')
        .eq('property_id', id!)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      // Load service history via RPC
      const { data: historyData } = await (supabase.rpc as any)('get_property_service_history', { p_property_id: id });

      const { data: clientsList } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      return {
        property: propData as Property,
        clientInfo: clientData as PropertyClient | null,
        equipment: (equipmentData as Equipment[]) ?? [],
        serviceHistory: (historyData as ServiceHistoryItem[]) ?? [],
        clients: (clientsList as Client[]) ?? [],
      };
    },
    { enabled: !!id },
  );

  const {
    property = null,
    clientInfo = null,
    equipment = [],
    serviceHistory = [],
    clients = [],
  } = detailData ?? {};

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', client_id: '', property_type: '',
    address_line1: '', address_line2: '', city: '', state: '',
    zip_code: '', gate_code: '', lockbox_code: '', alarm_code: '',
    pets: '', hazards: '', square_footage: '', year_built: '',
    notes: '', is_primary: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Equipment modal state
  const [showViewEquipmentModal, setShowViewEquipmentModal] = useState(false);
  const [viewingEquipment, setViewingEquipment] = useState<Equipment | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [showDeleteEquipmentConfirm, setShowDeleteEquipmentConfirm] = useState(false);
  const [equipForm, setEquipForm] = useState({
    name: '', category: '', brand: '', model: '', serial_number: '',
    location: '', condition: '',
    install_date: null as Date | null,
    warranty_expiration: null as Date | null,
    last_service_date: null as Date | null,
    service_interval_months: '',
    notes: '',
  });
  const [equipFormErrors, setEquipFormErrors] = useState<Record<string, string>>({});

  const dateLocale = locale === 'es' ? 'es-ES' : 'en-US';

  const propertyTypeOptions = useMemo(() => [
    { key: 'residential', label: t('properties.residential') },
    { key: 'commercial', label: t('properties.commercial') },
    { key: 'other', label: t('properties.other') },
  ], [t]);

  const clientOptions = useMemo(() =>
    clients.map((c) => ({ key: c.id, label: (c as any).email ? `${c.name} (${(c as any).email})` : c.name })),
  [clients]);

  const categoryOptions = useMemo(() => [
    { key: 'hvac', label: t('propertyDetail.categoryHvac') },
    { key: 'plumbing', label: t('propertyDetail.categoryPlumbing') },
    { key: 'electrical', label: t('propertyDetail.categoryElectrical') },
    { key: 'appliance', label: t('propertyDetail.categoryAppliance') },
    { key: 'other', label: t('propertyDetail.categoryOther') },
  ], [t]);

  const conditionOptions = useMemo(() => [
    { key: 'excellent', label: t('propertyDetail.conditionExcellent') },
    { key: 'good', label: t('propertyDetail.conditionGood') },
    { key: 'fair', label: t('propertyDetail.conditionFair') },
    { key: 'poor', label: t('propertyDetail.conditionPoor') },
  ], [t]);

  const intervalOptions = useMemo(() => [
    { key: '1', label: t('propertyDetail.monthly') },
    { key: '3', label: t('propertyDetail.quarterly') },
    { key: '6', label: t('propertyDetail.semiAnnually') },
    { key: '12', label: t('propertyDetail.annually') },
    { key: '24', label: t('propertyDetail.biannually') },
  ], [t]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // ─── Edit ──────────────────────────────────────────────────

  const openEditModal = () => {
    if (!property) return;
    haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    const p = property as any;
    setForm({
      name: property.name,
      client_id: property.client_id || '',
      property_type: p.property_type || '',
      address_line1: p.address_street || property.address_line1 || '',
      address_line2: p.address_unit || p.address_line2 || '',
      city: p.address_city || property.city || '',
      state: p.address_state || property.state || '',
      zip_code: p.address_zip || property.zip_code || '',
      gate_code: property.gate_code || '',
      lockbox_code: property.lockbox_code || '',
      alarm_code: property.alarm_code || '',
      pets: p.pet_details || property.pets || '',
      hazards: property.hazards || '',
      square_footage: p.square_footage ? String(p.square_footage) : '',
      year_built: p.year_built ? String(p.year_built) : '',
      notes: p.property_notes || property.notes || '',
      is_primary: property.is_primary,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('propertyDetail.nameRequired');
    if (form.square_footage && isNaN(Number(form.square_footage))) errors.square_footage = t('propertyDetail.invalidNumber');
    if (form.year_built && isNaN(Number(form.year_built))) errors.year_built = t('propertyDetail.invalidYear');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !property || !user) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        client_id: form.client_id || property.client_id,
        property_type: form.property_type || null,
        // Write to website column names (address_street, address_city, etc.)
        address_street: form.address_line1.trim() || null,
        address_unit: form.address_line2.trim() || null,
        address_city: form.city.trim() || null,
        address_state: form.state.trim() || null,
        address_zip: form.zip_code.trim() || null,
        gate_code: form.gate_code.trim() || null,
        lockbox_code: form.lockbox_code.trim() || null,
        alarm_code: form.alarm_code.trim() || null,
        has_pets: !!form.pets.trim(),
        pet_details: form.pets.trim() || null,
        hazards: form.hazards.trim() || null,
        square_footage: form.square_footage ? Number(form.square_footage) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        property_notes: form.notes.trim() || null,
        is_primary: form.is_primary,
      };
      const { error } = await supabase.from('properties')
        .update(payload as any)
        .eq('id', property.id)
        .eq('user_id', user.id);
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      refresh();
      showToast('success', t('propertyDetail.propertyUpdated'));
    } catch (error: any) {
      secureLog.error('Property update error:', error);
      showToast('error', error.message || t('propertyDetail.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!property || !user) return;
    Alert.alert(
      t('propertyDetail.deleteProperty'),
      t('propertyDetail.deleteConfirm', { name: property.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('properties')
                .delete().eq('id', property.id).eq('user_id', user.id);
              if (error) throw error;
              haptics.notification(Haptics.NotificationFeedbackType.Success);
              showToast('success', t('propertyDetail.propertyDeleted'));
              router.back();
            } catch (error: any) {
              secureLog.error('Property delete error:', error);
              showToast('error', error.message || t('propertyDetail.loadError'));
            }
          },
        },
      ]
    );
  };

  // ─── Equipment CRUD ───────────────────────────────────────

  const resetEquipForm = () => {
    setEquipForm({
      name: '', category: '', brand: '', model: '', serial_number: '',
      location: '', condition: '',
      install_date: null, warranty_expiration: null, last_service_date: null,
      service_interval_months: '', notes: '',
    });
    setEquipFormErrors({});
  };

  const openAddEquipment = () => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setEditingEquipment(null);
    resetEquipForm();
    setShowEquipmentModal(true);
  };

  const openViewEquipment = (item: Equipment) => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setViewingEquipment(item);
    setShowViewEquipmentModal(true);
  };

  const openEditFromView = () => {
    if (!viewingEquipment) return;
    const item = viewingEquipment;
    setShowViewEquipmentModal(false);
    setEditingEquipment(item);
    setEquipForm({
      name: item.name,
      category: item.category || '',
      brand: item.brand || '',
      model: item.model || '',
      serial_number: item.serial_number || '',
      location: item.location || '',
      condition: item.condition || '',
      install_date: item.install_date ? new Date(item.install_date) : null,
      warranty_expiration: item.warranty_expiration ? new Date(item.warranty_expiration) : null,
      last_service_date: item.last_service_date ? new Date(item.last_service_date) : null,
      service_interval_months: item.service_interval_months ? String(item.service_interval_months) : '',
      notes: item.notes || '',
    });
    setEquipFormErrors({});
    setShowEquipmentModal(true);
  };

  const validateEquipForm = () => {
    const errors: Record<string, string> = {};
    if (!equipForm.name.trim()) errors.name = t('propertyDetail.equipmentNameRequired');
    setEquipFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const formatDateForDB = (date: Date | null) => {
    if (!date) return null;
    return date.toISOString().split('T')[0];
  };

  const handleSaveEquipment = async () => {
    if (!validateEquipForm() || !user) return;
    setEquipmentSaving(true);
    try {
      const payload: Record<string, any> = {
        name: equipForm.name.trim(),
        category: equipForm.category || null,
        brand: equipForm.brand.trim() || null,
        model: equipForm.model.trim() || null,
        serial_number: equipForm.serial_number.trim() || null,
        location: equipForm.location.trim() || null,
        condition: equipForm.condition || null,
        install_date: formatDateForDB(equipForm.install_date),
        warranty_expiration: formatDateForDB(equipForm.warranty_expiration),
        last_service_date: formatDateForDB(equipForm.last_service_date),
        service_interval_months: equipForm.service_interval_months ? Number(equipForm.service_interval_months) : null,
        notes: equipForm.notes.trim() || null,
      };

      if (editingEquipment) {
        const { error } = await (supabase.from('property_equipment') as any)
          .update(payload)
          .eq('id', editingEquipment.id)
          .eq('user_id', user.id);
        if (error) throw error;
        showToast('success', t('propertyDetail.equipmentSaved'));
      } else {
        payload.property_id = id;
        payload.user_id = user.id;
        const { error } = await (supabase.from('property_equipment') as any)
          .insert(payload);
        if (error) throw error;
        showToast('success', t('propertyDetail.equipmentCreated'));
      }

      haptics.notification(Haptics.NotificationFeedbackType.Success);
      setShowEquipmentModal(false);
      refresh();
    } catch (error: any) {
      secureLog.error('Equipment save error:', error);
      showToast('error', error.message || t('propertyDetail.loadError'));
    } finally {
      setEquipmentSaving(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!editingEquipment || !user) return;
    try {
      const { error } = await (supabase.from('property_equipment') as any)
        .delete()
        .eq('id', editingEquipment.id)
        .eq('user_id', user.id);
      if (error) throw error;
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      setShowDeleteEquipmentConfirm(false);
      setShowEquipmentModal(false);
      setShowViewEquipmentModal(false);
      setViewingEquipment(null);
      refresh();
      showToast('success', t('propertyDetail.equipmentDeleted'));
    } catch (error: any) {
      secureLog.error('Equipment delete error:', error);
      showToast('error', error.message || t('propertyDetail.loadError'));
    }
  };

  // ─── Helpers ───────────────────────────────────────────────

  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'hvac': return 'snow-outline';
      case 'plumbing': return 'water-outline';
      case 'electrical': return 'flash-outline';
      case 'appliance': return 'tv-outline';
      default: return 'build-outline';
    }
  };

  const getCategoryLabel = (category?: string): string => {
    switch (category) {
      case 'hvac': return t('propertyDetail.categoryHvac');
      case 'plumbing': return t('propertyDetail.categoryPlumbing');
      case 'electrical': return t('propertyDetail.categoryElectrical');
      case 'appliance': return t('propertyDetail.categoryAppliance');
      case 'other': return t('propertyDetail.categoryOther');
      default: return '';
    }
  };

  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'excellent': return { bg: colors.successLight, text: colors.success };
      case 'good': return { bg: colors.infoLight, text: colors.info };
      case 'fair': return { bg: colors.warningLight, text: colors.warning };
      case 'poor': return { bg: colors.errorLight, text: colors.error };
      default: return { bg: colors.surfaceSecondary, text: colors.textSecondary };
    }
  };

  const getConditionLabel = (condition?: string): string => {
    switch (condition) {
      case 'excellent': return t('propertyDetail.conditionExcellent');
      case 'good': return t('propertyDetail.conditionGood');
      case 'fair': return t('propertyDetail.conditionFair');
      case 'poor': return t('propertyDetail.conditionPoor');
      default: return '';
    }
  };

  const getIntervalLabel = (months?: number): string => {
    switch (months) {
      case 1: return t('propertyDetail.monthly');
      case 3: return t('propertyDetail.quarterly');
      case 6: return t('propertyDetail.semiAnnually');
      case 12: return t('propertyDetail.annually');
      case 24: return t('propertyDetail.biannually');
      default: return '';
    }
  };

  const formatAddress = () => {
    if (!property) return null;
    const p = property as any;
    const unit = p.address_unit || p.address_line2 || null;
    // Try address_formatted first (set by website via Google Places)
    if (p.address_formatted) {
      // Append unit/apt if stored separately and not already in the formatted string
      if (unit && !(p.address_formatted as string).includes(unit)) {
        return `${p.address_formatted}, ${unit}`;
      }
      return p.address_formatted as string;
    }
    // Fall back to component fields — prefer website columns, then old mobile columns
    const street = p.address_street || property.address_line1;
    const city = p.address_city || property.city;
    const state = p.address_state || property.state;
    const zip = p.address_zip || property.zip_code;
    const parts = [
      street,
      unit,
      [city, state].filter(Boolean).join(', '),
      zip,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(dateLocale, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const openMaps = () => {
    const addr = formatAddress();
    if (!addr) return;
    haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    const encoded = encodeURIComponent(addr);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  const getPropertyTypeIcon = (type?: string | null): string => {
    switch (type) {
      case 'commercial': return 'business';
      case 'residential': return 'home';
      default: return 'location';
    }
  };

  const getPropertyTypeLabel = (type?: string | null): string => {
    switch (type) {
      case 'residential': return t('properties.residential');
      case 'commercial': return t('properties.commercial');
      case 'industrial':
      case 'other': return t('properties.other');
      default: return '';
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(dateLocale, { style: 'currency', currency: 'USD' }).format(amount);

  // ─── Loading / Not Found ───────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('propertyDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('propertyDetail.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon="home-outline"
          title={t('propertyDetail.notFound')}
          description={t('propertyDetail.notFoundDesc')}
          offline={isOffline}
        />
      </SafeAreaView>
    );
  }

  const p = property as any;
  const address = formatAddress();
  const sqft = p.square_footage;
  const yearBuilt = p.year_built;
  const propType = p.property_type as string | null | undefined;
  const typeLabel = getPropertyTypeLabel(propType);
  const typeIcon = getPropertyTypeIcon(propType);
  const lat = p.address_lat ?? property.latitude;
  const lng = p.address_lng ?? property.longitude;
  const petInfo = p.pet_details || property.pets;
  const notesText = p.property_notes || property.notes;

  // ─── Main Render ───────────────────────────────────────────

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('propertyDetail.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openEditModal}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDelete}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Property Name Card */}
        <View style={[styles.nameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.infoLight }]}>
            <Ionicons name={typeIcon as any} size={28} color={colors.info} />
          </View>
          <Text style={[styles.propertyName, { color: colors.text }]}>{property.name}</Text>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            {property.is_primary && (
              <View style={[styles.primaryBadge, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="star" size={12} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {t('properties.primary')}
                </Text>
              </View>
            )}
            {!!typeLabel && (
              <View style={[styles.typeBadge, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name={typeIcon as any} size={12} color={colors.textSecondary} />
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {typeLabel}
                </Text>
              </View>
            )}
            {!!petInfo && (
              <View style={[styles.petBadge, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="paw" size={12} color={colors.warning} />
                <Text style={[styles.badgeText, { color: colors.warning }]}>
                  {t('propertyDetail.pets')}
                </Text>
              </View>
            )}
          </View>

          {clientInfo && (
            <TouchableOpacity
              style={styles.clientLink}
              onPress={() => {
                haptics.impact(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(app)/client-detail', params: { id: clientInfo.id } } as any);
              }}
            >
              <Ionicons name="person-outline" size={14} color={colors.primary} />
              <Text style={[styles.clientLinkText, { color: colors.primary }]}>{clientInfo.name}</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.createdDate, { color: colors.textTertiary }]}>
            {t('propertyDetail.added', { date: formatDate(property.created_at) })}
          </Text>
        </View>

        {/* Address Section */}
        {address && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('propertyDetail.address')}
            </Text>
            <View style={styles.addressContent}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
                <Text style={[styles.infoText, { color: colors.text }]}>{address}</Text>
              </View>
              <TouchableOpacity
                style={[styles.navigateButton, { backgroundColor: colors.primary }]}
                onPress={openMaps}
              >
                <Ionicons name="navigate" size={16} color="#fff" />
                <Text style={styles.navigateText}>{t('propertyDetail.navigate')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Map Preview */}
        {lat != null && lng != null && Platform.OS !== 'web' && (
          <TouchableOpacity
            style={[styles.mapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openMaps}
            activeOpacity={0.9}
          >
            <MapView
              style={styles.mapView}
              initialRegion={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              pointerEvents="none"
            >
              <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                title={property.name}
              />
            </MapView>
            <View style={[styles.mapOverlay, { backgroundColor: colors.surface }]}>
              <Ionicons name="expand-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.mapOverlayText, { color: colors.textSecondary }]}>
                {t('propertyDetail.navigate')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Property Details */}
        {(sqft || yearBuilt) && (
          <View style={styles.detailsRow}>
            {sqft != null && (
              <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="resize-outline" size={20} color={colors.info} />
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {Number(sqft).toLocaleString(dateLocale)}
                </Text>
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                  {t('propertyDetail.sqft')}
                </Text>
              </View>
            )}
            {yearBuilt != null && (
              <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={20} color={colors.warning} />
                <Text style={[styles.detailValue, { color: colors.text }]}>{yearBuilt}</Text>
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                  {t('propertyDetail.yearBuilt')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Access Codes */}
        {(property.gate_code || property.lockbox_code || property.alarm_code) && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('propertyDetail.accessCodes')}
            </Text>
            {property.gate_code && (
              <View style={styles.codeRow}>
                <View style={[styles.codeIcon, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="key-outline" size={16} color={colors.warning} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('propertyDetail.gateCode')}
                  </Text>
                  <Text style={[styles.codeValue, { color: colors.text }]}>{property.gate_code}</Text>
                </View>
              </View>
            )}
            {property.lockbox_code && (
              <View style={styles.codeRow}>
                <View style={[styles.codeIcon, { backgroundColor: colors.infoLight }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.info} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('propertyDetail.lockboxCode')}
                  </Text>
                  <Text style={[styles.codeValue, { color: colors.text }]}>{property.lockbox_code}</Text>
                </View>
              </View>
            )}
            {property.alarm_code && (
              <View style={styles.codeRow}>
                <View style={[styles.codeIcon, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="shield-outline" size={16} color={colors.error} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('propertyDetail.alarmCode')}
                  </Text>
                  <Text style={[styles.codeValue, { color: colors.text }]}>{property.alarm_code}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Safety Info — Pets & Hazards */}
        {(petInfo || property.hazards) && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('propertyDetail.safetyInfo')}
            </Text>
            {petInfo && (
              <View style={[styles.safetyItem, { borderBottomColor: property.hazards ? colors.borderLight : 'transparent' }]}>
                <View style={[styles.codeIcon, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="paw" size={16} color={colors.warning} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('propertyDetail.pets')}
                  </Text>
                  <Text style={[styles.infoText, { color: colors.text }]}>{petInfo}</Text>
                </View>
              </View>
            )}
            {property.hazards && (
              <View style={styles.safetyItem}>
                <View style={[styles.codeIcon, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('propertyDetail.hazards')}
                  </Text>
                  <Text style={[styles.infoText, { color: colors.text }]}>{property.hazards}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Notes */}
        {notesText && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('propertyDetail.notes')}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{notesText}</Text>
            </View>
          </View>
        )}

        {/* Equipment */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="build-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginBottom: 0 }]}>
                {t('propertyDetail.equipment')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addEquipBtn, { backgroundColor: colors.primary }]}
              onPress={openAddEquipment}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addEquipBtnText}>{t('propertyDetail.addEquipment')}</Text>
            </TouchableOpacity>
          </View>
          {equipment.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {t('propertyDetail.noEquipment')}
            </Text>
          ) : (
            equipment.map((item, idx) => {
              const condColor = getConditionColor(item.condition);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.equipmentRow,
                    idx < equipment.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  ]}
                  onPress={() => openViewEquipment(item)}
                >
                  <View style={[styles.equipmentIcon, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name={getCategoryIcon(item.category) as any} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.equipmentInfo}>
                    <Text style={[styles.equipmentName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.equipmentSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[item.brand, item.model, item.location].filter(Boolean).join(' · ') || getCategoryLabel(item.category)}
                    </Text>
                  </View>
                  <View style={styles.equipmentRight}>
                    {item.condition && (
                      <View style={[styles.conditionBadge, { backgroundColor: condColor.bg }]}>
                        <Text style={[styles.conditionBadgeText, { color: condColor.text }]}>
                          {getConditionLabel(item.condition)}
                        </Text>
                      </View>
                    )}
                    {item.last_service_date && (
                      <Text style={[styles.equipmentDate, { color: colors.textTertiary }]}>
                        {formatDate(item.last_service_date)}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Service History */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="clipboard-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginBottom: 0 }]}>
              {t('propertyDetail.serviceHistory')}
            </Text>
          </View>
          {serviceHistory.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary, marginTop: Spacing.md }]}>
              {t('propertyDetail.noServiceHistory')}
            </Text>
          ) : (
            serviceHistory.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.projectRow,
                  idx < serviceHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
                onPress={() => {
                  haptics.impact(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(app)/project-detail?id=${item.id}` as any);
                }}
              >
                <View style={styles.projectInfo}>
                  <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
                    {item.project_name}
                  </Text>
                  {item.project_description && (
                    <Text style={[styles.equipmentSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.project_description}
                    </Text>
                  )}
                  <View style={styles.projectMeta}>
                    <StatusBadge status={item.project_status as any} />
                    {(item.completed_date || item.scheduled_date) && (
                      <Text style={[styles.projectBudget, { color: colors.textSecondary }]}>
                        {formatDate(item.completed_date || item.scheduled_date!)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.serviceHistoryRight}>
                  {item.total_amount != null && item.total_amount > 0 && (
                    <Text style={[styles.serviceAmount, { color: colors.text }]}>
                      {formatCurrency(item.total_amount)}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Property Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('propertyDetail.editProperty')}
        size="full"
      >
        <View>
          <Input
            label={`${t('properties.propertyName')} *`}
            placeholder={t('properties.propertyNamePlaceholder')}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            error={formErrors.name}
            leftIcon="home-outline"
            autoCapitalize="words"
          />

          <Select
            label={t('properties.client')}
            placeholder={t('properties.selectClient')}
            options={clientOptions}
            value={form.client_id || null}
            onChange={(value) => setForm({ ...form, client_id: value })}
            searchable
          />

          <Select
            label={t('propertyDetail.propertyType')}
            placeholder={t('properties.selectType')}
            options={propertyTypeOptions}
            value={form.property_type || null}
            onChange={(value) => setForm({ ...form, property_type: value })}
          />

          <View style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}>
            <View style={styles.toggleLabelRow}>
              <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('propertyDetail.primaryProperty')}</Text>
            </View>
            <Switch
              value={form.is_primary}
              onValueChange={(v) => setForm({ ...form, is_primary: v })}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={form.is_primary ? colors.primary : colors.surfaceSecondary}
            />
          </View>

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('propertyDetail.address')}
          </Text>
          <Input
            label={t('propertyDetail.streetAddress')}
            placeholder={t('propertyDetail.streetAddress')}
            value={form.address_line1}
            onChangeText={(v) => setForm({ ...form, address_line1: v })}
            leftIcon="location-outline"
            autoCapitalize="words"
          />
          <Input
            label={t('propertyDetail.addressLine2')}
            placeholder={t('propertyDetail.addressLine2Placeholder')}
            value={form.address_line2}
            onChangeText={(v) => setForm({ ...form, address_line2: v })}
            leftIcon="navigate-outline"
            autoCapitalize="words"
          />
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input
                label={t('properties.city')}
                placeholder={t('properties.city')}
                value={form.city}
                onChangeText={(v) => setForm({ ...form, city: v })}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.flex06}>
              <Input
                label={t('properties.state')}
                placeholder="ST"
                value={form.state}
                onChangeText={(v) => setForm({ ...form, state: v })}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.flex06}>
              <Input
                label={t('properties.zip')}
                placeholder={t('properties.zip')}
                value={form.zip_code}
                onChangeText={(v) => setForm({ ...form, zip_code: v })}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('propertyDetail.accessCodes')}
          </Text>
          <Input
            label={t('propertyDetail.gateCode')}
            placeholder={t('propertyDetail.gateCode')}
            value={form.gate_code}
            onChangeText={(v) => setForm({ ...form, gate_code: v })}
            leftIcon="key-outline"
          />
          <Input
            label={t('propertyDetail.lockboxCode')}
            placeholder={t('propertyDetail.lockboxCode')}
            value={form.lockbox_code}
            onChangeText={(v) => setForm({ ...form, lockbox_code: v })}
            leftIcon="lock-closed-outline"
          />
          <Input
            label={t('propertyDetail.alarmCode')}
            placeholder={t('propertyDetail.alarmCode')}
            value={form.alarm_code}
            onChangeText={(v) => setForm({ ...form, alarm_code: v })}
            leftIcon="shield-outline"
          />

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('propertyDetail.details')}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input
                label={t('properties.squareFootage')}
                placeholder={t('properties.squareFootagePlaceholder')}
                value={form.square_footage}
                onChangeText={(v) => setForm({ ...form, square_footage: v })}
                error={formErrors.square_footage}
                keyboardType="number-pad"
                leftIcon="resize-outline"
              />
            </View>
            <View style={styles.flex1}>
              <Input
                label={t('properties.yearBuilt')}
                placeholder={t('properties.yearBuiltPlaceholder')}
                value={form.year_built}
                onChangeText={(v) => setForm({ ...form, year_built: v })}
                error={formErrors.year_built}
                keyboardType="number-pad"
                leftIcon="calendar-outline"
              />
            </View>
          </View>

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('propertyDetail.safetyInfo')}
          </Text>
          <Input
            label={t('propertyDetail.pets')}
            placeholder={t('properties.petsPlaceholder')}
            value={form.pets}
            onChangeText={(v) => setForm({ ...form, pets: v })}
            leftIcon="paw-outline"
            multiline
            numberOfLines={2}
          />
          <Input
            label={t('propertyDetail.hazards')}
            placeholder={t('properties.hazardsPlaceholder')}
            value={form.hazards}
            onChangeText={(v) => setForm({ ...form, hazards: v })}
            leftIcon="warning-outline"
            multiline
            numberOfLines={2}
          />

          <Input
            label={t('propertyDetail.notes')}
            placeholder={t('properties.notesPlaceholder')}
            value={form.notes}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            leftIcon="document-text-outline"
            multiline
            numberOfLines={3}
          />
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
            onPress={handleSave}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* View Equipment Modal */}
      <Modal
        visible={showViewEquipmentModal}
        onClose={() => setShowViewEquipmentModal(false)}
        title={t('propertyDetail.viewEquipment')}
        size="full"
      >
        {viewingEquipment && (() => {
          const eq = viewingEquipment;
          const condColor = getConditionColor(eq.condition);
          const isWarrantyExpired = eq.warranty_expiration && new Date(eq.warranty_expiration) < new Date();
          return (
            <View>
              {/* Header with icon and name */}
              <View style={styles.viewEquipHeader}>
                <View style={[styles.viewEquipIconLarge, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name={getCategoryIcon(eq.category) as any} size={32} color={colors.primary} />
                </View>
                <Text style={[styles.viewEquipName, { color: colors.text }]}>{eq.name}</Text>
                {eq.condition && (
                  <View style={[styles.conditionBadge, { backgroundColor: condColor.bg }]}>
                    <Text style={[styles.conditionBadgeText, { color: condColor.text }]}>
                      {getConditionLabel(eq.condition)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Equipment Details */}
              <Text style={[styles.formSectionLabel, { color: colors.text, borderTopWidth: 0, marginTop: 0 }]}>
                {t('propertyDetail.equipmentDetails')}
              </Text>
              <View style={[styles.viewDetailCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {eq.category && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.equipmentCategory')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{getCategoryLabel(eq.category)}</Text>
                  </View>
                )}
                {eq.brand && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.brand')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{eq.brand}</Text>
                  </View>
                )}
                {eq.model && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.model')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{eq.model}</Text>
                  </View>
                )}
                {eq.serial_number && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.serialNumber')}</Text>
                    <Text style={[styles.viewDetailValueMono, { color: colors.text }]}>{eq.serial_number}</Text>
                  </View>
                )}
                {eq.location && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.equipmentLocation')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{eq.location}</Text>
                  </View>
                )}
                {!eq.category && !eq.brand && !eq.model && !eq.serial_number && !eq.location && (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>—</Text>
                )}
              </View>

              {/* Service Information */}
              <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
                {t('propertyDetail.serviceInfo')}
              </Text>
              <View style={[styles.viewDetailCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {eq.install_date && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.installDate')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{formatDate(eq.install_date)}</Text>
                  </View>
                )}
                {eq.warranty_expiration && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.warrantyExpiration')}</Text>
                    <Text style={[styles.viewDetailValue, { color: isWarrantyExpired ? colors.error : colors.text }]}>
                      {formatDate(eq.warranty_expiration)}{isWarrantyExpired ? ` (${t('propertyDetail.warrantyExpired')})` : ''}
                    </Text>
                  </View>
                )}
                {eq.last_service_date && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.lastServiceDate')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{formatDate(eq.last_service_date)}</Text>
                  </View>
                )}
                {eq.service_interval_months && (
                  <View style={styles.viewDetailRow}>
                    <Text style={[styles.viewDetailLabel, { color: colors.textSecondary }]}>{t('propertyDetail.serviceInterval')}</Text>
                    <Text style={[styles.viewDetailValue, { color: colors.text }]}>{getIntervalLabel(eq.service_interval_months)}</Text>
                  </View>
                )}
                {!eq.install_date && !eq.warranty_expiration && !eq.last_service_date && !eq.service_interval_months && (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('propertyDetail.noServiceInfo')}</Text>
                )}
              </View>

              {/* Notes */}
              <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
                {t('propertyDetail.equipmentNotes')}
              </Text>
              <View style={[styles.viewDetailCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[eq.notes ? styles.viewDetailValue : styles.emptyText, { color: eq.notes ? colors.text : colors.textTertiary }]}>
                  {eq.notes || t('propertyDetail.noNotes')}
                </Text>
              </View>

              {/* Actions */}
              <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
                <Button
                  title={t('propertyDetail.deleteEquipment')}
                  onPress={() => {
                    setEditingEquipment(eq);
                    setShowDeleteEquipmentConfirm(true);
                  }}
                  variant="ghost"
                  style={{ minWidth: 100, marginRight: 'auto' } as any}
                  textStyle={{ color: colors.error }}
                />
                <Button
                  title={t('common.edit')}
                  onPress={openEditFromView}
                  style={styles.actionButton}
                />
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* Equipment Add/Edit Modal */}
      <Modal
        visible={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
        title={editingEquipment ? t('propertyDetail.editEquipment') : t('propertyDetail.newEquipment')}
        size="full"
      >
        <View>
          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopWidth: 0, marginTop: 0 }]}>
            {t('propertyDetail.equipmentDetails')}
          </Text>

          <Input
            label={`${t('propertyDetail.equipmentName')} *`}
            placeholder={t('propertyDetail.equipmentNamePlaceholder')}
            value={equipForm.name}
            onChangeText={(v) => setEquipForm({ ...equipForm, name: v })}
            error={equipFormErrors.name}
            leftIcon="build-outline"
            autoCapitalize="words"
          />

          <Select
            label={t('propertyDetail.equipmentCategory')}
            placeholder={t('propertyDetail.selectCategory')}
            options={categoryOptions}
            value={equipForm.category || null}
            onChange={(value) => setEquipForm({ ...equipForm, category: value })}
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input
                label={t('propertyDetail.brand')}
                placeholder={t('propertyDetail.brand')}
                value={equipForm.brand}
                onChangeText={(v) => setEquipForm({ ...equipForm, brand: v })}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.flex1}>
              <Input
                label={t('propertyDetail.model')}
                placeholder={t('propertyDetail.model')}
                value={equipForm.model}
                onChangeText={(v) => setEquipForm({ ...equipForm, model: v })}
              />
            </View>
          </View>

          <Input
            label={t('propertyDetail.serialNumber')}
            placeholder={t('propertyDetail.serialNumber')}
            value={equipForm.serial_number}
            onChangeText={(v) => setEquipForm({ ...equipForm, serial_number: v })}
            leftIcon="barcode-outline"
          />

          <Input
            label={t('propertyDetail.equipmentLocation')}
            placeholder={t('propertyDetail.equipmentLocationPlaceholder')}
            value={equipForm.location}
            onChangeText={(v) => setEquipForm({ ...equipForm, location: v })}
            leftIcon="location-outline"
            autoCapitalize="words"
          />

          <Select
            label={t('propertyDetail.condition')}
            placeholder={t('propertyDetail.selectCondition')}
            options={conditionOptions}
            value={equipForm.condition || null}
            onChange={(value) => setEquipForm({ ...equipForm, condition: value })}
          />

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('propertyDetail.serviceInfo')}
          </Text>

          <DatePicker
            label={t('propertyDetail.installDate')}
            value={equipForm.install_date}
            onChange={(date) => setEquipForm({ ...equipForm, install_date: date })}
            placeholder={t('propertyDetail.installDate')}
          />

          <DatePicker
            label={t('propertyDetail.warrantyExpiration')}
            value={equipForm.warranty_expiration}
            onChange={(date) => setEquipForm({ ...equipForm, warranty_expiration: date })}
            placeholder={t('propertyDetail.warrantyExpiration')}
          />

          <DatePicker
            label={t('propertyDetail.lastServiceDate')}
            value={equipForm.last_service_date}
            onChange={(date) => setEquipForm({ ...equipForm, last_service_date: date })}
            placeholder={t('propertyDetail.lastServiceDate')}
          />

          <Select
            label={t('propertyDetail.serviceInterval')}
            placeholder={t('propertyDetail.noInterval')}
            options={intervalOptions}
            value={equipForm.service_interval_months || null}
            onChange={(value) => setEquipForm({ ...equipForm, service_interval_months: value })}
          />

          <Input
            label={t('propertyDetail.equipmentNotes')}
            placeholder={t('propertyDetail.equipmentNotesPlaceholder')}
            value={equipForm.notes}
            onChangeText={(v) => setEquipForm({ ...equipForm, notes: v })}
            leftIcon="document-text-outline"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          {editingEquipment && (
            <Button
              title={t('propertyDetail.deleteEquipment')}
              onPress={() => setShowDeleteEquipmentConfirm(true)}
              variant="ghost"
              style={{ minWidth: 100, marginRight: 'auto' } as any}
              textStyle={{ color: colors.error }}
            />
          )}
          <Button
            title={t('common.cancel')}
            onPress={() => setShowEquipmentModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('common.save')}
            onPress={handleSaveEquipment}
            loading={equipmentSaving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Delete Equipment Confirm */}
      <ConfirmDialog
        visible={showDeleteEquipmentConfirm}
        title={t('propertyDetail.deleteEquipment')}
        message={t('propertyDetail.deleteEquipmentConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={handleDeleteEquipment}
        onCancel={() => setShowDeleteEquipmentConfirm(false)}
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

  // Name card
  nameCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  propertyName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  petBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  clientLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  clientLinkText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  createdDate: {
    fontSize: FontSizes.xs,
  },

  // Info card
  infoCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  addressContent: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    flex: 1,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
  },
  navigateText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Map
  mapCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapView: {
    height: 180,
    width: '100%',
  },
  mapOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  mapOverlayText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },

  emptyText: {
    fontSize: FontSizes.sm,
    fontStyle: 'italic',
  },

  // Details row
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  detailValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },

  // Code rows
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  codeIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeContent: {
    flex: 1,
  },
  codeLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    fontFamily: 'monospace',
  },

  // Safety
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
  },

  // Equipment section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addEquipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  addEquipBtnText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  equipmentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  equipmentSub: {
    fontSize: FontSizes.xs,
  },
  equipmentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  conditionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  conditionBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  equipmentDate: {
    fontSize: FontSizes.xs,
  },

  // View equipment modal
  viewEquipHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  viewEquipIconLarge: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  viewEquipName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  viewDetailCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  viewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  viewDetailLabel: {
    fontSize: FontSizes.sm,
    flex: 1,
  },
  viewDetailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  viewDetailValueMono: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    fontFamily: 'monospace',
    textAlign: 'right',
    flex: 1,
  },

  // Service history / projects
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: 4,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  projectBudget: {
    fontSize: FontSizes.xs,
  },
  serviceHistoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  serviceAmount: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Form styles
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  flex06: {
    flex: 0.6,
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
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
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
});
