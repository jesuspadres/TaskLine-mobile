import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Global toast state
let toastListener: ((toast: ToastMessage) => void) | null = null;

export function showToast(type: ToastType, message: string, duration = 3000) {
  const id = Date.now().toString();
  toastListener?.({ id, type, message, duration });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListener = (toast) => {
      setToasts((prev) => [...prev, toast]);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </View>
    </View>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const iconMap: Record<ToastType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    success: { name: 'checkmark-circle', color: colors.success },
    error: { name: 'close-circle', color: colors.error },
    warning: { name: 'warning', color: colors.warning },
    info: { name: 'information-circle', color: colors.info },
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => dismiss(), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(toast.id));
  };

  const icon = iconMap[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
          shadowColor: colors.cardShadow,
        },
      ]}
    >
      <Ionicons name={icon.name} size={20} color={icon.color} />
      <Text style={[styles.toastText, { color: colors.text }]} numberOfLines={2}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
});
