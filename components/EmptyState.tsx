import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'document-outline',
  title,
  message,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  // Support both "message" and "description" props for compatibility
  const displayMessage = message || description;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={48} color={colors.textTertiary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {displayMessage && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {displayMessage}
        </Text>
      )}
      {actionLabel && onAction && (
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
