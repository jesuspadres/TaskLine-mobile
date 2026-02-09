import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import {
  SearchBar,
  Badge,
  EmptyState,
  Modal,
  Input,
  Button,
  Select,
  ListSkeleton,
  StatCard,
  showToast,
} from '@/components';
import type {
  Property,
  Client,
} from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';

type PropertyWithClient = Property & {
  clients?: { name: string } | null;
  property_type?: string | null;
};

type SortKey = 'newest' | 'oldest' | 'nameAZ' | 'nameZA';

interface Filters {
  propertyType: 'all' | 'residential' | 'commercial' | 'other';
  pets: 'all' | 'has_pets' | 'no_pets';
  size: 'all' | 'small' | 'medium' | 'large';
  yearBuilt: 'all' | 'new' | 'older' | 'historic';
  accessCodes: 'all' | 'has_codes' | 'no_codes';
  status: 'all' | 'primary';
}

const defaultFilters: Filters = {
  propertyType: 'all',
  pets: 'all',
  size: 'all',
  yearBuilt: 'all',
  accessCodes: 'all',
  status: 'all',
};

const initialFormData = {
  name: '',
  client_id: '',
  property_type: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  gate_code: '',
  lockbox_code: '',
  alarm_code: '',
  pets: '',
  hazards: '',
  square_footage: '',
  year_built: '',
  is_primary: false,
  notes: '',
};

