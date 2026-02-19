import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Spacing, FontSizes } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslations();

  const sections = [
    { title: t('legal.privacyIntro'), body: t('legal.privacyIntroBody') },
    { title: t('legal.privacyDefinitions'), body: t('legal.privacyDefinitionsBody') },
    { title: t('legal.dataWeCollect'), body: t('legal.dataWeCollectBody') },
    { title: t('legal.dataCollectedAuto'), body: t('legal.dataCollectedAutoBody') },
    { title: t('legal.dataFromThirdParties'), body: t('legal.dataFromThirdPartiesBody') },
    { title: t('legal.dobAndAge'), body: t('legal.dobAndAgeBody') },
    { title: t('legal.howWeUseData'), body: t('legal.howWeUseDataBody') },
    { title: t('legal.aiFeatures'), body: t('legal.aiFeaturesBody') },
    { title: t('legal.smsMessaging'), body: t('legal.smsMessagingBody') },
    { title: t('legal.smsOptInOut'), body: t('legal.smsOptInOutBody') },
    { title: t('legal.smsDataPrivacy'), body: t('legal.smsDataPrivacyBody') },
    { title: t('legal.paymentData'), body: t('legal.paymentDataBody') },
    { title: t('legal.geolocationData'), body: t('legal.geolocationDataBody') },
    { title: t('legal.thirdPartyServices'), body: t('legal.thirdPartyServicesBody') },
    { title: t('legal.infoSharing'), body: t('legal.infoSharingBody') },
    { title: t('legal.dataSecurity'), body: t('legal.dataSecurityBody') },
    { title: t('legal.dataRetention'), body: t('legal.dataRetentionBody') },
    { title: t('legal.accountDeletion'), body: t('legal.accountDeletionBody') },
    { title: t('legal.yourRights'), body: t('legal.yourRightsBody') },
    { title: t('legal.internationalTransfers'), body: t('legal.internationalTransfersBody') },
    { title: t('legal.childrensPrivacy'), body: t('legal.childrensPrivacyBody') },
    { title: t('legal.cookies'), body: t('legal.cookiesBody') },
    { title: t('legal.doNotTrack'), body: t('legal.doNotTrackBody') },
    { title: t('legal.policyChanges'), body: t('legal.policyChangesBody') },
    { title: t('legal.contactUs'), body: t('legal.contactUsBody') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('legal.privacyPolicy')}
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
