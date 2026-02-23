import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { getTutorial } from '@/lib/tutorials';
import { useTutorialStore } from '@/stores/tutorialStore';
import type { TutorialDefinition } from '@/lib/tutorials';

// ── Global listener (same pattern as Toast.tsx) ──

interface TutorialRequest {
  tutorialId: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

let tutorialListener: ((request: TutorialRequest) => void) | null = null;

export function showTutorial(
  tutorialId: string,
  callbacks?: { onComplete?: () => void; onSkip?: () => void },
) {
  tutorialListener?.({
    tutorialId,
    onComplete: callbacks?.onComplete,
    onSkip: callbacks?.onSkip,
  });
}

// ── Provider ──

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<TutorialRequest | null>(null);

  useEffect(() => {
    tutorialListener = (req) => setRequest(req);
    return () => {
      tutorialListener = null;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setRequest(null);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {request && <TutorialSheet request={request} onDismiss={handleDismiss} />}
    </View>
  );
}

// ── Tutorial Sheet ──

interface TutorialSheetProps {
  request: TutorialRequest;
  onDismiss: () => void;
}

function TutorialSheet({ request, onDismiss }: TutorialSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const tutorial = getTutorial(request.tutorialId);
  const [stepIndex, setStepIndex] = useState(0);

  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateOut = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => callback());
    },
    [slideAnim, backdropAnim],
  );

  const triggerHaptic = useCallback(async (type: 'light' | 'success') => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  }, []);

  if (!tutorial) return null;

  const step = tutorial.steps[stepIndex];
  const isLastStep = stepIndex === tutorial.steps.length - 1;
  const totalSteps = tutorial.steps.length;

  const handleNext = () => {
    triggerHaptic('light');
    if (isLastStep) {
      handleComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleComplete = () => {
    triggerHaptic('success');
    useTutorialStore.getState().markComplete(tutorial.id);
    animateOut(() => {
      request.onComplete?.();
      onDismiss();
    });
  };

  const handleSkip = () => {
    useTutorialStore.getState().markComplete(tutorial.id);
    animateOut(() => {
      request.onSkip?.();
      onDismiss();
    });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="auto"
      />
      <Animated.View
        style={[
          styles.sheetContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Step counter */}
          <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>
            {t('tutorials.common.stepOf', {
              current: stepIndex + 1,
              total: totalSteps,
            })}
          </Text>

          {/* Icon */}
          <View
            style={[styles.iconCircle, { backgroundColor: colors.primary }]}
          >
            <Ionicons
              name={step.icon as any}
              size={28}
              color="#FFFFFF"
            />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {t(`${step.keyPrefix}.title`)}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t(`${step.keyPrefix}.description`)}
          </Text>

          {/* Step dots */}
          <View style={styles.dotsRow}>
            {tutorial.steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === stepIndex ? colors.primary : colors.border,
                    width: i === stepIndex ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: colors.border }]}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                {t('tutorials.common.skip')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>
                {isLastStep
                  ? t('tutorials.common.done')
                  : t('tutorials.common.next')}
              </Text>
              {!isLastStep && (
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xl + 20,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  stepCounter: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  nextButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
