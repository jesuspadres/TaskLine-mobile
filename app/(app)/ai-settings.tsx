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

// Purple accent for AI features (matches web)
const PURPLE = {
  base: '#7c3aed',
  light: '#ede9fe',
  lightDark: '#2d1f5e',
  border: '#c4b5fd',
  borderDark: '#6d28d9',
  text: '#6d28d9',
  textDark: '#a78bfa',
};

export default function AiSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { t } = useTranslations();
  const subscription = useSubscription();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);

  const canUseAi = subscription.isPlus || subscription.isBusiness;

  const purple = useMemo(() => ({
    bg: isDark ? PURPLE.lightDark : PURPLE.light,
    border: isDark ? PURPLE.borderDark : PURPLE.border,
    text: isDark ? PURPLE.textDark : PURPLE.text,
    base: PURPLE.base,
  }), [isDark]);

  const automationModes = useMemo(() => [
    {
      value: 'off' as AutomationMode,
      label: t('aiSettings.modeOff'),
      desc: t('aiSettings.modeOffDesc'),
      icon: 'hand-left-outline' as const,
    },
    {
      value: 'advise' as AutomationMode,
      label: t('aiSettings.modeAdvise'),
      desc: t('aiSettings.modeAdviseDesc'),
      icon: 'bulb-outline' as const,
    },
    {
      value: 'auto_create' as AutomationMode,
      label: t('aiSettings.modeAutoCreate'),
      desc: t('aiSettings.modeAutoCreateDesc'),
      icon: 'sparkles-outline' as const,
    },
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
      // Table may not exist yet
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
          <ActivityIndicator size="large" color={purple.base} />
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
        {!canUseAi && (
          <View style={[styles.upgradeCard, { backgroundColor: purple.bg, borderColor: purple.border }]}>
            <View style={[styles.upgradeIconWrap, { backgroundColor: purple.bg }]}>
              <Ionicons name="lock-closed" size={24} color={purple.text} />
            </View>
            <Text style={[styles.upgradeTitle, { color: colors.text }]}>{t('aiSettings.plusRequired')}</Text>
            <Text style={[styles.upgradeSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.plusRequiredSubtitle')}</Text>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: purple.base }]}
              onPress={() => router.push('/(app)/plans' as any)}
            >
              <Text style={styles.upgradeBtnText}>{t('aiSettings.upgrade')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header card with sparkle icon */}
        <View style={[styles.headerCard, { backgroundColor: purple.bg }]}>
          <View style={[styles.headerIconWrap, { backgroundColor: isDark ? purple.border + '30' : '#f3e8ff' }]}>
            <Ionicons name="sparkles" size={20} color={purple.text} />
          </View>
          <View style={styles.headerCardContent}>
            <Text style={[styles.headerCardTitle, { color: colors.text }]}>{t('aiSettings.title')}</Text>
            <Text style={[styles.headerCardSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.description')}</Text>
          </View>
        </View>

        {/* Master Toggle */}
        <View style={[styles.toggleCard, { backgroundColor: isDark ? colors.surface : '#f9fafb', borderColor: colors.border }]}>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('aiSettings.enableAi')}</Text>
            <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.enableAiDesc')}</Text>
          </View>
          <Switch
            value={settings.ai_enabled}
            onValueChange={(v) => updateField('ai_enabled', v)}
            trackColor={{ false: colors.border, true: purple.base + '60' }}
            thumbColor={settings.ai_enabled ? purple.base : colors.surface}
            disabled={!canUseAi}
          />
        </View>

        {settings.ai_enabled && (
          <>
            {/* Automation Mode */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('aiSettings.automationMode')}</Text>
              <View style={styles.modeList}>
                {automationModes.map((mode) => {
                  const isSelected = settings.automation_mode === mode.value;
                  return (
                    <TouchableOpacity
                      key={mode.value}
                      style={[
                        styles.modeOption,
                        {
                          borderColor: isSelected ? purple.border : colors.border,
                          backgroundColor: isSelected ? purple.bg : colors.surface,
                        },
                      ]}
                      onPress={() => updateField('automation_mode', mode.value)}
                      disabled={!canUseAi}
                      activeOpacity={0.7}
                    >
                      {/* Radio indicator */}
                      <View style={[
                        styles.radio,
                        { borderColor: isSelected ? purple.base : colors.textTertiary },
                      ]}>
                        {isSelected && <View style={[styles.radioInner, { backgroundColor: purple.base }]} />}
                      </View>
                      <View style={styles.modeContent}>
                        <Text style={[styles.modeLabel, { color: isSelected ? purple.text : colors.text }]}>
                          {mode.label}
                        </Text>
                        <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>{mode.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Auto-Respond Toggle */}
            <View style={[styles.toggleCard, { backgroundColor: isDark ? colors.surface : '#f9fafb', borderColor: colors.border }]}>
              <View style={styles.toggleContent}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('aiSettings.autoRespond')}</Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>{t('aiSettings.autoRespondDesc')}</Text>
              </View>
              <Switch
                value={settings.auto_respond}
                onValueChange={(v) => updateField('auto_respond', v)}
                trackColor={{ false: colors.border, true: purple.base + '60' }}
                thumbColor={settings.auto_respond ? purple.base : colors.surface}
                disabled={!canUseAi}
              />
            </View>

            {/* Custom Instructions */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('aiSettings.customInstructions')}</Text>
              <TextInput
                style={[styles.instructionsInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={settings.custom_instructions}
                onChangeText={(v) => updateField('custom_instructions', v)}
                placeholder={t('aiSettings.customInstructionsPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={canUseAi}
              />
              <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>{t('aiSettings.customInstructionsDesc')}</Text>
            </View>
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: purple.base }, saving && styles.saveDisabled]}
          onPress={handleSave}
          disabled={saving || !canUseAi}
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
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'], gap: Spacing.lg },

  // Upgrade card (centered, matches web locked state)
  upgradeCard: {
    alignItems: 'center', padding: Spacing.xl,
    borderRadius: BorderRadius.xl, borderWidth: 1,
  },
  upgradeIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  upgradeTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  upgradeSubtitle: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20 },
  upgradeBtn: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg },
  upgradeBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },

  // Header card with icon + title + subtitle (matches web card header)
  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.xl,
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCardContent: { flex: 1 },
  headerCardTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  headerCardSubtitle: { fontSize: FontSizes.xs, lineHeight: 18, marginTop: 2 },

  // Toggle cards (master toggle + auto-respond)
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1,
  },
  toggleContent: { flex: 1, marginRight: Spacing.md },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '500' },
  toggleSubtitle: { fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },

  // Section with label
  section: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Automation mode radio options
  modeList: { gap: Spacing.sm },
  modeOption: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderWidth: 1, borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: Spacing.md,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, marginTop: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  radioInner: {
    width: 10, height: 10, borderRadius: 5,
  },
  modeContent: { flex: 1 },
  modeLabel: { fontSize: FontSizes.sm, fontWeight: '600' },
  modeDesc: { fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },

  // Custom instructions
  instructionsInput: {
    borderWidth: 1, borderRadius: BorderRadius.xl,
    padding: Spacing.md, fontSize: FontSizes.sm,
    minHeight: 100,
  },
  fieldHint: { fontSize: FontSizes.xs, lineHeight: 16 },

  // Save button
  saveButton: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  saveDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },
});
