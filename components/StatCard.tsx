import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  subtitleColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  tintColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  subtitle,
  subtitleColor,
  icon,
  iconColor,
  tintColor,
  onPress,
  style,
}: StatCardProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        tintColor ? { borderLeftWidth: 3, borderLeftColor: tintColor } : undefined,
        Shadows.sm,
        style,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {icon && (
          <Ionicons name={icon} size={18} color={iconColor || colors.textTertiary} />
        )}
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {subtitle && (
        <Text
          style={[styles.subtitle, { color: subtitleColor || colors.textTertiary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
});
