import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Spacing, FontSizes } from '@/constants/theme';

export default function TermsOfServiceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslations();

  const sections = [
    { title: t('legal.tosAcceptance'), body: t('legal.tosAcceptanceBody') },
    { title: t('legal.tosDefinitions'), body: t('legal.tosDefinitionsBody') },
    { title: t('legal.tosEligibility'), body: t('legal.tosEligibilityBody') },
    { title: t('legal.tosDescription'), body: t('legal.tosDescriptionBody') },
    { title: t('legal.tosSubscriptions'), body: t('legal.tosSubscriptionsBody') },
    { title: t('legal.tosFreeTrials'), body: t('legal.tosFreeTrialsBody') },
    { title: t('legal.tosPaymentProcessing'), body: t('legal.tosPaymentProcessingBody') },
    { title: t('legal.tosCancellation'), body: t('legal.tosCancellationBody') },
    { title: t('legal.tosSmsConsent'), body: t('legal.tosSmsConsentBody') },
    { title: t('legal.tosSmsFrequency'), body: t('legal.tosSmsFrequencyBody') },
    { title: t('legal.tosSmsOptOut'), body: t('legal.tosSmsOptOutBody') },
    { title: t('legal.tosSmsCarrier'), body: t('legal.tosSmsCarrierBody') },
    { title: t('legal.tosAiFeatures'), body: t('legal.tosAiFeaturesBody') },
    { title: t('legal.tosUserContent'), body: t('legal.tosUserContentBody') },
    { title: t('legal.tosClientData'), body: t('legal.tosClientDataBody') },
    { title: t('legal.tosAcceptableUse'), body: t('legal.tosAcceptableUseBody') },
    { title: t('legal.tosProhibited'), body: t('legal.tosProhibitedBody') },
    { title: t('legal.tosIntellectualProperty'), body: t('legal.tosIntellectualPropertyBody') },
    { title: t('legal.tosThirdParty'), body: t('legal.tosThirdPartyBody') },
    { title: t('legal.tosPrivacy'), body: t('legal.tosPrivacyBody') },
    { title: t('legal.tosDisclaimers'), body: t('legal.tosDisclaimersBody') },
    { title: t('legal.tosLiability'), body: t('legal.tosLiabilityBody') },
    { title: t('legal.tosIndemnification'), body: t('legal.tosIndemnificationBody') },
    { title: t('legal.tosArbitration'), body: t('legal.tosArbitrationBody') },
    { title: t('legal.tosGoverningLaw'), body: t('legal.tosGoverningLawBody') },
    { title: t('legal.tosSeverability'), body: t('legal.tosSeverabilityBody') },
    { title: t('legal.tosEntireAgreement'), body: t('legal.tosEntireAgreementBody') },
    { title: t('legal.tosChanges'), body: t('legal.tosChangesBody') },
    { title: t('legal.tosContactUs'), body: t('legal.tosContactUsBody') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('legal.termsOfService')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
          {t('legal.lastUpdated')}: February 2026
        </Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {index + 1}. {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  lastUpdated: { fontSize: FontSizes.sm, marginBottom: Spacing.xl, fontStyle: 'italic' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', marginBottom: Spacing.sm },
  sectionBody: { fontSize: FontSizes.sm, lineHeight: 22 },
});
