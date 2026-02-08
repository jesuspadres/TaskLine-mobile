import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface SelectOption {
  key: string;
  label: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Select({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onChange,
  error,
  containerStyle,
}: SelectProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.key === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.selectButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          error && { borderColor: colors.error },
        ]}
        onPress={() => setIsOpen(true)}
      >
        <Text
          style={[
            styles.selectText,
            { color: colors.text },
            !selectedOption && { color: colors.textTertiary },
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.textTertiary}
        />
      </TouchableOpacity>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={[styles.dropdown, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.dropdownHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                {label || 'Select'}
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderBottomColor: colors.borderLight },
                    item.key === value && { backgroundColor: colors.infoLight },
                  ]}
                  onPress={() => {
                    onChange(item.key);
                    setIsOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.text },
                      item.key === value && {
                        color: colors.primary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.key === value && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  selectText: {
    fontSize: FontSizes.md,
    flex: 1,
  },
  error: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  dropdown: {
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '60%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: FontSizes.md,
  },
});
