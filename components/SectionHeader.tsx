import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSizes } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  icon,
  iconColor,
  count,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon && (
          <Ionicons name={icon} size={18} color={iconColor || colors.primary} />
        )}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primaryLight + '20' }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{count}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.action}>
          <Text style={[styles.actionText, { color: colors.primary }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
