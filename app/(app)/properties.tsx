import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  SearchBar,
  FilterChips,
  Badge,
  EmptyState,
  Modal,
  Input,
  Button,
  Select,
} from '@/components';
import type {
  Property,
  PropertyInsert,
  Client,
} from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';

type PropertyWithClient = Property & {
  clients?: { name: string } | null;
};

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'has_pets', label: 'Has Pets' },
];

const initialFormData = {
  name: '',
  client_id: '',
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<PropertyWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Edit state
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithClient | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients((data as Client[]) ?? []);
    } catch (error) {
      console.error('Error fetching clients:', error);
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
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to load properties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      errors.name = 'Property name is required';
    }

    if (!formData.client_id) {
      errors.client_id = 'Client is required';
    }

    if (formData.square_footage && isNaN(Number(formData.square_footage))) {
      errors.square_footage = 'Must be a valid number';
    }

    if (formData.year_built && isNaN(Number(formData.year_built))) {
      errors.year_built = 'Must be a valid year';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddProperty = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setSaving(true);
    try {
      const newProperty: PropertyInsert = {
        user_id: user.id,
        client_id: formData.client_id,
        name: formData.name.trim(),
        address_line1: formData.address_line1.trim() || null,
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip_code: formData.zip_code.trim() || null,
        gate_code: formData.gate_code.trim() || null,
        lockbox_code: formData.lockbox_code.trim() || null,
        alarm_code: formData.alarm_code.trim() || null,
        pets: formData.pets.trim() || null,
        hazards: formData.hazards.trim() || null,
        square_footage: formData.square_footage ? Number(formData.square_footage) : null,
        year_built: formData.year_built ? Number(formData.year_built) : null,
        is_primary: formData.is_primary,
        notes: formData.notes.trim() || null,
      };

      const { error } = await supabase.from('properties').insert(newProperty);

      if (error) throw error;

      setShowAddModal(false);
      setFormData(initialFormData);
      setFormErrors({});
      fetchProperties();
      Alert.alert('Success', 'Property added successfully');
    } catch (error: any) {
      console.error('Error adding property:', error);
      Alert.alert('Error', error.message || 'Failed to add property');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProperty = async () => {
    if (!validateForm() || !selectedProperty) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          client_id: formData.client_id,
          name: formData.name.trim(),
          address_line1: formData.address_line1.trim() || null,
          address_line2: formData.address_line2.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          zip_code: formData.zip_code.trim() || null,
          gate_code: formData.gate_code.trim() || null,
          lockbox_code: formData.lockbox_code.trim() || null,
          alarm_code: formData.alarm_code.trim() || null,
          pets: formData.pets.trim() || null,
          hazards: formData.hazards.trim() || null,
          square_footage: formData.square_footage ? Number(formData.square_footage) : null,
          year_built: formData.year_built ? Number(formData.year_built) : null,
          is_primary: formData.is_primary,
          notes: formData.notes.trim() || null,
        })
        .eq('id', selectedProperty.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedProperty(null);
      setFormData(initialFormData);
      setFormErrors({});
      fetchProperties();
      Alert.alert('Success', 'Property updated successfully');
    } catch (error: any) {
      console.error('Error updating property:', error);
      Alert.alert('Error', error.message || 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProperty = (property: PropertyWithClient) => {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${property.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('properties')
                .delete()
                .eq('id', property.id);

              if (error) throw error;

              setShowEditModal(false);
              setSelectedProperty(null);
              fetchProperties();
              Alert.alert('Success', 'Property deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete property');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (property: PropertyWithClient) => {
    setSelectedProperty(property);
    setFormData({
      name: property.name,
      client_id: property.client_id,
      address_line1: property.address_line1 || '',
      address_line2: property.address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      zip_code: property.zip_code || '',
      gate_code: property.gate_code || '',
      lockbox_code: property.lockbox_code || '',
      alarm_code: property.alarm_code || '',
      pets: property.pets || '',
      hazards: property.hazards || '',
      square_footage: property.square_footage ? String(property.square_footage) : '',
      year_built: property.year_built ? String(property.year_built) : '',
      is_primary: property.is_primary,
      notes: property.notes || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setShowAddModal(true);
  };

  const getAddressString = (property: Property): string => {
    const parts = [
      property.address_line1,
      property.address_line2,
      [property.city, property.state].filter(Boolean).join(', '),
      property.zip_code,
    ].filter(Boolean);
    return parts.join(', ') || 'No address';
  };

  const clientOptions = clients.map((c) => ({
    key: c.id,
    label: c.name,
  }));

  const filteredProperties = properties.filter((property) => {
    const address = getAddressString(property).toLowerCase();
    const name = property.name.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      name.includes(query) ||
      address.includes(query) ||
      (property.clients?.name?.toLowerCase().includes(query) ?? false);

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'primary') return matchesSearch && property.is_primary;
    if (filterType === 'secondary') return matchesSearch && !property.is_primary;
    if (filterType === 'has_pets') return matchesSearch && !!property.pets;
    return matchesSearch;
  });

  const renderProperty = ({ item }: { item: PropertyWithClient }) => {
    const address = getAddressString(item);
    const clientName = item.clients?.name;

    return (
      <TouchableOpacity
        style={[styles.propertyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.propertyCardHeader}>
          <View style={[styles.propertyIcon, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="home" size={22} color={colors.info} />
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
              text={item.is_primary ? 'Primary' : 'Secondary'}
              variant={item.is_primary ? 'active' : 'default'}
            />
            {!!item.pets && (
              <View style={[styles.petIndicator, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="paw" size={12} color={colors.warning} />
                <Text style={[styles.petText, { color: colors.warning }]}>Pets</Text>
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
        label="Property Name *"
        placeholder="e.g. Main Office, Smith Residence"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        error={formErrors.name}
        leftIcon="home-outline"
        autoCapitalize="words"
      />

      <Select
        label="Client *"
        placeholder="Select a client"
        options={clientOptions}
        value={formData.client_id || null}
        onChange={(value) => setFormData({ ...formData, client_id: value })}
        error={formErrors.client_id}
      />

      {/* Primary toggle */}
      <View style={[styles.switchRow, { borderColor: colors.border }]}>
        <View style={styles.switchLabel}>
          <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.switchLabelText, { color: colors.text }]}>Primary Property</Text>
        </View>
        <Switch
          value={formData.is_primary}
          onValueChange={(value) => setFormData({ ...formData, is_primary: value })}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={formData.is_primary ? colors.primary : colors.surfaceSecondary}
        />
      </View>

      {/* Address Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Address</Text>

      <Input
        label="Address Line 1"
        placeholder="Street address"
        value={formData.address_line1}
        onChangeText={(text) => setFormData({ ...formData, address_line1: text })}
        leftIcon="location-outline"
        autoCapitalize="words"
      />
      <Input
        label="Address Line 2"
        placeholder="Apt, suite, unit, etc."
        value={formData.address_line2}
        onChangeText={(text) => setFormData({ ...formData, address_line2: text })}
        leftIcon="navigate-outline"
        autoCapitalize="words"
      />

      <View style={styles.rowInputs}>
        <View style={styles.rowInputHalf}>
          <Input
            label="City"
            placeholder="City"
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.rowInputQuarter}>
          <Input
            label="State"
            placeholder="ST"
            value={formData.state}
            onChangeText={(text) => setFormData({ ...formData, state: text })}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.rowInputQuarter}>
          <Input
            label="Zip"
            placeholder="Zip"
            value={formData.zip_code}
            onChangeText={(text) => setFormData({ ...formData, zip_code: text })}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Access Codes Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Access Information</Text>

      <Input
        label="Gate Code"
        placeholder="Gate code"
        value={formData.gate_code}
        onChangeText={(text) => setFormData({ ...formData, gate_code: text })}
        leftIcon="keypad-outline"
      />
      <Input
        label="Lockbox Code"
        placeholder="Lockbox code"
        value={formData.lockbox_code}
        onChangeText={(text) => setFormData({ ...formData, lockbox_code: text })}
        leftIcon="lock-closed-outline"
      />
      <Input
        label="Alarm Code"
        placeholder="Alarm code"
        value={formData.alarm_code}
        onChangeText={(text) => setFormData({ ...formData, alarm_code: text })}
        leftIcon="shield-outline"
      />

      {/* Property Details Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Property Details</Text>

      <View style={styles.rowInputs}>
        <View style={styles.rowInputHalf}>
          <Input
            label="Square Footage"
            placeholder="e.g. 2400"
            value={formData.square_footage}
            onChangeText={(text) => setFormData({ ...formData, square_footage: text })}
            error={formErrors.square_footage}
            keyboardType="number-pad"
            leftIcon="resize-outline"
          />
        </View>
        <View style={styles.rowInputHalf}>
          <Input
            label="Year Built"
            placeholder="e.g. 2005"
            value={formData.year_built}
            onChangeText={(text) => setFormData({ ...formData, year_built: text })}
            error={formErrors.year_built}
            keyboardType="number-pad"
            leftIcon="calendar-outline"
          />
        </View>
      </View>

      {/* Safety Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Safety &amp; Special Info</Text>

      <Input
        label="Pets"
        placeholder="e.g. 2 dogs (friendly), 1 cat"
        value={formData.pets}
        onChangeText={(text) => setFormData({ ...formData, pets: text })}
        leftIcon="paw-outline"
        multiline
        numberOfLines={2}
      />
      <Input
        label="Hazards"
        placeholder="e.g. Low-hanging wires, uneven steps"
        value={formData.hazards}
        onChangeText={(text) => setFormData({ ...formData, hazards: text })}
        leftIcon="warning-outline"
        multiline
        numberOfLines={2}
      />

      {/* Notes */}
      <Input
        label="Notes"
        placeholder="Additional notes about this property..."
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
        <Text style={[styles.title, { color: colors.text }]}>Properties</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search properties..."
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <FilterChips
          options={filterOptions}
          selected={filterType}
          onSelect={setFilterType}
        />
      </View>

      {/* Property List */}
      <FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="home-outline"
            title="No properties found"
            description={
              searchQuery
                ? 'Try a different search term'
                : 'Add your first property to get started'
            }
            actionLabel={!searchQuery ? 'Add Property' : undefined}
            onAction={!searchQuery ? openAddModal : undefined}
          />
        }
      />

      {/* Add Property Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Property"
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title="Cancel"
            onPress={() => setShowAddModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Add Property"
            onPress={handleAddProperty}
            loading={saving}
            style={styles.actionButton}
          />
        </View>
      </Modal>

      {/* Edit Property Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Property"
        size="full"
      >
        {renderFormContent()}
        <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
          <Button
            title="Delete"
            onPress={() => selectedProperty && handleDeleteProperty(selectedProperty)}
            variant="danger"
            style={styles.deleteButton}
          />
          <Button
            title="Cancel"
            onPress={() => setShowEditModal(false)}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Save"
            onPress={handleEditProperty}
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
    marginBottom: Spacing.md,
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
  deleteButton: {
    marginRight: 'auto',
  },
});
