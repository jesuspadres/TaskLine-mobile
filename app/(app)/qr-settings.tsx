import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';
import { useOfflineData } from '@/hooks/useOfflineData';
import { ENV } from '@/lib/env';

type TabType = 'requests' | 'custom';
type SizePreset = 'business-card' | 'digital' | 'print' | 'large';

const COLOR_PRESETS = [
  '#000000', '#1e293b', '#0B3D91', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981',
  '#14b8a6', '#ffffff',
];

const SIZE_PRESETS: { key: SizePreset; i18nKey: string; size: number }[] = [
  { key: 'business-card', i18nKey: 'qrSettings.businessCard', size: 300 },
  { key: 'digital', i18nKey: 'qrSettings.digital', size: 400 },
  { key: 'print', i18nKey: 'qrSettings.print', size: 500 },
  { key: 'large', i18nKey: 'qrSettings.large', size: 1000 },
];

const PREVIEW_SIZE = 250;

export default function QRSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { t } = useTranslations();

  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [sizePreset, setSizePreset] = useState<SizePreset>('print');
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasAppliedCache, setHasAppliedCache] = useState<string | null>(null);

  interface QRSettingsCache {
    requests: { foreground_color: string; background_color: string; size_preset: SizePreset; custom_url?: string } | null;
    custom: { foreground_color: string; background_color: string; size_preset: SizePreset; custom_url?: string } | null;
    shortCode: string | null;
  }

  const { data: qrData, loading, refresh } = useOfflineData<QRSettingsCache>(
    'qr_settings',
    async () => {
      const [qrResult, linkResult] = await Promise.all([
        (supabase.from('user_qr_codes') as any)
          .select('*')
          .eq('user_id', user!.id),
        (supabase.from('user_request_links') as any)
          .select('short_code')
          .eq('user_id', user!.id)
          .eq('is_active', true)
          .single(),
      ]);

      const rows = (!qrResult.error && qrResult.data) ? qrResult.data as any[] : [];
      return {
        requests: rows.find((r: any) => r.qr_type === 'requests') || null,
        custom: rows.find((r: any) => r.qr_type === 'custom') || null,
        shortCode: linkResult.data?.short_code || null,
      };
    },
    { enabled: !!user?.id },
  );

  // Apply cached settings to local form state when data loads or tab changes
  const cacheFingerprint = `${activeTab}:${JSON.stringify(qrData)}`;
  if (qrData && hasAppliedCache !== cacheFingerprint) {
    const settings = qrData[activeTab];
    setFgColor(settings?.foreground_color || '#000000');
    setBgColor(settings?.background_color || '#ffffff');
    setSizePreset(settings?.size_preset || 'print');
    if (activeTab === 'custom') {
      setCustomUrl(settings?.custom_url || '');
    }
    setHasAppliedCache(cacheFingerprint);
  }

  const requestUrl = qrData?.shortCode
    ? `${ENV.APP_URL}/portal?code=${qrData.shortCode}`
    : '';
  const currentUrl = activeTab === 'requests' ? requestUrl : customUrl;

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (activeTab === 'custom' && !customUrl.trim()) {
      showToast('error', t('qrSettings.noUrl'));
      return;
    }

    setSaving(true);
    try {
      const upsertData: Record<string, any> = {
          user_id: user.id,
          qr_type: activeTab,
          foreground_color: fgColor,
          background_color: bgColor,
          size_preset: sizePreset,
        };

      if (activeTab === 'custom') {
        upsertData.custom_url = customUrl.trim();
      }

      const { error } = await (supabase.from('user_qr_codes') as any).upsert(
        upsertData,
        { onConflict: 'user_id,qr_type' }
      );

      if (error) throw error;
      refresh();
      showToast('success', t('qrSettings.saved'));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const urlToShare = activeTab === 'requests' ? requestUrl : customUrl.trim();
    if (!urlToShare) {
      showToast('error', t('qrSettings.noUrl'));
      return;
    }

    try {
      await Share.share({
        message: urlToShare,
        url: urlToShare,
      });
    } catch {
      // User dismissed share sheet or share failed
    }
  };

  const renderTabControl = () => (
    <View style={[styles.tabContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <TouchableOpacity
        style={[
          styles.tab,
          {
            backgroundColor: activeTab === 'requests' ? colors.primary : 'transparent',
            borderRadius: BorderRadius.lg,
          },
        ]}
        onPress={() => handleTabChange('requests')}
      >
        <Ionicons
          name="link-outline"
          size={18}
          color={activeTab === 'requests' ? '#fff' : colors.textSecondary}
          style={styles.tabIcon}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'requests' ? '#fff' : colors.textSecondary },
          ]}
        >
          {t('qrSettings.requestLink')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tab,
          {
            backgroundColor: activeTab === 'custom' ? colors.primary : 'transparent',
            borderRadius: BorderRadius.lg,
          },
        ]}
        onPress={() => handleTabChange('custom')}
      >
        <Ionicons
          name="create-outline"
          size={18}
          color={activeTab === 'custom' ? '#fff' : colors.textSecondary}
          style={styles.tabIcon}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'custom' ? '#fff' : colors.textSecondary },
          ]}
        >
          {t('qrSettings.custom')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderQRPreview = () => {
    const displayUrl = activeTab === 'requests' ? requestUrl : customUrl.trim();
    const hasValidUrl = displayUrl.length > 0;

    return (
      <View style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.md]}>
        <View style={[styles.qrPreviewWrapper, { backgroundColor: bgColor }]}>
          {hasValidUrl ? (
            <QRCode
              value={displayUrl}
              size={PREVIEW_SIZE}
              color={fgColor}
              backgroundColor={bgColor}
              ecl="M"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={80} color={colors.textTertiary} />
              <Text style={[styles.qrPlaceholderText, { color: colors.textTertiary }]}>
                {t('qrSettings.noUrl')}
              </Text>
            </View>
          )}
        </View>
        {hasValidUrl && (
          <Text
            style={[styles.qrUrl, { color: colors.textSecondary }]}
            numberOfLines={2}
            ellipsizeMode="middle"
          >
            {displayUrl}
          </Text>
        )}
      </View>
    );
  };

  const renderUrlInput = () => {
    if (activeTab !== 'custom') return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('qrSettings.customUrl')}</Text>
        <View style={[styles.urlInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="globe-outline" size={20} color={colors.textTertiary} style={styles.urlInputIcon} />
          <TextInput
            style={[styles.urlInput, { color: colors.text }]}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder={t('qrSettings.customUrlPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          {customUrl.length > 0 && (
            <TouchableOpacity onPress={() => setCustomUrl('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderColorPicker = (
    label: string,
    selectedColor: string,
    onSelect: (color: string) => void,
  ) => (
    <View style={styles.section}>
      <View style={styles.colorLabelRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
        <View style={[styles.colorPreview, { backgroundColor: selectedColor, borderColor: colors.border }]} />
      </View>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.map((color) => {
          const isSelected = selectedColor === color;
          const isWhite = color === '#ffffff';
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                isWhite && { borderWidth: 1, borderColor: colors.border },
                isSelected && styles.colorSwatchSelected,
                isSelected && { borderColor: colors.primary },
              ]}
              onPress={() => onSelect(color)}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={isWhite || color === '#f59e0b' || color === '#10b981' || color === '#14b8a6' ? '#000000' : '#ffffff'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderSizePresets = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('qrSettings.sizePreset')}</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        {t('qrSettings.sizeDescription')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeScroll}>
        <View style={styles.sizeRow}>
          {SIZE_PRESETS.map((preset) => {
            const isActive = sizePreset === preset.key;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.sizeButton,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSizePreset(preset.key)}
              >
                <Text
                  style={[
                    styles.sizeLabel,
                    { color: isActive ? '#fff' : colors.text },
                  ]}
                >
                  {t(preset.i18nKey)}
                </Text>
                <Text
                  style={[
                    styles.sizeDimension,
                    { color: isActive ? 'rgba(255,255,255,0.7)' : colors.textTertiary },
                  ]}
                >
                  {preset.size}px
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderActions = () => (
    <View style={styles.actionsRow}>
      <TouchableOpacity
        style={[styles.actionButton, styles.shareButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={20} color={colors.primary} />
        <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('qrSettings.share')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.saveActionButton,
          { backgroundColor: colors.primary },
          saving && styles.buttonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.saveActionButtonText}>{t('common.save')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('qrSettings.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('qrSettings.title')}</Text>
        </View>

        {/* Tab Control */}
        {renderTabControl()}

        {/* QR Preview Card */}
        {renderQRPreview()}

        {/* Custom URL Input */}
        {renderUrlInput()}

        {/* Foreground Color Picker */}
        {renderColorPicker(t('qrSettings.foregroundColor'), fgColor, setFgColor)}

        {/* Background Color Picker */}
        {renderColorPicker(t('qrSettings.backgroundColor'), bgColor, setBgColor)}

        {/* Size Presets */}
        {renderSizePresets()}

        {/* Actions */}
        {renderActions()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
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
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab Control
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.xs,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabIcon: {
    marginRight: 2,
  },
  tabLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // QR Preview Card
  qrCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qrPreviewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    minHeight: PREVIEW_SIZE + Spacing['3xl'] * 2,
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
  },
  qrPlaceholderText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  qrUrl: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Sections
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: FontSizes.xs,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },

  // URL Input
  urlInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  urlInputIcon: {
    marginRight: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  clearButton: {
    padding: Spacing.xs,
  },

  // Color Picker
  colorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
  },

  // Size Presets
  sizeScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  sizeButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 100,
  },
  sizeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  sizeDimension: {
    fontSize: FontSizes.xs,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minHeight: 52,
  },
  shareButton: {
    flex: 1,
    borderWidth: 1,
  },
  saveActionButton: {
    flex: 2,
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  saveActionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
