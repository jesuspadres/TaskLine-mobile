import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { t, locale, setLocale } = useTranslations();
  const router = useRouter();

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'es' : 'en');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Language toggle */}
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langButton, { backgroundColor: colors.surface }]}
          onPress={toggleLanguage}
          activeOpacity={0.7}
        >
          <Ionicons name="language" size={16} color={colors.textSecondary} />
          <Text style={[styles.langText, { color: colors.textSecondary }]}>
            {locale === 'en' ? 'ES' : 'EN'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.branding}>
          <Image
            source={require('@/assets/icon.png')}
            style={styles.logo}
          />
          <Text style={[styles.title, { color: colors.text }]}>TaskLine</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            {t('auth.welcomeTagline')}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{t('auth.login')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              {t('auth.createAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  langText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  branding: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  buttons: {
    width: '100%',
    gap: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  outlineButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 2,
  },
  outlineButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
