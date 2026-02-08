import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export function Modal({
  visible,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const { colors } = useTheme();
  const isFullScreen = size === 'full';

  return (
    <RNModal
      visible={visible}
      animationType={isFullScreen ? 'slide' : 'fade'}
      transparent={!isFullScreen}
      onRequestClose={onClose}
    >
      {isFullScreen ? (
        <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.fullScreenHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.fullScreenTitle, { color: colors.text }]}>{title}</Text>
            <View style={styles.placeholder} />
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              style={styles.fullScreenContent}
              contentContainerStyle={styles.fullScreenScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      ) : (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <View
                  style={[
                    styles.modalContent,
                    styles[`size_${size}`],
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.header,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonInline}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.body}
                    contentContainerStyle={styles.bodyContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {children}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxHeight: '80%',
  },
  size_sm: {
    maxWidth: 320,
  },
  size_md: {
    maxWidth: 400,
  },
  size_lg: {
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
  },
  closeButtonInline: {
    padding: Spacing.xs,
    marginLeft: Spacing.md,
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    padding: Spacing.lg,
  },

  // Full screen styles
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  fullScreenTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  closeButton: {
    padding: Spacing.sm,
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  fullScreenContent: {
    flex: 1,
  },
  fullScreenScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
});
