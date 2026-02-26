import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { useBiometricStore } from '@/stores/biometricStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { showToast } from '@/components';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactFeedbackStyle } from 'expo-haptics';

const MAX_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_THRESHOLD = 3;
const LOCKOUT_STORAGE_KEY = '@taskline_login_lockout';
const REMEMBER_EMAIL_KEY = '@taskline_remember_email';

interface LockoutData {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [lockoutData, setLockoutData] = useState<LockoutData>({ attempts: 0, firstAttemptAt: 0, lockedUntil: null });
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const { login } = useAuthStore();
  const { isAvailable: biometricAvailable, enabled: biometricEnabled, enableBiometric } = useBiometricAuth();
  const { hasBeenPrompted } = useBiometricStore();
  const setPrompted = useBiometricStore((s) => s.setPrompted);
  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const { impact } = useHaptics();

  // Load saved email and lockout data on mount
  useEffect(() => {
    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
        const lockoutRaw = await AsyncStorage.getItem(LOCKOUT_STORAGE_KEY);
        if (lockoutRaw) {
          const data: LockoutData = JSON.parse(lockoutRaw);
          // Reset if lockout expired
          if (data.lockedUntil && Date.now() > data.lockedUntil) {
            await AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
          } else {
            setLockoutData(data);
          }
        }
      } catch {}
    })();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutData.lockedUntil) {
      setLockoutTimeLeft(0);
      return;
    }
    const remaining = lockoutData.lockedUntil - Date.now();
    if (remaining <= 0) {
      setLockoutData({ attempts: 0, firstAttemptAt: 0, lockedUntil: null });
      AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
      setLockoutTimeLeft(0);
      return;
    }
    setLockoutTimeLeft(remaining);
    const interval = setInterval(() => {
      const left = (lockoutData.lockedUntil ?? 0) - Date.now();
      if (left <= 0) {
        setLockoutData({ attempts: 0, firstAttemptAt: 0, lockedUntil: null });
        AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
        setLockoutTimeLeft(0);
        clearInterval(interval);
      } else {
        setLockoutTimeLeft(left);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutData.lockedUntil]);

  const isLockedOut = lockoutTimeLeft > 0;
  const attemptsRemaining = MAX_ATTEMPTS - lockoutData.attempts;
  const showWarning = lockoutData.attempts >= WARNING_THRESHOLD && !isLockedOut;

  const recordFailedAttempt = useCallback(async () => {
    const now = Date.now();
    const newAttempts = lockoutData.attempts + 1;
    const newData: LockoutData = {
      attempts: newAttempts,
      firstAttemptAt: lockoutData.firstAttemptAt || now,
      lockedUntil: newAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null,
    };
    setLockoutData(newData);
    await AsyncStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(newData));
  }, [lockoutData]);

  const handleLogin = async () => {
    if (isLockedOut) {
      const mins = Math.ceil(lockoutTimeLeft / 60000);
      showToast('error', t('auth.accountLockedMessage', { minutes: mins }));
      return;
    }

    if (!email || !password) {
      showToast('error', t('auth.fillAllFields'));
      return;
    }

    setLoading(true);
    impact(ImpactFeedbackStyle.Light);
    const { error } = await login(email, password);
    setLoading(false);

    if (error) {
      await recordFailedAttempt();
      showToast('error', error.message);
    } else {
      // Clear lockout on success
      await AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
      // Save or clear remembered email
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      impact(ImpactFeedbackStyle.Medium);

      // Prompt to enable biometric unlock (one-time, native only)
      if (Platform.OS !== 'web' && biometricAvailable && !biometricEnabled && !hasBeenPrompted) {
        await setPrompted();
        Alert.alert(
          t('biometric.promptTitle'),
          t('biometric.promptDescription'),
          [
            { text: t('common.notNow'), style: 'cancel', onPress: () => router.replace('/(app)/dashboard') },
            {
              text: t('biometric.enableButton'),
              onPress: async () => {
                await enableBiometric();
                router.replace('/(app)/dashboard');
              },
            },
          ],
        );
      } else {
        router.replace('/(app)/dashboard');
      }
    }
  };

  const lockoutMinutes = Math.ceil(lockoutTimeLeft / 60000);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Header */}
          <View style={styles.header}>
            <Image source={require('@/assets/icon.png')} style={styles.logoImage} />
            <Text style={[styles.title, { color: colors.text }]}>TaskLine</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.welcomeBack')}</Text>
          </View>

          {/* Lockout Warning */}
          {isLockedOut && (
            <View style={[styles.lockoutBanner, { backgroundColor: colors.errorLight || '#fef2f2' }]}>
              <Ionicons name="lock-closed" size={20} color={colors.error} />
              <Text style={[styles.lockoutText, { color: colors.error }]}>
                {t('auth.accountLockedMessage', { minutes: lockoutMinutes })}
              </Text>
            </View>
          )}

          {/* Attempts Warning */}
          {showWarning && (
            <View style={[styles.warningBanner, { backgroundColor: colors.warningLight || '#fffbeb' }]}>
              <Ionicons name="warning" size={18} color={colors.warning || '#f59e0b'} />
              <Text style={[styles.warningText, { color: colors.warning || '#f59e0b' }]}>
                {t('auth.attemptsWarning', { count: attemptsRemaining })}
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>{t('auth.email')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, isLockedOut && styles.inputDisabled]}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLockedOut}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>{t('auth.password')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, isLockedOut && styles.inputDisabled]}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  editable={!isLockedOut}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me + Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: rememberMe ? colors.primary : colors.border },
                  rememberMe && { backgroundColor: colors.primary },
                ]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.rememberText, { color: colors.textSecondary }]}>{t('auth.rememberMe')}</Text>
              </TouchableOpacity>

              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, (loading || isLockedOut) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || isLockedOut}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.login')}</Text>
              )}
            </TouchableOpacity>

          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('auth.noAccount')} </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: colors.primary }]}>{t('auth.signup')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing['2xl'],
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
  },
  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  lockoutText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  form: {
    marginBottom: Spacing['3xl'],
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: FontSizes.sm,
  },
  forgotPasswordText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  button: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSizes.sm,
  },
  footerLink: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
