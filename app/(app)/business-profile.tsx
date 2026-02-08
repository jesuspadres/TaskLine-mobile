import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';

interface BusinessTypeOption {
  key: string;
  i18nKey: string;
  icon: string;
}

const BUSINESS_TYPE_KEYS: BusinessTypeOption[] = [
  { key: 'freelancer', i18nKey: 'businessProfile.freelancer', icon: 'person-outline' },
  { key: 'sole_proprietor', i18nKey: 'businessProfile.soleProprietor', icon: 'person-circle-outline' },
  { key: 'llc', i18nKey: 'businessProfile.llc', icon: 'shield-outline' },
  { key: 'corporation', i18nKey: 'businessProfile.corporation', icon: 'business-outline' },
  { key: 'partnership', i18nKey: 'businessProfile.partnership', icon: 'people-outline' },
  { key: 'nonprofit', i18nKey: 'businessProfile.nonprofit', icon: 'heart-outline' },
  { key: 'other', i18nKey: 'businessProfile.other', icon: 'ellipsis-horizontal-outline' },
];

export default function BusinessProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Load form data from profiles table (matches website)
  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .select('business_name, business_type, phone_number, tax_id, website_url, business_address')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setBusinessName(data.business_name || '');
          setBusinessType(data.business_type || '');
          setPhoneNumber(data.phone_number || '');
          setTaxId(data.tax_id || '');
          setWebsiteUrl(data.website_url || '');
          setBusinessAddress(data.business_address || '');
        }
      } catch (error: any) {
        showToast('error', error.message || t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const selectedTypeLabel = useMemo(() => {
    const opt = BUSINESS_TYPE_KEYS.find((o) => o.key === businessType);
    return opt ? t(opt.i18nKey) : '';
  }, [businessType, t]);

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await (supabase.from('profiles') as any).upsert(
        {
          id: user.id,
          business_name: businessName.trim() || null,
          email: user.email,
          business_type: businessType || null,
          phone_number: phoneNumber.trim() || null,
          tax_id: taxId.trim() || null,
          website_url: websiteUrl.trim() || null,
          business_address: businessAddress.trim() || null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'id' }
      );

      if (error) throw error;

      showToast('success', t('businessProfile.saved'));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const renderTypeOption = ({ item }: { item: BusinessTypeOption }) => {
    const isSelected = businessType === item.key;
    return (
      <TouchableOpacity
        style={[
          styles.typeOption,
          {
            backgroundColor: isSelected ? colors.primary : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          setBusinessType(item.key);
          setShowTypeModal(false);
        }}
      >
        <Ionicons
          name={item.icon as any}
          size={22}
          color={isSelected ? '#fff' : colors.textSecondary}
          style={styles.typeOptionIcon}
        />
        <Text
          style={[
            styles.typeOptionLabel,
            { color: isSelected ? '#fff' : colors.text },
          ]}
        >
          {t(item.i18nKey)}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('businessProfile.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('businessProfile.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Business Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('businessProfile.businessName')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder={t('businessProfile.businessName')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Business Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('businessProfile.businessType')}
            </Text>
            <TouchableOpacity
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setShowTypeModal(true)}
            >
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.selectText,
                  {
                    color: selectedTypeLabel ? colors.text : colors.textTertiary,
                  },
                ]}
              >
                {selectedTypeLabel || t('businessProfile.businessType')}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>{t('businessProfile.phone')}</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="call-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder={t('businessProfile.phone')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Tax ID */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>{t('businessProfile.taxId')}</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={taxId}
                onChangeText={setTaxId}
                placeholder={t('businessProfile.taxId')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                returnKeyType="next"
              />
            </View>
            <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
              {t('businessProfile.taxIdHint')}
            </Text>
          </View>

          {/* Website URL */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('businessProfile.websiteUrl')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                placeholder="https://your-website.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Business Address */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('businessProfile.businessAddress')}
            </Text>
            <View
              style={[
                styles.inputWrapperMultiline,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIconMultiline}
              />
              <TextInput
                style={[styles.inputMultiline, { color: colors.text }]}
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder={t('businessProfile.businessAddress')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="default"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              saving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Business Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <SafeAreaView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          edges={['top']}
        >
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <TouchableOpacity
              onPress={() => setShowTypeModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('businessProfile.businessType')}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <FlatList
            data={BUSINESS_TYPE_KEYS}
            keyExtractor={(item) => item.key}
            renderItem={renderTypeOption}
            contentContainerStyle={styles.typeListContent}
            ItemSeparatorComponent={() => (
              <View
                style={[styles.typeSeparator, { backgroundColor: colors.borderLight }]}
              />
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
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
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  // Input styles
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  inputWrapperMultiline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 96,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  inputIconMultiline: {
    marginRight: Spacing.sm,
    marginTop: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  inputMultiline: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.sm,
    minHeight: 80,
  },
  inputHint: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  selectText: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },

  // Save button
  saveButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  modalHeaderSpacer: {
    width: 40,
  },

  // Type option styles
  typeListContent: {
    padding: Spacing.lg,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  typeOptionIcon: {
    marginRight: Spacing.md,
  },
  typeOptionLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  typeSeparator: {
    height: 1,
    marginVertical: Spacing.xs,
  },
});
