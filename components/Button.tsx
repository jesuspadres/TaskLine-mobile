import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const variantStyles = useMemo(() => ({
    primary: { backgroundColor: colors.primary },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    danger: { backgroundColor: colors.error },
    ghost: { backgroundColor: 'transparent' },
  }), [colors]);

  const textVariantStyles = useMemo(() => ({
    primary: { color: '#fff' },
    secondary: { color: colors.text },
    danger: { color: '#fff' },
    ghost: { color: colors.primary },
  }), [colors]);

  const buttonStyles = [
    styles.base,
    variantStyles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    textVariantStyles[variant],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Sizes
  size_sm: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
  },
  size_lg: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 52,
  },

  // Text
  text: {
    fontWeight: '600',
  },
  text_sm: {
    fontSize: FontSizes.sm,
  },
  text_md: {
    fontSize: FontSizes.md,
  },
  text_lg: {
    fontSize: FontSizes.lg,
  },
  textDisabled: {
    opacity: 0.7,
  },
});
