import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

export function BiometricLockScreen() {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { notification } = useHaptics();
  const { authenticate, biometricType } = useBiometricAuth();
  const logout = useAuthStore((s) => s.logout);

  const icon = biometricType === 'faceid' ? 'scan-outline' : 'finger-print';

  const unlockLabel =
    biometricType === 'faceid'
      ? t('biometric.unlockWithFaceId')
      : biometricType === 'fingerprint'
        ? t('biometric.unlockWithFingerprint')
        : t('biometric.unlockWithBiometrics');

  const handleUnlock = async () => {
    const success = await authenticate();
    if (success && Platform.OS !== 'web') {
      notification(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleUsePassword = async () => {
    await logout();
  };

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Ionicons name={icon as any} size={64} color={colors.primary} style={styles.icon} />

        <Text style={[styles.title, { color: colors.text }]}>
          {t('biometric.unlockTitle')}
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {unlockLabel}
        </Text>

        <TouchableOpacity
          style={[styles.unlockButton, { backgroundColor: colors.primary }]}
          onPress={handleUnlock}
          activeOpacity={0.8}
        >
          <Ionicons name={icon as any} size={22} color="#fff" />
          <Text style={styles.unlockButtonText}>{t('biometric.unlockButton')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleUsePassword} style={styles.passwordLink}>
          <Text style={[styles.passwordLinkText, { color: colors.textSecondary }]}>
            {t('biometric.usePassword')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.lg,
  },
  icon: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.md,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  passwordLink: {
    paddingVertical: Spacing.sm,
  },
  passwordLinkText: {
    fontSize: FontSizes.sm,
  },
});
