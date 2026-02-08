import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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

export default function InvoiceSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — website only stores payment_instructions in user_settings
  const [paymentInstructions, setPaymentInstructions] = useState('');

  // Load existing settings
  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      try {
        const { data, error } = await (supabase.from('user_settings') as any)
          .select('payment_instructions')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found, which is expected for new users
          throw error;
        }

        if (data) {
          setPaymentInstructions(data.payment_instructions || '');
        }
      } catch (error: any) {
        showToast('error', error.message || t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await (supabase.from('user_settings') as any).upsert(
        {
          user_id: user.id,
          payment_instructions: paymentInstructions.trim(),
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      showToast('success', t('invoiceSettings.saved'));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('invoiceSettings.title')}
          </Text>
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
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('invoiceSettings.title')}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('invoiceSettings.description')}
          </Text>

          {/* Payment Instructions */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('invoiceSettings.paymentInstructions')}
            </Text>
            <View
              style={[
                styles.multilineWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.multilineIcon}
              />
              <TextInput
                style={[styles.multilineInput, { color: colors.text }]}
                value={paymentInstructions}
                onChangeText={setPaymentInstructions}
                placeholder={t('invoiceSettings.paymentInstructionsPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="sentences"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
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
    flex: 1,
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
  description: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
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
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  multilineWrapper: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'flex-start',
  },
  multilineIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  multilineInput: {
    flex: 1,
    fontSize: FontSizes.md,
    minHeight: 100,
    paddingTop: 0,
  },
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
});