export default function PropertiesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const haptics = useHaptics();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<PropertyWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tempFilters, setTempFilters] = useState<Filters>(defaultFilters);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== 'all').length;
  }, [filters]);

  // Human-readable labels for active filter chips
  const activeFilterLabels = useMemo(() => {
    const labels: { key: keyof Filters; label: string }[] = [];
    if (filters.propertyType !== 'all') {
      const typeLabels: Record<string, string> = {
        residential: t('properties.residential'),
        commercial: t('properties.commercial'),
        other: t('properties.other'),
      };
      labels.push({ key: 'propertyType', label: typeLabels[filters.propertyType] || filters.propertyType });
    }
    if (filters.pets !== 'all') {
      labels.push({ key: 'pets', label: filters.pets === 'has_pets' ? t('properties.hasPetsOption') : t('properties.noPetsOption') });
    }
    if (filters.size !== 'all') {
      const sizeLabels: Record<string, string> = {
        small: t('properties.sqftSmall'),
        medium: t('properties.sqftMedium'),
        large: t('properties.sqftLarge'),
      };
      labels.push({ key: 'size', label: sizeLabels[filters.size] || filters.size });
    }
    if (filters.yearBuilt !== 'all') {
      const yearLabels: Record<string, string> = {
        'new': t('properties.yearNew'),
        older: t('properties.yearOlder'),
        historic: t('properties.yearHistoric'),
      };
      labels.push({ key: 'yearBuilt', label: yearLabels[filters.yearBuilt] || filters.yearBuilt });
    }
    if (filters.accessCodes !== 'all') {
      labels.push({ key: 'accessCodes', label: filters.accessCodes === 'has_codes' ? t('properties.hasCodes') : t('properties.noCodes') });
    }
    if (filters.status !== 'all') {
      labels.push({ key: 'status', label: t('properties.primaryOnly') });
    }
    return labels;
  }, [filters, t]);

  const sortOptions = useMemo(() => [
    { key: 'newest', label: t('properties.newest') },
    { key: 'oldest', label: t('properties.oldest') },
    { key: 'nameAZ', label: t('properties.nameAZ') },
    { key: 'nameZA', label: t('properties.nameZA') },
  ], [t]);

  const propertyTypeOptions = useMemo(() => [
    { key: '', label: t('properties.selectType') },
    { key: 'residential', label: t('properties.residential') },
    { key: 'commercial', label: t('properties.commercial') },
    { key: 'other', label: t('properties.other') },
  ], [t]);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching clients:', error);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties((data as PropertyWithClient[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching properties:', error);
      showToast('error', t('properties.propertyAddError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProperties();
    fetchClients();
  }, [fetchProperties, fetchClients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProperties();
    fetchClients();
  }, [fetchProperties, fetchClients]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('properties.nameRequired');
    }

    if (!formData.client_id) {
      errors.client_id = t('properties.clientRequired');
    }

    if (formData.square_footage && isNaN(Number(formData.square_footage))) {
      errors.square_footage = t('properties.invalidNumber');
    }

    if (formData.year_built && isNaN(Number(formData.year_built))) {
      errors.year_built = t('properties.invalidYear');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddProperty = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setSaving(true);
    try {
      const newProperty: Record<string, any> = {
        user_id: user.id,
        client_id: formData.client_id,
        name: formData.name.trim(),
        property_type: formData.property_type || null,
        // Use website column names for address
        address_street: formData.address_line1.trim() || null,
        address_unit: formData.address_line2.trim() || null,
        address_city: formData.city.trim() || null,
        address_state: formData.state.trim() || null,
        address_zip: formData.zip_code.trim() || null,
        gate_code: formData.gate_code.trim() || null,
        lockbox_code: formData.lockbox_code.trim() || null,
        alarm_code: formData.alarm_code.trim() || null,
        has_pets: !!formData.pets.trim(),
        pet_details: formData.pets.trim() || null,
        hazards: formData.hazards.trim() || null,
        square_footage: formData.square_footage ? Number(formData.square_footage) : null,
        year_built: formData.year_built ? Number(formData.year_built) : null,
        is_primary: formData.is_primary,
        property_notes: formData.notes.trim() || null,
      };

      const { error } = await supabase.from('properties').insert(newProperty as any);

      if (error) throw error;

      haptics.notification(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false);
      setFormData(initialFormData);
      setFormErrors({});
      fetchProperties();
      showToast('success', t('properties.propertyAdded'));
    } catch (error: any) {
      secureLog.error('Error adding property:', error);
      showToast('error', error.message || t('properties.propertyAddError'));
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setFormData(initialFormData);
    setFormErrors({});
    setShowAddModal(true);
  };

  const getAddressString = (property: Property): string => {
    const p = property as any;
    // Try address_formatted first (set by website via Google Places)
    if (p.address_formatted) return p.address_formatted as string;
    // Fall back — prefer website columns, then old mobile columns
    const street = p.address_street || property.address_line1;
    const unit = p.address_unit || p.address_line2;
    const city = p.address_city || property.city;
    const state = p.address_state || property.state;
    const zip = p.address_zip || property.zip_code;
    const parts = [
      street,
      unit,
      [city, state].filter(Boolean).join(', '),
      zip,
    ].filter(Boolean);
    return parts.join(', ') || t('properties.noAddress');
  };

  const clientOptions = useMemo(() =>
    clients.map((c) => ({
      key: c.id,
      label: c.name,
    })),
  [clients]);

  // Stats — count by property type (matching filter chips)
  const stats = useMemo(() => {
    const residential = properties.filter(p => (p as any).property_type === 'residential').length;
    const commercial = properties.filter(p => (p as any).property_type === 'commercial').length;
    const other = properties.filter(p => {
      const pt = (p as any).property_type;
      return pt === 'other' || pt === 'industrial' || !pt;
    }).length;
    return { total: properties.length, residential, commercial, other };
  }, [properties]);

  // Filtered + sorted
  const filteredProperties = useMemo(() => {
    let result = properties.filter((property) => {
      const p = property as any;
      const address = getAddressString(property).toLowerCase();
      const name = property.name.toLowerCase();
      const query = searchQuery.toLowerCase();
      const propType = (p.property_type as string | null) || '';

      // Search
      const matchesSearch =
        name.includes(query) ||
        address.includes(query) ||
        (property.clients?.name?.toLowerCase().includes(query) ?? false);
      if (!matchesSearch) return false;

      // Property type
      if (filters.propertyType !== 'all') {
        if (filters.propertyType === 'other') {
          if (propType !== 'other' && propType !== 'industrial' && !!propType) return false;
        } else if (propType !== filters.propertyType) {
          return false;
        }
      }

      // Pets
      if (filters.pets !== 'all') {
        const hasPets = p.has_pets || !!p.pet_details || !!property.pets;
        if (filters.pets === 'has_pets' && !hasPets) return false;
        if (filters.pets === 'no_pets' && hasPets) return false;
      }

      // Size
      if (filters.size !== 'all') {
        const sqft = Number(p.square_footage) || 0;
        if (filters.size === 'small' && sqft >= 1000) return false;
        if (filters.size === 'medium' && (sqft < 1000 || sqft > 2500)) return false;
        if (filters.size === 'large' && sqft <= 2500) return false;
        // If no sqft data, exclude from size filter
        if (!sqft) return false;
      }

      // Year built
      if (filters.yearBuilt !== 'all') {
        const yr = Number(p.year_built) || 0;
        if (!yr) return false;
        if (filters.yearBuilt === 'new' && yr < 2000) return false;
        if (filters.yearBuilt === 'older' && (yr < 1970 || yr >= 2000)) return false;
        if (filters.yearBuilt === 'historic' && yr >= 1970) return false;
      }

      // Access codes
      if (filters.accessCodes !== 'all') {
        const hasCodes = !!(p.gate_code || p.lockbox_code || p.alarm_code);
        if (filters.accessCodes === 'has_codes' && !hasCodes) return false;
        if (filters.accessCodes === 'no_codes' && hasCodes) return false;
      }

      // Status (primary)
      if (filters.status === 'primary' && !property.is_primary) return false;

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'nameAZ':
          return a.name.localeCompare(b.name);
        case 'nameZA':
          return b.name.localeCompare(a.name);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [properties, searchQuery, filters, sortBy]);

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

  const renderProperty = ({ item }: { item: PropertyWithClient }) => {
    const address = getAddressString(item);
    const clientName = item.clients?.name;
    const it = item as any;
    const propType = it.property_type as string | null | undefined;
    const typeIcon = getPropertyTypeIcon(propType);
    const hasPets = it.has_pets || !!it.pet_details || !!item.pets;

    return (
      <TouchableOpacity
        style={[styles.propertyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          haptics.impact(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/(app)/property-detail?id=${item.id}` as any);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.propertyCardHeader}>
          <View style={[styles.propertyIcon, { backgroundColor: colors.infoLight }]}>
            <Ionicons name={typeIcon as any} size={22} color={colors.info} />
          </View>
          <View style={styles.propertyHeaderInfo}>
            <Text style={[styles.propertyName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.propertyAddress, { color: colors.textSecondary }]} numberOfLines={2}>
              {address}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>

        <View style={[styles.propertyCardFooter, { borderTopColor: colors.borderLight }]}>
          <View style={styles.badgeRow}>
            <Badge
              text={item.is_primary ? t('properties.primary') : t('properties.secondary')}
              variant={item.is_primary ? 'active' : 'default'}
            />
            {!!propType && (
              <Badge
                text={getPropertyTypeLabel(propType)}
                variant="default"
              />
            )}
            {hasPets && (
              <View style={[styles.petIndicator, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="paw" size={12} color={colors.warning} />
                <Text style={[styles.petText, { color: colors.warning }]}>{t('properties.pets')}</Text>
              </View>
            )}
          </View>
          {clientName && (
            <View style={styles.clientRow}>
              <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.clientName, { color: colors.textTertiary }]} numberOfLines={1}>
                {clientName}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFormContent = () => (
    <View>
      <Input
        label={`${t('properties.propertyName')} *`}
        placeholder={t('properties.propertyNamePlaceholder')}
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        error={formErrors.name}
        leftIcon="home-outline"
        autoCapitalize="words"
      />

      <Select
        label={`${t('properties.client')} *`}
        placeholder={t('properties.selectClient')}
        options={clientOptions}
        value={formData.client_id || null}
        onChange={(value) => setFormData({ ...formData, client_id: value })}
        error={formErrors.client_id}
      />

      <Select
        label={t('properties.propertyType')}
        placeholder={t('properties.selectType')}
        options={propertyTypeOptions.filter(o => o.key !== '')}
        value={formData.property_type || null}
        onChange={(value) => setFormData({ ...formData, property_type: value })}
      />

      {/* Primary toggle */}
      <View style={[styles.switchRow, { borderColor: colors.border }]}>
        <View style={styles.switchLabel}>
          <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.switchLabelText, { color: colors.text }]}>
            {t('properties.primaryProperty')}
          </Text>
        </View>
        <Switch
          value={formData.is_primary}
          onValueChange={(value) => setFormData({ ...formData, is_primary: value })}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={formData.is_primary ? colors.primary : colors.surfaceSecondary}
        />
      </View>

      {/* Address Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('properties.address')}</Text>

      <Input
        label={t('properties.addressLine1')}
        placeholder={t('properties.streetAddress')}
        value={formData.address_line1}
        onChangeText={(text) => setFormData({ ...formData, address_line1: text })}
        leftIcon="location-outline"
        autoCapitalize="words"
      />
      <Input
        label={t('properties.addressLine2')}
        placeholder={t('properties.aptSuite')}
        value={formData.address_line2}
        onChangeText={(text) => setFormData({ ...formData, address_line2: text })}
        leftIcon="navigate-outline"
        autoCapitalize="words"
      />

      <View style={styles.rowInputs}>
        <View style={styles.rowInputHalf}>
          <Input
            label={t('properties.city')}
            placeholder={t('properties.city')}
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.rowInputQuarter}>
          <Input
            label={t('properties.state')}
            placeholder="ST"
            value={formData.state}
            onChangeText={(text) => setFormData({ ...formData, state: text })}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.rowInputQuarter}>
          <Input
            label={t('properties.zip')}
            placeholder={t('properties.zip')}
            value={formData.zip_code}
            onChangeText={(text) => setFormData({ ...formData, zip_code: text })}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Access Codes Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('properties.accessInfo')}</Text>

      <Input
        label={t('properties.gateCode')}
        placeholder={t('properties.gateCode')}
        value={formData.gate_code}
        onChangeText={(text) => setFormData({ ...formData, gate_code: text })}
        leftIcon="keypad-outline"
      />
      <Input
        label={t('properties.lockboxCode')}
        placeholder={t('properties.lockboxCode')}
        value={formData.lockbox_code}
        onChangeText={(text) => setFormData({ ...formData, lockbox_code: text })}
        leftIcon="lock-closed-outline"
      />
      <Input
        label={t('properties.alarmCode')}
        placeholder={t('properties.alarmCode')}
        value={formData.alarm_code}
        onChangeText={(text) => setFormData({ ...formData, alarm_code: text })}
        leftIcon="shield-outline"
      />

      {/* Property Details Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('properties.propertyDetails')}</Text>

      <View style={styles.rowInputs}>
        <View style={styles.rowInputHalf}>
          <Input
            label={t('properties.squareFootage')}
            placeholder={t('properties.squareFootagePlaceholder')}
            value={formData.square_footage}
            onChangeText={(text) => setFormData({ ...formData, square_footage: text })}
            error={formErrors.square_footage}
            keyboardType="number-pad"
            leftIcon="resize-outline"
          />
        </View>
        <View style={styles.rowInputHalf}>
          <Input
            label={t('properties.yearBuilt')}
            placeholder={t('properties.yearBuiltPlaceholder')}
            value={formData.year_built}
            onChangeText={(text) => setFormData({ ...formData, year_built: text })}
            error={formErrors.year_built}
            keyboardType="number-pad"
            leftIcon="calendar-outline"
          />
        </View>
      </View>

      {/* Safety Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('properties.safetyInfo')}</Text>

      <Input
        label={t('properties.pets')}
        placeholder={t('properties.petsPlaceholder')}
        value={formData.pets}
        onChangeText={(text) => setFormData({ ...formData, pets: text })}
        leftIcon="paw-outline"
        multiline
        numberOfLines={2}
      />
      <Input
        label={t('properties.hazards')}
        placeholder={t('properties.hazardsPlaceholder')}
        value={formData.hazards}
        onChangeText={(text) => setFormData({ ...formData, hazards: text })}
        leftIcon="warning-outline"
        multiline
        numberOfLines={2}
      />

      {/* Notes */}
      <Input
        label={t('properties.notes')}
        placeholder={t('properties.notesPlaceholder')}
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        leftIcon="document-text-outline"
        multiline
        numberOfLines={3}
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
          <Text style={[styles.title, { color: colors.text }]}>{t('properties.title')}</Text>
          <View style={styles.addButton} />
        </View>
        <View style={styles.skeletonContainer}>
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
        <Text style={[styles.title, { color: colors.text }]}>{t('properties.title')}</Text>
        {properties.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countBadgeText}>
              {properties.length}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards — by property type */}
      {properties.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <StatCard
              label={t('properties.residentialHomes')}
              value={stats.residential}
              icon="home"
              iconColor={colors.info}
              tintColor={filters.propertyType === 'residential' ? colors.info : undefined}
              onPress={() => {
                haptics.selection();
                setFilters(prev => ({
                  ...prev,
                  propertyType: prev.propertyType === 'residential' ? 'all' : 'residential',
                }));
              }}
            />
          </View>
          <View style={styles.statCard}>
            <StatCard
              label={t('properties.commercialSites')}
              value={stats.commercial}
              icon="business"
              iconColor={colors.primary}
              tintColor={filters.propertyType === 'commercial' ? colors.primary : undefined}
              onPress={() => {
                haptics.selection();
                setFilters(prev => ({
                  ...prev,
                  propertyType: prev.propertyType === 'commercial' ? 'all' : 'commercial',
                }));
              }}
            />
          </View>
          <View style={styles.statCard}>
            <StatCard
              label={t('properties.otherLocations')}
              value={stats.other}
              icon="location"
              iconColor={colors.warning}
              tintColor={filters.propertyType === 'other' ? colors.warning : undefined}
              onPress={() => {
                haptics.selection();
                setFilters(prev => ({
                  ...prev,
                  propertyType: prev.propertyType === 'other' ? 'all' : 'other',
                }));
              }}
            />
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('properties.searchPlaceholder')}
        />
      </View>

      {/* Filter & Sort Buttons */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surface, borderColor: activeFilterCount > 0 ? colors.primary : colors.border },
          ]}
          onPress={() => {
            haptics.impact(Haptics.ImpactFeedbackStyle.Light);
            setTempFilters(filters);
            setShowFilterModal(true);
          }}
        >
          <Ionicons name="funnel-outline" size={16} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
          <Text style={[styles.filterButtonText, { color: activeFilterCount > 0 ? colors.primary : colors.textSecondary }]}>
            {t('properties.filter')}
          </Text>
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            haptics.impact(Haptics.ImpactFeedbackStyle.Light);
            setShowSortModal(true);
          }}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
          <Text style={[styles.filterButtonText, { color: colors.textSecondary }]}>
            {sortOptions.find(o => o.key === sortBy)?.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips */}
      {activeFilterLabels.length > 0 && (
        <View style={styles.activeFiltersRow}>
          {activeFilterLabels.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.activeChip, { backgroundColor: colors.surface, borderColor: colors.primary }]}
              onPress={() => {
                haptics.selection();
                setFilters(prev => ({ ...prev, [key]: 'all' }));
              }}
            >
              <Text style={[styles.activeChipText, { color: colors.primary }]}>{label}</Text>
              <Ionicons name="close-circle" size={12} color={colors.primary} />
            </TouchableOpacity>
          ))}
          {activeFilterCount > 1 && (
            <TouchableOpacity
              style={[styles.activeChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => {
                haptics.selection();
                setFilters(defaultFilters);
              }}
            >
              <Text style={[styles.activeChipText, { color: colors.textSecondary }]}>{t('properties.resetAll')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Property List */}
      <FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="home-outline"
            title={searchQuery || activeFilterCount > 0
              ? t('properties.noSearchResults')
              : t('properties.noProperties')
            }
            description={searchQuery || activeFilterCount > 0
              ? t('properties.noSearchResultsDesc')
              : t('properties.noPropertiesDesc')
            }
            actionLabel={!searchQuery && activeFilterCount === 0 ? t('properties.addProperty') : undefined}
            onAction={!searchQuery && activeFilterCount === 0 ? openAddModal : undefined}
          />
        }
      />

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        title={t('properties.sort')}
      >
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortOption,
              { borderBottomColor: colors.borderLight },
              sortBy === option.key && { backgroundColor: colors.surfaceSecondary },
            ]}
            onPress={() => {
              haptics.selection();
              setSortBy(option.key as SortKey);
              setShowSortModal(false);
            }}
          >
            <Text style={[
              styles.sortOptionText,
              { color: sortBy === option.key ? colors.primary : colors.text },
            ]}>
              {option.label}
            </Text>
            {sortBy === option.key && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title={t('properties.filter')}
        size="full"
      >
        <View style={styles.filterModalContent}>
          {/* Property Type */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.propertyType')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'residential', 'commercial', 'other'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                residential: t('properties.residential'),
                commercial: t('properties.commercial'),
                other: t('properties.other'),
              };
              const isSelected = tempFilters.propertyType === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, propertyType: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pets */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.petsFilter')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'has_pets', 'no_pets'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                has_pets: t('properties.hasPetsOption'),
                no_pets: t('properties.noPetsOption'),
              };
              const isSelected = tempFilters.pets === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, pets: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Property Size */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.propertySize')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'small', 'medium', 'large'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                small: t('properties.sqftSmall'),
                medium: t('properties.sqftMedium'),
                large: t('properties.sqftLarge'),
              };
              const isSelected = tempFilters.size === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, size: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Year Built */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.yearBuiltFilter')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'new', 'older', 'historic'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                'new': t('properties.yearNew'),
                older: t('properties.yearOlder'),
                historic: t('properties.yearHistoric'),
              };
              const isSelected = tempFilters.yearBuilt === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, yearBuilt: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Access Codes */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.accessCodesFilter')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'has_codes', 'no_codes'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                has_codes: t('properties.hasCodes'),
                no_codes: t('properties.noCodes'),
              };
              const isSelected = tempFilters.accessCodes === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, accessCodes: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status */}
          <Text style={[styles.filterSectionLabel, { color: colors.text }]}>{t('properties.statusFilter')}</Text>
          <View style={styles.chipRow}>
            {(['all', 'primary'] as const).map((value) => {
              const labels: Record<string, string> = {
                all: t('properties.all'),
                primary: t('properties.primaryOnly'),
              };
              const isSelected = tempFilters.status === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTempFilters(prev => ({ ...prev, status: value }))}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? colors.primary : colors.text }]}>{labels[value]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bottom actions */}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title={t('properties.resetAll')}
            onPress={() => setTempFilters(defaultFilters)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title={t('properties.applyFilters')}
            onPress={() => {
              haptics.impact(Haptics.ImpactFeedbackStyle.Light);
              setFilters(tempFilters);
              setShowFilterModal(false);
            }}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Add Property Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('properties.addProperty')}
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
            title={t('properties.addProperty')}
            onPress={handleAddProperty}
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
  skeletonContainer: {
    padding: Spacing.lg,
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
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  countBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  filterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: 4,
    marginBottom: Spacing.xs,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  activeChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  // Property card
  propertyCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  propertyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  propertyIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  propertyName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  propertyAddress: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  propertyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  petIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  petText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  clientName: {
    fontSize: FontSizes.xs,
    flexShrink: 1,
  },

  // Sort modal
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  sortOptionText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },

  // Filter modal
  filterModalContent: {
    gap: Spacing.md,
  },
  filterSectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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

  // Form
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  switchLabelText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rowInputHalf: {
    flex: 1,
  },
  rowInputQuarter: {
    flex: 0.6,
  },

  // Modal actions
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
