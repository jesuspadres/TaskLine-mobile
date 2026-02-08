import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSizes, BorderRadius, type ThemeColors } from '@/constants/theme';

type StatusType =
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
  | 'overdue'
  | 'confirmed';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

function getStatusColors(status: string, colors: ThemeColors): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
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
    confirmed: { bg: colors.successLight, text: colors.success },
  };

  return map[status.toLowerCase()] || { bg: colors.surfaceSecondary, text: colors.textSecondary };
}

export function StatusBadge({ status, size = 'sm', style }: StatusBadgeProps) {
  const { colors } = useTheme();
  const statusColors = useMemo(() => getStatusColors(status, colors), [status, colors]);

  const displayText = status.replace(/_/g, ' ');

  return (
    <View
      style={[
        styles.base,
        size === 'md' ? styles.sizeMd : styles.sizeSm,
        { backgroundColor: statusColors.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'md' ? styles.textMd : styles.textSm,
          { color: statusColors.text },
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  sizeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sizeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  textSm: {
    fontSize: FontSizes.xs,
  },
  textMd: {
    fontSize: FontSizes.sm,
  },
});
