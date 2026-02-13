import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslations();

  const sections = [
    {
      title: t('legal.privacyIntro'),
      body: t('legal.privacyIntroBody'),
    },
    {
      title: t('legal.dataWeCollect'),
      body: t('legal.dataWeCollectBody'),
    },
    {
      title: t('legal.howWeUseData'),
      body: t('legal.howWeUseDataBody'),
    },
    {
      title: t('legal.dataStorage'),
      body: t('legal.dataStorageBody'),
    },
    {
      title: t('legal.thirdPartyServices'),
      body: t('legal.thirdPartyServicesBody'),
    },
    {
      title: t('legal.dataSecurity'),
      body: t('legal.dataSecurityBody'),
    },
    {
      title: t('legal.yourRights'),
      body: t('legal.yourRightsBody'),
    },
    {
      title: t('legal.dataRetention'),
      body: t('legal.dataRetentionBody'),
    },
    {
      title: t('legal.childrensPrivacy'),
      body: t('legal.childrensPrivacyBody'),
    },
    {
      title: t('legal.policyChanges'),
      body: t('legal.policyChangesBody'),
    },
    {
      title: t('legal.contactUs'),
      body: t('legal.contactUsBody'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('legal.privacyPolicy')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
  container: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  lastUpdated: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xl,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
});
