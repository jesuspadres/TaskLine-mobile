import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius, Spacing } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width = '100%', height = 16, borderRadius = BorderRadius.md, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.surfaceSecondary,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <SkeletonBox width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <SkeletonBox width="60%" height={14} />
          <SkeletonBox width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBox width="80%" height={12} style={{ marginTop: Spacing.md }} />
      <SkeletonBox width="50%" height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export function StatsSkeleton() {
  return (
    <View style={styles.statsRow}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={styles.statBox}>
          <SkeletonBox width="50%" height={12} />
          <SkeletonBox width="70%" height={24} style={{ marginTop: 8 }} />
          <SkeletonBox width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export { SkeletonBox };

// Re-export for convenience alias
export const LoadingSkeleton = SkeletonBox;

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  statBox: {
    flex: 1,
    padding: Spacing.md,
  },
});
