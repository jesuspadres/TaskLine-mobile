import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
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
import { secureLog } from '@/lib/security';
import { useSubscription } from '@/hooks/useSubscription';

type AutomationMode = 'off' | 'advise' | 'auto_create';

interface AiSettings {
  ai_enabled: boolean;
  automation_mode: AutomationMode;
  auto_respond: boolean;
  custom_instructions: string;
}

const DEFAULT_SETTINGS: AiSettings = {
  ai_enabled: false,
  automation_mode: 'off',
  auto_respond: false,
  custom_instructions: '',
};

export default function AiSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { tier } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);

  const isPaidTier = tier !== 'free';

  const automationModes = useMemo(() => [
    { value: 'off' as AutomationMode, label: t('aiSettings.modeOff'), desc: t('aiSettings.modeOffDesc'), icon: 'close-circle-outline' },
    { value: 'advise' as AutomationMode, label: t('aiSettings.modeAdvise'), desc: t('aiSettings.modeAdviseDesc'), icon: 'bulb-outline' },
    { value: 'auto_create' as AutomationMode, label: t('aiSettings.modeAutoCreate'), desc: t('aiSettings.modeAutoCreateDesc'), icon: 'sparkles-outline' },
  ], [t]);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await (supabase.from('ai_settings') as any)
        .select('ai_enabled, automation_mode, auto_respond, custom_instructions')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setSettings({
          ai_enabled: data.ai_enabled ?? false,
          automation_mode: data.automation_mode ?? 'off',
          auto_respond: data.auto_respond ?? false,
          custom_instructions: data.custom_instructions ?? '',
        });
      }
    } catch {
      // Column may not exist yet
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from('ai_settings') as any)
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id' });
      if (error) throw error;
      showToast('success', t('aiSettings.saved'));
    } catch (error: any) {
      secureLog.error('Failed to save AI settings:', error);
      showToast('error', error.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('aiSettings.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('aiSettings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isPaidTier && (
          <View style={[styles.upgradeCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <Ionicons name="lock-closed" size={20} color={colors.warning} />
            <View style={styles.upgradeCardContent}>
              <Text style={[styles.upgradeTitle, { color: colors.text }]}>{t('aiSettings.proRequired')}</Text>
              <Text style={[styles.upgradeSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.proRequiredSubtitle')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/plans' as any)}
            >
              <Text style={styles.upgradeBtnText}>{t('smsSettings.upgrade')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Description */}
        <View style={[styles.descCard, { backgroundColor: colors.infoLight }]}>
          <Ionicons name="sparkles" size={24} color={colors.primary} />
          <Text style={[styles.descText, { color: colors.text }]}>{t('aiSettings.description')}</Text>
        </View>

        {/* Master Toggle */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('aiSettings.enableAi')}</Text>
              <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.enableAiDesc')}</Text>
            </View>
            <Switch
              value={settings.ai_enabled}
              onValueChange={(v) => updateField('ai_enabled', v)}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={settings.ai_enabled ? colors.primary : colors.surface}
              disabled={!isPaidTier}
            />
          </View>
        </View>

        {/* Automation Mode */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('aiSettings.automationMode')}</Text>
          </View>

          {automationModes.map((mode) => (
            <TouchableOpacity
              key={mode.value}
              style={[
                styles.modeOption,
                { borderColor: settings.automation_mode === mode.value ? colors.primary : colors.border },
                settings.automation_mode === mode.value && { backgroundColor: colors.primary + '10' },
              ]}
              onPress={() => updateField('automation_mode', mode.value)}
              disabled={!isPaidTier || !settings.ai_enabled}
            >
              <Ionicons
                name={mode.icon as any}
                size={20}
                color={settings.automation_mode === mode.value ? colors.primary : colors.textTertiary}
              />
              <View style={styles.modeContent}>
                <Text style={[styles.modeLabel, { color: settings.automation_mode === mode.value ? colors.primary : colors.text }]}>
                  {mode.label}
                </Text>
                <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>{mode.desc}</Text>
              </View>
              {settings.automation_mode === mode.value && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto-Respond */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('aiSettings.autoRespond')}</Text>
              <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.autoRespondDesc')}</Text>
            </View>
            <Switch
              value={settings.auto_respond}
              onValueChange={(v) => updateField('auto_respond', v)}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={settings.auto_respond ? colors.primary : colors.surface}
              disabled={!isPaidTier || !settings.ai_enabled}
            />
          </View>
        </View>

        {/* Custom Instructions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('aiSettings.customInstructions')}</Text>
          </View>
          <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>{t('aiSettings.customInstructionsDesc')}</Text>
          <TextInput
            style={[styles.instructionsInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={settings.custom_instructions}
            onChangeText={(v) => updateField('custom_instructions', v)}
            placeholder={t('aiSettings.customInstructionsPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={isPaidTier && settings.ai_enabled}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveDisabled]}
          onPress={handleSave}
          disabled={saving || !isPaidTier}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  title: { fontSize: FontSizes['2xl'], fontWeight: 'bold' },
  headerSpacer: { width: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },

  upgradeCard: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.lg, gap: Spacing.md,
  },
  upgradeCardContent: { flex: 1 },
  upgradeTitle: { fontSize: FontSizes.sm, fontWeight: '700' },
  upgradeSubtitle: { fontSize: FontSizes.xs, lineHeight: 16 },
  upgradeBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg },
  upgradeBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },

  descCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg,
  },
  descText: { flex: 1, fontSize: FontSizes.sm, lineHeight: 20 },

  card: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleContent: { flex: 1, marginRight: Spacing.md },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '500' },
  toggleSubtitle: { fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },

  modeOption: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md,
  },
  modeContent: { flex: 1 },
  modeLabel: { fontSize: FontSizes.sm, fontWeight: '600' },
  modeDesc: { fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },

  fieldHint: { fontSize: FontSizes.xs, lineHeight: 16, marginBottom: Spacing.sm },
  instructionsInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.md, fontSize: FontSizes.sm,
    minHeight: 120,
  },

  saveButton: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  saveDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },
});
