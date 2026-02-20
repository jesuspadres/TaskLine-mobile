import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FontSizes, BorderRadius, Spacing } from '@/constants/theme';

interface LoadingState {
  visible: boolean;
  message?: string;
}

// Global loading state listener (same pattern as Toast)
let loadingListener: ((state: LoadingState) => void) | null = null;

export function showLoading(message?: string) {
  loadingListener?.({ visible: true, message });
}

export function hideLoading() {
  loadingListener?.({ visible: false });
}

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadingState>({ visible: false });
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadingListener = (newState) => {
      setState(newState);
    };
    return () => {
      loadingListener = null;
    };
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: state.visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [state.visible]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {state.visible && (
        <Animated.View
          style={[styles.overlay, { opacity }]}
          pointerEvents="auto"
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            {state.message ? (
              <Text style={[styles.message, { color: colors.text }]}>
                {state.message}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  card: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.lg,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
});
