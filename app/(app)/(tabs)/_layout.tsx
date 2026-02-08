import { useState, useRef, useCallback, useMemo } from 'react';
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
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useNavigationBadges } from '@/hooks/useNavigationBadges';
import { useTranslations } from '@/hooks/useTranslations';
import { FloatingActionButton } from '@/components';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

const TAB_BAR_HEIGHT = 92;

interface MoreItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

export default function TabsLayout() {
  const { counts } = useNavigationBadges();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const moreItems: MoreItem[] = useMemo(
    () => [
      {
        id: 'projects',
        icon: 'folder-outline',
        label: t('projects.title'),
        route: '/(app)/projects',
        badge: counts.projects,
      },
      {
        id: 'tasks',
        icon: 'checkbox-outline',
        label: t('tasks.title'),
        route: '/(app)/tasks',
        badge: counts.tasks,
      },
      {
        id: 'invoices',
        icon: 'document-text-outline',
        label: t('invoices.title'),
        route: '/(app)/invoices',
      },
      {
        id: 'properties',
        icon: 'home-outline',
        label: t('properties.title'),
        route: '/(app)/properties',
      },
      {
        id: 'settings',
        icon: 'settings-outline',
        label: t('settings.title'),
        route: '/(app)/settings',
      },
    ],
    [t, counts.projects, counts.tasks]
  );

  const expand = useCallback(() => {
    setIsExpanded(true);
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, [animatedValue]);

  const collapse = useCallback(() => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsExpanded(false));
  }, [animatedValue]);

  const toggle = useCallback(() => {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }, [isExpanded, expand, collapse]);

  const handleItemPress = useCallback(
    (route: string) => {
      collapse();
      setTimeout(() => {
        router.push(route as any);
      }, 100);
    },
    [collapse, router]
  );

  // Close panel when other tabs are tapped
  const dismissListener = useMemo(
    () => ({
      tabPress: () => {
        if (isExpanded) collapse();
      },
    }),
    [isExpanded, collapse]
  );

  // Swipe-down gesture to dismiss the panel
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            gestureState.dy > 8 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            const progress = 1 - gestureState.dy / 300;
            animatedValue.setValue(Math.max(0, progress));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            collapse();
          } else {
            Animated.spring(animatedValue, {
              toValue: 1,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          }
        },
      }),
    [animatedValue, collapse]
  );

  // Panel slide-up
  const panelTranslateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // Overlay fade
  const overlayOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Stagger each item's entrance
  const getItemStyle = useCallback(
    (index: number) => {
      const start = index * 0.1;
      const end = Math.min(start + 0.4, 1);

      const opacity = animatedValue.interpolate({
        inputRange: [start, end],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      const translateY = animatedValue.interpolate({
        inputRange: [start, end],
        outputRange: [16, 0],
        extrapolate: 'clamp',
      });

      return {
        opacity,
        transform: [{ translateY }],
      };
    },
    [animatedValue]
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 32,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
          listeners={dismissListener}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            title: t('tabs.jobs'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase-outline" size={size} color={color} />
            ),
            tabBarBadge: counts.requests > 0 ? counts.requests : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.statusNew,
              fontSize: 10,
              minWidth: 18,
              height: 18,
              lineHeight: 18,
            },
          }}
          listeners={dismissListener}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: t('tabs.clients'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
          listeners={dismissListener}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('tabs.calendar'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
          listeners={dismissListener}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('tabs.more'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={
                  isExpanded
                    ? 'close-circle-outline'
                    : 'ellipsis-horizontal-circle-outline'
                }
                size={size}
                color={isExpanded ? colors.primary : color}
              />
            ),
            tabBarBadge:
              !isExpanded && counts.notifications > 0
                ? counts.notifications
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.error,
              fontSize: 10,
              minWidth: 18,
              height: 18,
              lineHeight: 18,
            },
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              toggle();
            },
          }}
        />
      </Tabs>

      {/* Overlay — covers screen above tab bar */}
      {isExpanded && (
        <Animated.View
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              opacity: overlayOpacity,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={collapse} />
        </Animated.View>
      )}

      {/* Expanding panel — slides up from tab bar */}
      {isExpanded && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />
          {moreItems.map((item, index) => {
            const hasBadge = item.badge !== undefined && item.badge > 0;

            return (
              <Animated.View key={item.id} style={getItemStyle(index)}>
                <TouchableOpacity
                  style={[
                    styles.panelItem,
                    index < moreItems.length - 1 && {
                      borderBottomColor: colors.borderLight,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => handleItemPress(item.route)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.panelIconContainer,
                      { backgroundColor: colors.infoLight },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.panelLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  {hasBadge ? (
                    <View
                      style={[styles.badge, { backgroundColor: colors.error }]}
                    >
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}

      <FloatingActionButton />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    zIndex: 15,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingBottom: Spacing.sm,
    zIndex: 16,
    ...Shadows.lg,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  panelIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  panelLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
});
