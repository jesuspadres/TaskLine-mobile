import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  /** When true, overrides icon/title/description with an offline message */
  offline?: boolean;
}

export function EmptyState({
  icon = 'document-outline',
  title,
  message,
  description,
  actionLabel,
  onAction,
  style,
  offline,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const { t } = useTranslations();

  const displayIcon = offline ? 'cloud-offline-outline' : icon;
  const displayTitle = offline ? t('common.offlineTitle') : title;
  const displayMessage = offline
    ? t('common.offlineDescription')
    : message || description;

  // Hide action button when offline (can't do anything)
  const showAction = !offline && actionLabel && onAction;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: offline ? colors.warningLight : colors.surfaceSecondary }]}>
        <Ionicons name={displayIcon} size={48} color={offline ? colors.warning : colors.textTertiary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>
      {displayMessage && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {displayMessage}
        </Text>
      )}
      {showAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  button: {
    marginTop: Spacing.xl,
  },
});
