import React, { useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  onPress,
  style,
  variant = 'default',
  padding = 'md',
}: CardProps) {
  const { colors } = useTheme();

  const variantStyles = useMemo(() => ({
    default: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlined: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    elevated: {
      backgroundColor: colors.surface,
      shadowColor: colors.cardShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 3,
    },
  }), [colors]);

  const cardStyles = [
    styles.base,
    variantStyles[variant],
    padding !== 'none' && styles[`padding_${padding}`],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },

  // Padding
  padding_sm: {
    padding: Spacing.sm,
  },
  padding_md: {
    padding: Spacing.lg,
  },
  padding_lg: {
    padding: Spacing.xl,
  },
});
