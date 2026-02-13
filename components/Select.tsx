import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
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
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function Select({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onChange,
  error,
  containerStyle,
  searchable = false,
  searchPlaceholder = 'Search...',
}: SelectProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((opt) => opt.key === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchQuery, searchable]);

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

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
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View
            style={[styles.dropdown, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={[
                styles.dropdownHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                {label || 'Select'}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {searchable && (
              <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderBottomColor: colors.borderLight },
                    item.key === value && { backgroundColor: colors.infoLight },
                  ]}
                  onPress={() => {
                    onChange(item.key);
                    handleClose();
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
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    No results found
                  </Text>
                </View>
              }
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.sm,
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
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSizes.sm,
  },
});
