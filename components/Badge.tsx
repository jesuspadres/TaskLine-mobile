import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'new'
  | 'reviewing'
  | 'converted'
  | 'declined'
  | 'active'
  | 'completed'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'todo'
  | 'in_progress'
  | 'on_hold'
  | 'cancelled'
  | 'sent'
  | 'paid'
  | 'overdue';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ text, variant = 'default', size = 'sm', style }: BadgeProps) {
  const { colors } = useTheme();

  const variantColors = useMemo(() => ({
    default: { bg: colors.surfaceSecondary, text: colors.textSecondary },
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    error: { bg: colors.errorLight, text: colors.error },
    info: { bg: colors.infoLight, text: colors.info },
    new: { bg: colors.statusNewLight, text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.statusReviewing },
    converted: { bg: colors.successLight, text: colors.statusConverted },
    declined: { bg: colors.surfaceSecondary, text: colors.statusDeclined },
    active: { bg: colors.infoLight, text: colors.statusActive },
    completed: { bg: colors.successLight, text: colors.statusCompleted },
    pending: { bg: colors.warningLight, text: colors.statusPending },
    approved: { bg: colors.successLight, text: colors.statusApproved },
    rejected: { bg: colors.errorLight, text: colors.statusRejected },
    draft: { bg: colors.surfaceSecondary, text: colors.statusDraft },
    todo: { bg: colors.surfaceSecondary, text: colors.textSecondary },
    in_progress: { bg: colors.infoLight, text: colors.info },
    on_hold: { bg: colors.warningLight, text: colors.warning },
    cancelled: { bg: colors.surfaceSecondary, text: colors.textTertiary },
    sent: { bg: colors.infoLight, text: colors.info },
    paid: { bg: colors.successLight, text: colors.success },
    overdue: { bg: colors.errorLight, text: colors.error },
  }), [colors]);

  const badgeColors = variantColors[variant] || variantColors.default;

  return (
    <View
      style={[
        styles.base,
        styles[`size_${size}`],
        { backgroundColor: badgeColors.bg },
        style,
      ]}
    >
      <Text style={[styles.text, styles[`text_${size}`], { color: badgeColors.text }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  size_sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  size_md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  text_sm: {
    fontSize: FontSizes.xs,
  },
  text_md: {
    fontSize: FontSizes.sm,
  },
});
