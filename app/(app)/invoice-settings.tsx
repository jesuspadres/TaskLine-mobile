import { useState, useEffect, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast, Select } from '@/components';

export default function InvoiceSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [defaultInvoiceNotes, setDefaultInvoiceNotes] = useState('');
  const [autoSendInvoice, setAutoSendInvoice] = useState(false);

  const currencyOptions = useMemo(() => [
    { key: 'USD', label: 'USD ($)' },
    { key: 'MXN', label: 'MXN ($)' },
    { key: 'EUR', label: 'EUR (\u20AC)' },
    { key: 'GBP', label: 'GBP (\u00A3)' },
    { key: 'CAD', label: 'CAD ($)' },
    { key: 'AUD', label: 'AUD ($)' },
  ], []);

  const paymentTermsOptions = useMemo(() => [
    { key: '', label: '\u2014' },
    { key: 'due_on_receipt', label: t('invoiceSettings.dueOnReceipt') },
    { key: 'net_15', label: t('invoiceSettings.net15') },
    { key: 'net_30', label: t('invoiceSettings.net30') },
    { key: 'net_60', label: t('invoiceSettings.net60') },
  ], [t]);

  // Load existing settings
  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      try {
        const { data, error } = await (supabase.from('user_settings') as any)
          .select('payment_instructions, default_tax_rate, default_currency, default_payment_terms, default_invoice_notes, auto_send_invoice')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setPaymentInstructions(data.payment_instructions || '');
          setDefaultTaxRate(data.default_tax_rate != null ? String(data.default_tax_rate) : '');
          setDefaultCurrency(data.default_currency || 'USD');
          setDefaultPaymentTerms(data.default_payment_terms || '');
          setDefaultInvoiceNotes(data.default_invoice_notes || '');
          setAutoSendInvoice(!!data.auto_send_invoice);
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
      const taxRate = defaultTaxRate.trim() ? parseFloat(defaultTaxRate) : null;

      const { error } = await (supabase.from('user_settings') as any).upsert(
        {
          user_id: user.id,
          payment_instructions: paymentInstructions.trim(),
          default_tax_rate: taxRate,
          default_currency: defaultCurrency,
          default_payment_terms: defaultPaymentTerms || null,
          default_invoice_notes: defaultInvoiceNotes.trim() || null,
          auto_send_invoice: autoSendInvoice,
        } as any,
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

          {/* Default Currency */}
          <View style={styles.inputGroup}>
            <Select
              label={t('invoiceSettings.currency')}
              options={currencyOptions}
              value={defaultCurrency}
              onChange={setDefaultCurrency}
            />
          </View>

          {/* Default Payment Terms */}
          <View style={styles.inputGroup}>
            <Select
              label={t('invoiceSettings.paymentTerms')}
              placeholder={t('invoiceSettings.paymentTermsPlaceholder')}
              options={paymentTermsOptions}
              value={defaultPaymentTerms}
              onChange={setDefaultPaymentTerms}
            />
          </View>

          {/* Default Tax Rate */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('invoiceSettings.taxRate')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="calculator-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={defaultTaxRate}
                onChangeText={setDefaultTaxRate}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.inputSuffix, { color: colors.textTertiary }]}>%</Text>
            </View>
          </View>

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

          {/* Default Invoice Notes */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('invoiceSettings.defaultNotes')}
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
                name="document-text-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.multilineIcon}
              />
              <TextInput
                style={[styles.multilineInput, { color: colors.text }]}
                value={defaultInvoiceNotes}
                onChangeText={setDefaultInvoiceNotes}
                placeholder={t('invoiceSettings.defaultNotesPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />
            </View>
          </View>

          {/* Auto-send Toggle */}
          <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                {t('invoiceSettings.autoSend')}
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                {t('invoiceSettings.autoSendDescription')}
              </Text>
            </View>
            <Switch
              value={autoSendInvoice}
              onValueChange={setAutoSendInvoice}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={autoSendInvoice ? colors.primary : colors.textTertiary}
            />
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
  inputSuffix: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginLeft: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  toggleContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
});
