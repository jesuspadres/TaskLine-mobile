import { useState } from 'react';
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
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="mail" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Check your email</Text>
          <Text style={[styles.successText, { color: colors.textSecondary }]}>
            We've sent a password reset link to{'\n'}
            <Text style={[styles.emailText, { color: colors.text }]}>{email}</Text>
          </Text>
          <Text style={[styles.helpText, { color: colors.textTertiary }]}>
            Didn't receive the email? Check your spam folder or try again with a different email.
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

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
          {/* Back Button */}
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface }]}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </Link>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="key-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>Remember your password? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: Spacing['3xl'],
  },
  inputGroup: {
    marginBottom: Spacing.xl,
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
  // Success state
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
  },
  helpText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
    lineHeight: 20,
  },
});
