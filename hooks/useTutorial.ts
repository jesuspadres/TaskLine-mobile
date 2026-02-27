import { useEffect, useRef, useCallback } from 'react';
import { useTutorialStore } from '@/stores/tutorialStore';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getTutorialsForScreen,
  getTierUpgradeTutorials,
  isTierAtLeast,
} from '@/lib/tutorials';
import { showTutorial } from '@/components/TutorialOverlay';
import type { TierSlug } from '@/lib/plans';

const AUTO_TRIGGER_DELAY = 800;

export function useTutorial(screenId: string) {
  const tutorialsEnabled = useTutorialStore((s) => s.tutorialsEnabled);
  const completedTutorials = useTutorialStore((s) => s.completedTutorials);
  const lastKnownTier = useTutorialStore((s) => s.lastKnownTier);
  const hasHydrated = useTutorialStore((s) => s._hasHydrated);
  const markComplete = useTutorialStore((s) => s.markComplete);
  const markTierTutorialComplete = useTutorialStore((s) => s.markTierTutorialComplete);
  const hasTierTutorialCompleted = useTutorialStore((s) => s.hasTierTutorialCompleted);
  const setLastKnownTier = useTutorialStore((s) => s.setLastKnownTier);

  const { tier } = useSubscription();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !tutorialsEnabled || hasTriggered.current) return;

    const currentTier = (tier || 'free') as TierSlug;

    const timer = setTimeout(() => {
      // 1. Check for screen tutorial
      const screenTutorials = getTutorialsForScreen(screenId);
      for (const tutorial of screenTutorials) {
        if (tutorial.minTier && !isTierAtLeast(currentTier, tutorial.minTier)) continue;
        if (completedTutorials[tutorial.id]) continue;

        hasTriggered.current = true;
        showTutorial(tutorial.id);
        return;
      }

      // 2. Check for tier upgrade tutorials
      if (lastKnownTier && lastKnownTier !== currentTier) {
        const upgradeTutorials = getTierUpgradeTutorials(currentTier);
        for (const tutorial of upgradeTutorials) {
          if (hasTierTutorialCompleted(currentTier, tutorial.id)) continue;

          hasTriggered.current = true;
          showTutorial(tutorial.id, {
            onComplete: () => markTierTutorialComplete(currentTier, tutorial.id),
            onSkip: () => markTierTutorialComplete(currentTier, tutorial.id),
          });
          setLastKnownTier(currentTier);
          return;
        }
        setLastKnownTier(currentTier);
      } else if (!lastKnownTier) {
        setLastKnownTier(currentTier);
      }
    }, AUTO_TRIGGER_DELAY);

    return () => clearTimeout(timer);
  }, [screenId, tier, tutorialsEnabled, hasHydrated]);

  const showScreenTutorial = useCallback(() => {
    const tutorials = getTutorialsForScreen(screenId);
    if (tutorials.length > 0) {
      showTutorial(tutorials[0].id);
    }
  }, [screenId]);

  return { showScreenTutorial };
}
