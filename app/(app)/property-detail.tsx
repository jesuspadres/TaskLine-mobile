import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import {
  Modal, Input, Button, Badge, EmptyState, ListSkeleton, showToast,
} from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import type { Property } from '@/lib/database.types';

interface PropertyClient {
  id: string;
  name: string;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);
  const [clientInfo, setClientInfo] = useState<PropertyClient | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', address_line1: '', address_line2: '', city: '', state: '',
    zip_code: '', gate_code: '', lockbox_code: '', alarm_code: '',
    pets: '', hazards: '', square_footage: '', year_built: '',
    notes: '', is_primary: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const dateLocale = locale === 'es' ? 'es-ES' : 'en-US';

  // ─── Data Fetching ───────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, clients(id, name)')
        .eq('id', id)
        .single();

      if (error) throw error;

      const { clients: clientData, ...propData } = data as any;
      setProperty(propData as Property);
      setClientInfo(clientData as PropertyClient | null);
    } catch (error) {
      showToast('error', t('propertyDetail.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ─── Edit ──────────────────────────────────────────────────

  const openEditModal = () => {
    if (!property) return;
    setForm({
      name: property.name,
      address_line1: property.address_line1 || '',
      address_line2: (property as any).address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      zip_code: property.zip_code || '',
      gate_code: property.gate_code || '',
      lockbox_code: property.lockbox_code || '',
      alarm_code: property.alarm_code || '',
      pets: property.pets || '',
      hazards: property.hazards || '',
      square_footage: (property as any).square_footage ? String((property as any).square_footage) : '',
      year_built: (property as any).year_built ? String((property as any).year_built) : '',
      notes: property.notes || '',
      is_primary: property.is_primary,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('clientDetail.propertyNameRequired');
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
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip_code: form.zip_code.trim() || null,
        gate_code: form.gate_code.trim() || null,
        lockbox_code: form.lockbox_code.trim() || null,
        alarm_code: form.alarm_code.trim() || null,
        pets: form.pets.trim() || null,
        hazards: form.hazards.trim() || null,
        square_footage: form.square_footage ? Number(form.square_footage) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        notes: form.notes.trim() || null,
        is_primary: form.is_primary,
      };
      const { error } = await supabase.from('properties')
        .update(payload)
        .eq('id', property.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setShowEditModal(false);
      fetchData();
      showToast('success', t('clientDetail.propertyUpdated'));
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
      t('clientDetail.deleteProperty'),
      t('clientDetail.deletePropertyConfirm', { name: property.name }),
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
              showToast('success', t('clientDetail.propertyDeleted'));
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

  // ─── Helpers ───────────────────────────────────────────────

  const formatAddress = () => {
    if (!property) return null;
    const parts = [
      property.address_line1,
      (property as any).address_line2,
      [property.city, property.state].filter(Boolean).join(', '),
      property.zip_code,
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
        />
      </SafeAreaView>
    );
  }

  const address = formatAddress();
  const sqft = (property as any).square_footage;
  const yearBuilt = (property as any).year_built;

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
            <Ionicons name="home" size={28} color={colors.info} />
          </View>
          <Text style={[styles.propertyName, { color: colors.text }]}>{property.name}</Text>
          {property.is_primary && (
            <View style={[styles.primaryBadge, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="star" size={12} color={colors.primary} />
              <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>
                {t('clientDetail.primary')}
              </Text>
            </View>
          )}
          {clientInfo && (
            <TouchableOpacity
              style={styles.clientLink}
              onPress={() => router.push({ pathname: '/(app)/client-detail', params: { id: clientInfo.id } } as any)}
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
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{address}</Text>
            </View>
          </View>
        )}

        {/* Property Details */}
        {(sqft || yearBuilt) && (
          <View style={styles.detailsRow}>
            {sqft && (
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
            {yearBuilt && (
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
              {t('clientDetail.accessCodes')}
            </Text>
            {property.gate_code && (
              <View style={styles.codeRow}>
                <View style={[styles.codeIcon, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="key-outline" size={16} color={colors.warning} />
                </View>
                <View style={styles.codeContent}>
                  <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                    {t('properties.gateCode')}
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
                    {t('clientDetail.lockboxCode')}
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
                    {t('clientDetail.alarmCode')}
                  </Text>
                  <Text style={[styles.codeValue, { color: colors.text }]}>{property.alarm_code}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Pets */}
        {property.pets && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('properties.hasPets')}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="paw-outline" size={18} color={colors.warning} />
              <Text style={[styles.infoText, { color: colors.text }]}>{property.pets}</Text>
            </View>
          </View>
        )}

        {/* Hazards */}
        {property.hazards && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('clientDetail.hazards')}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="warning-outline" size={18} color={colors.error} />
              <Text style={[styles.infoText, { color: colors.text }]}>{property.hazards}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {property.notes && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
              {t('clientDetail.notes')}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{property.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Property Modal */}
      <Modal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('clientDetail.editProperty')}
        size="full"
      >
        <View>
          <Input
            label={`${t('properties.name')} *`}
            placeholder={t('properties.name')}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            error={formErrors.name}
            leftIcon="home-outline"
          />
          <Input
            label={t('clientDetail.streetAddress')}
            placeholder={t('clientDetail.streetAddress')}
            value={form.address_line1}
            onChangeText={(v) => setForm({ ...form, address_line1: v })}
            leftIcon="location-outline"
          />
          <Input
            label={t('propertyDetail.addressLine2')}
            placeholder={t('propertyDetail.addressLine2Placeholder')}
            value={form.address_line2}
            onChangeText={(v) => setForm({ ...form, address_line2: v })}
            leftIcon="navigate-outline"
          />
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input
                label={t('properties.city')}
                placeholder={t('properties.city')}
                value={form.city}
                onChangeText={(v) => setForm({ ...form, city: v })}
              />
            </View>
            <View style={styles.flex1}>
              <Input
                label={t('properties.state')}
                placeholder={t('properties.state')}
                value={form.state}
                onChangeText={(v) => setForm({ ...form, state: v })}
              />
            </View>
          </View>
          <Input
            label={t('properties.zip')}
            placeholder={t('properties.zip')}
            value={form.zip_code}
            onChangeText={(v) => setForm({ ...form, zip_code: v })}
            keyboardType="numeric"
          />

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('clientDetail.accessCodes')}
          </Text>
          <Input
            label={t('properties.gateCode')}
            placeholder={t('properties.gateCode')}
            value={form.gate_code}
            onChangeText={(v) => setForm({ ...form, gate_code: v })}
            leftIcon="key-outline"
          />
          <Input
            label={t('clientDetail.lockboxCode')}
            placeholder={t('clientDetail.lockboxCode')}
            value={form.lockbox_code}
            onChangeText={(v) => setForm({ ...form, lockbox_code: v })}
            leftIcon="lock-closed-outline"
          />
          <Input
            label={t('clientDetail.alarmCode')}
            placeholder={t('clientDetail.alarmCode')}
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
                label={t('propertyDetail.sqft')}
                placeholder="e.g. 2400"
                value={form.square_footage}
                onChangeText={(v) => setForm({ ...form, square_footage: v })}
                error={formErrors.square_footage}
                keyboardType="numeric"
                leftIcon="resize-outline"
              />
            </View>
            <View style={styles.flex1}>
              <Input
                label={t('propertyDetail.yearBuilt')}
                placeholder="e.g. 2005"
                value={form.year_built}
                onChangeText={(v) => setForm({ ...form, year_built: v })}
                error={formErrors.year_built}
                keyboardType="numeric"
                leftIcon="calendar-outline"
              />
            </View>
          </View>

          <Text style={[styles.formSectionLabel, { color: colors.text, borderTopColor: colors.borderLight }]}>
            {t('clientDetail.additionalInfo')}
          </Text>
          <Input
            label={t('properties.hasPets')}
            placeholder={t('properties.petDetails')}
            value={form.pets}
            onChangeText={(v) => setForm({ ...form, pets: v })}
            leftIcon="paw-outline"
          />
          <Input
            label={t('clientDetail.hazards')}
            placeholder={t('clientDetail.hazards')}
            value={form.hazards}
            onChangeText={(v) => setForm({ ...form, hazards: v })}
            leftIcon="warning-outline"
          />
          <Input
            label={t('properties.notes')}
            placeholder={t('properties.notes')}
            value={form.notes}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            leftIcon="document-text-outline"
            multiline
            numberOfLines={3}
          />
          <View style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('clientDetail.primaryProperty')}</Text>
            <Switch
              value={form.is_primary}
              onValueChange={(v) => setForm({ ...form, is_primary: v })}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={form.is_primary ? colors.primary : colors.surfaceSecondary}
            />
          </View>
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
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  primaryBadgeText: {
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

  // Form styles
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
