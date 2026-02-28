import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker, { Panel1, HueSlider, Preview } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';
import {
  getBrandingSettings,
  updateBrandingSettings,
  uploadBrandingLogo,
  deleteBrandingLogo,
  BrandingSettings,
} from '@/lib/websiteApi';
import { secureLog } from '@/lib/security';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_PRIMARY = '#FFFFFF';
const DEFAULT_ACCENT = '#16A34A';

export default function BrandingSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuthStore();
  const { isPlus, isBusiness, loading: subLoading } = useSubscription();

  const canAccess = isPlus || isBusiness;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showBusinessName, setShowBusinessName] = useState(true);

  // Color picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'primary' | 'accent'>('primary');
  const [pickerTempColor, setPickerTempColor] = useState(DEFAULT_PRIMARY);

  const openPicker = useCallback((target: 'primary' | 'accent') => {
    const current = target === 'primary' ? primaryColor : accentColor;
    setPickerTarget(target);
    setPickerTempColor(HEX_REGEX.test(current) ? current : (target === 'primary' ? DEFAULT_PRIMARY : DEFAULT_ACCENT));
    setPickerVisible(true);
  }, [primaryColor, accentColor]);

  const confirmPicker = useCallback(() => {
    if (pickerTarget === 'primary') {
      setPrimaryColor(pickerTempColor);
    } else {
      setAccentColor(pickerTempColor);
    }
    setPickerVisible(false);
  }, [pickerTarget, pickerTempColor]);

  // ── Load Settings ──────────────────────────────────────────────────

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await getBrandingSettings();
        if (data.settings) {
          setPrimaryColor(data.settings.primary_color || DEFAULT_PRIMARY);
          setAccentColor(data.settings.accent_color || DEFAULT_ACCENT);
          setLogoUrl(data.settings.logo_url || null);
          setShowBusinessName(data.settings.show_business_name ?? true);
        }
      } catch (err) {
        secureLog.error('Failed to load branding settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [canAccess]);

  // ── Save Settings ──────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!HEX_REGEX.test(primaryColor)) {
      showToast('error', t('brandingSettings.invalidHex'));
      return;
    }
    if (!HEX_REGEX.test(accentColor)) {
      showToast('error', t('brandingSettings.invalidHex'));
      return;
    }

    setSaving(true);
    try {
      await updateBrandingSettings({
        primary_color: primaryColor,
        accent_color: accentColor,
        show_business_name: showBusinessName,
      });
      showToast('success', t('brandingSettings.saved'));
    } catch (err: any) {
      secureLog.error('Failed to save branding:', err);
      showToast('error', t('brandingSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [primaryColor, accentColor, showBusinessName, t]);

  // ── Logo Upload ────────────────────────────────────────────────────

  const handleUploadLogo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/png';

    // Validate type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      showToast('error', t('brandingSettings.logoError'));
      return;
    }

    // Validate size (5MB)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      showToast('error', t('brandingSettings.logoError'));
      return;
    }

    setUploading(true);
    try {
      const data = await uploadBrandingLogo(asset.uri, mimeType);
      // Append cache-busting param — URL path doesn't change between uploads
      const bustCache = `${data.logoUrl}?v=${Date.now()}`;
      setLogoUrl(bustCache);
      showToast('success', t('brandingSettings.logoUploaded'));
    } catch (err: any) {
      secureLog.error('Failed to upload logo:', err);
      showToast('error', t('brandingSettings.logoError'));
    } finally {
      setUploading(false);
    }
  }, [t]);

  // ── Logo Remove ────────────────────────────────────────────────────

  const handleRemoveLogo = useCallback(() => {
    Alert.alert(
      t('brandingSettings.removeLogo'),
      t('brandingSettings.removeLogoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBrandingLogo();
              setLogoUrl(null);
              showToast('success', t('brandingSettings.logoRemoved'));
            } catch (err: any) {
              secureLog.error('Failed to remove logo:', err);
              showToast('error', t('brandingSettings.logoError'));
            }
          },
        },
      ]
    );
  }, [t]);

  // ── Reset to Defaults ──────────────────────────────────────────────

  const handleReset = useCallback(() => {
    Alert.alert(
      t('brandingSettings.resetDefaults'),
      t('brandingSettings.resetConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('brandingSettings.resetDefaults'),
          onPress: () => {
            setPrimaryColor(DEFAULT_PRIMARY);
            setAccentColor(DEFAULT_ACCENT);
            setShowBusinessName(true);
          },
        },
      ]
    );
  }, [t]);

  // ── Loading State ──────────────────────────────────────────────────

  if (subLoading || loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('brandingSettings.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Upgrade Prompt ─────────────────────────────────────────────────

  if (!canAccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('brandingSettings.title')}</Text>
        </View>
        <View style={styles.upgradeContainer}>
          <Ionicons name="color-palette-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.upgradeTitle, { color: colors.text }]}>{t('brandingSettings.title')}</Text>
          <Text style={[styles.upgradeDescription, { color: colors.textSecondary }]}>
            {t('brandingSettings.upgradePrompt')}
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(app)/plans' as any)}
          >
            <Text style={styles.upgradeButtonText}>{t('brandingSettings.viewPlans')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────

  const isValidPrimary = HEX_REGEX.test(primaryColor);
  const isValidAccent = HEX_REGEX.test(accentColor);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('brandingSettings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('brandingSettings.subtitle')}
        </Text>

        {/* ── Colors Section ──────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-fill-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('brandingSettings.colors')}
            </Text>
          </View>

          {/* Primary Color */}
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            {t('brandingSettings.primaryColor')}
          </Text>
          <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
            {t('brandingSettings.primaryColorDesc')}
          </Text>
          <View style={styles.colorRow}>
            <TouchableOpacity
              onPress={() => openPicker('primary')}
              activeOpacity={0.7}
              style={[
                styles.colorSwatch,
                { backgroundColor: isValidPrimary ? primaryColor : '#ccc', borderColor: colors.border },
              ]}
            >
              <Ionicons name="color-palette" size={18} color={isValidPrimary && primaryColor !== '#FFFFFF' ? '#fff' : '#666'} style={styles.swatchIcon} />
            </TouchableOpacity>
            <View style={[styles.colorInputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: !isValidPrimary && primaryColor.length > 0 ? colors.error : colors.border }]}>
              <TextInput
                style={[styles.colorInput, { color: colors.text }]}
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#FFFFFF"
                placeholderTextColor={colors.textTertiary}
                maxLength={7}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Accent Color */}
          <Text style={[styles.fieldLabel, { color: colors.text, marginTop: Spacing.lg }]}>
            {t('brandingSettings.accentColor')}
          </Text>
          <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
            {t('brandingSettings.accentColorDesc')}
          </Text>
          <View style={styles.colorRow}>
            <TouchableOpacity
              onPress={() => openPicker('accent')}
              activeOpacity={0.7}
              style={[
                styles.colorSwatch,
                { backgroundColor: isValidAccent ? accentColor : '#ccc', borderColor: colors.border },
              ]}
            >
              <Ionicons name="color-palette" size={18} color="#fff" style={styles.swatchIcon} />
            </TouchableOpacity>
            <View style={[styles.colorInputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: !isValidAccent && accentColor.length > 0 ? colors.error : colors.border }]}>
              <TextInput
                style={[styles.colorInput, { color: colors.text }]}
                value={accentColor}
                onChangeText={setAccentColor}
                placeholder="#16A34A"
                placeholderTextColor={colors.textTertiary}
                maxLength={7}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* ── Logo Section ────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="image-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('brandingSettings.logo')}
            </Text>
          </View>
          <Text style={[styles.fieldHint, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
            {t('brandingSettings.logoDesc')}
          </Text>

          {logoUrl ? (
            <View style={styles.logoPreviewContainer}>
              <Image
                source={{ uri: logoUrl }}
                style={[styles.logoPreview, { borderColor: colors.border }]}
                resizeMode="contain"
              />
              <TouchableOpacity
                onPress={handleRemoveLogo}
                style={[styles.removeLogoButton, { backgroundColor: colors.errorLight }]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={[styles.removeLogoText, { color: colors.error }]}>
                  {t('brandingSettings.removeLogo')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleUploadLogo}
              disabled={uploading}
              style={[styles.uploadArea, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                  <Text style={[styles.uploadText, { color: colors.primary }]}>
                    {t('brandingSettings.uploadLogo')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.fieldHint, { color: colors.textTertiary, marginTop: Spacing.sm }]}>
            {t('brandingSettings.logoFormats')}
          </Text>
        </View>

        {/* ── Display Options Section ─────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('brandingSettings.displayOptions')}
            </Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                {t('brandingSettings.showBusinessName')}
              </Text>
              <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
                {t('brandingSettings.showBusinessNameDesc')}
              </Text>
            </View>
            <Switch
              value={showBusinessName}
              onValueChange={setShowBusinessName}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={showBusinessName ? colors.primary : colors.surface}
            />
          </View>
        </View>

        {/* ── Reset to Defaults ───────────────────────────────── */}
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.resetText, { color: colors.textSecondary }]}>
            {t('brandingSettings.resetDefaults')}
          </Text>
        </TouchableOpacity>

        {/* ── Save Button ─────────────────────────────────────── */}
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
            <Text style={styles.saveButtonText}>{t('brandingSettings.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Color Picker Modal ──────────────────────────────── */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {pickerTarget === 'primary' ? t('brandingSettings.primaryColor') : t('brandingSettings.accentColor')}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ColorPicker
              value={pickerTempColor}
              onComplete={(c) => {
                'worklet';
                // c.hex returns #RRGGBBAA — strip alpha to get #RRGGBB
                const hex6 = c.hex.slice(0, 7);
                runOnJS(setPickerTempColor)(hex6);
              }}
              style={styles.picker}
            >
              <Preview style={styles.pickerPreview} />
              <Panel1 style={styles.pickerPanel} />
              <HueSlider style={styles.pickerSlider} />
            </ColorPicker>

            <Text style={[styles.pickerHexLabel, { color: colors.textSecondary }]}>
              {pickerTempColor.toUpperCase()}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={[styles.modalButton, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmPicker}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  // ── Upgrade ────────────────────────────────────────────
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  upgradeTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  upgradeDescription: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
  },
  upgradeButton: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // ── Card ───────────────────────────────────────────────
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldHint: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },

  // ── Color Inputs ───────────────────────────────────────
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchIcon: {
    opacity: 0.7,
  },
  colorInputWrapper: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
    justifyContent: 'center',
  },
  colorInput: {
    fontSize: FontSizes.sm,
    fontFamily: 'monospace',
    padding: 0,
  },

  // ── Logo ───────────────────────────────────────────────
  logoPreviewContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoPreview: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  removeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  removeLogoText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  uploadArea: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  uploadText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // ── Display Options ────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  switchLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },

  // ── Reset ──────────────────────────────────────────────
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  resetText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },

  // ── Save ───────────────────────────────────────────────
  saveButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // ── Color Picker Modal ──────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  picker: {
    gap: Spacing.md,
  },
  pickerPreview: {
    height: 48,
    borderRadius: BorderRadius.lg,
  },
  pickerPanel: {
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  pickerSlider: {
    height: 32,
    borderRadius: BorderRadius.lg,
  },
  pickerHexLabel: {
    textAlign: 'center',
    fontSize: FontSizes.sm,
    fontFamily: 'monospace',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
