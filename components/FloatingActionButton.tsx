import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

interface FABAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

interface FloatingActionButtonProps {
  tabBarHeight?: number;
}

export function FloatingActionButton({ tabBarHeight = 92 }: FloatingActionButtonProps) {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    setIsOpen(true);
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  }, [animatedValue]);

  const close = useCallback(() => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  }, [animatedValue]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Swipe-down gesture to dismiss the bottom sheet
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to clear downward swipes
          return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            // Map downward drag to animation (1 = fully open, 0 = closed)
            const progress = 1 - gestureState.dy / 400;
            animatedValue.setValue(Math.max(0, progress));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 100 || gestureState.vy > 0.5) {
            // Swiped down far enough or fast enough — dismiss
            close();
          } else {
            // Spring back to open
            Animated.spring(animatedValue, {
              toValue: 1,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }).start();
          }
        },
      }),
    [animatedValue, close]
  );

  const actions: FABAction[] = useMemo(
    () => [
      {
        id: 'client',
        icon: 'people-outline',
        label: t('fab.newClient'),
        color: colors.info,
        onPress: () => {
          close();
          router.push({ pathname: '/(app)/clients', params: { create: 'true' } } as any);
        },
      },
      {
        id: 'project',
        icon: 'folder-outline',
        label: t('fab.newProject'),
        color: colors.statusNew,
        onPress: () => {
          close();
          router.push({ pathname: '/(app)/projects', params: { create: 'true' } } as any);
        },
      },
      {
        id: 'task',
        icon: 'checkbox-outline',
        label: t('fab.newTask'),
        color: colors.warning,
        onPress: () => {
          close();
          router.push({ pathname: '/(app)/tasks', params: { create: 'true' } } as any);
        },
      },
      {
        id: 'invoice',
        icon: 'document-text-outline',
        label: t('fab.newInvoice'),
        color: colors.success,
        onPress: () => {
          close();
          router.push({ pathname: '/(app)/invoices', params: { create: 'true' } } as any);
        },
      },
    ],
    [colors, t, close, router]
  );

  const fabRotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const overlayOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sheetTranslateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <Animated.View
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              opacity: overlayOpacity,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />

          {/* Bottom Sheet */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {t('fab.createNew')}
            </Text>

            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionItem, { borderBottomColor: colors.borderLight }]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionIconContainer,
                    { backgroundColor: action.color + '20' },
                  ]}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={22}
                    color={action.color}
                  />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>
                  {action.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
              onPress={close}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                {t('fab.cancel')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* FAB Button */}
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: tabBarHeight + Spacing.md,
            backgroundColor: colors.primary,
            ...Shadows.lg,
            transform: [{ rotate: fabRotation }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={toggle}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 10,
    elevation: 8,
  },
  fabTouchable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
