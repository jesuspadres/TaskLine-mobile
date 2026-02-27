import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';
import { getRequestFormSettings, updateRequestFormSettings } from '@/lib/websiteApi';
import { secureLog } from '@/lib/security';

const MAX_OPTIONS = 20;

export default function RequestFormSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuthStore();

  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await getRequestFormSettings(user.id);
        setOptions(data.timeline_options || []);
      } catch (err) {
        secureLog.error('Failed to load request form settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleAddOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) {
      showToast('info', t('requestFormSettings.maxReached'));
      return;
    }
    setOptions(prev => [...prev, '']);
  }, [options.length, t]);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length <= 1) {
      showToast('info', t('requestFormSettings.minRequired'));
      return;
    }
    setOptions(prev => prev.filter((_, i) => i !== index));
  }, [options.length, t]);

  const handleSave = useCallback(async () => {
    const cleaned = options.map(o => o.trim()).filter(o => o.length > 0);
    if (cleaned.length === 0) {
      showToast('error', t('requestFormSettings.minRequired'));
      return;
    }
    setSaving(true);
    try {
      const result = await updateRequestFormSettings(cleaned);
      setOptions(result.timeline_options);
      showToast('success', t('requestFormSettings.saved'));
    } catch (err: any) {
      secureLog.error('Failed to save request form settings:', err);
      showToast('error', t('requestFormSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [options, t]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('requestFormSettings.title')}</Text>
        </View>
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
        <Text style={[styles.title, { color: colors.text }]}>{t('requestFormSettings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('requestFormSettings.description')}
        </Text>

        {/* Timeline Options Section */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('requestFormSettings.timelineOptions')}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.countBadgeText, { color: '#fff' }]}>{options.length}</Text>
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {t('requestFormSettings.timelineOptionsHint')}
          </Text>

          {/* Options List */}
          {options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <View style={[styles.optionInputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.optionInput, { color: colors.text }]}
                  value={option}
                  onChangeText={(value) => handleOptionChange(index, value)}
                  placeholder={t('requestFormSettings.optionPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  maxLength={100}
                  returnKeyType="done"
                />
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveOption(index)}
                style={[
                  styles.removeButton,
                  { backgroundColor: colors.errorLight },
                  options.length <= 1 && { opacity: 0.3 },
                ]}
                disabled={options.length <= 1}
              >
                <Ionicons name="close" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Option Button */}
          {options.length < MAX_OPTIONS && (
            <TouchableOpacity
              onPress={handleAddOption}
              style={[styles.addButton, { borderColor: colors.primary }]}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>
                {t('requestFormSettings.addOption')}
              </Text>
            </TouchableOpacity>
          )}
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
            <Text style={styles.saveButtonText}>{t('requestFormSettings.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  hint: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionInputWrapper: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
    justifyContent: 'center',
  },
  optionInput: {
    fontSize: FontSizes.sm,
    padding: 0,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.xs,
  },
  addButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
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
});
