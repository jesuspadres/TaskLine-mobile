import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface FilterOption {
  key: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
  scrollable?: boolean;
}

export function FilterChips({
  options,
  selected,
  onSelect,
  style,
  scrollable = false,
}: FilterChipsProps) {
  const { colors } = useTheme();

  const content = (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = selected === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.chip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              isActive && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => onSelect(option.key)}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                isActive && styles.chipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
});
