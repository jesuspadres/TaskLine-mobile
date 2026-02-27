import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TierSlug } from '@/lib/plans';

interface TutorialState {
  completedTutorials: Record<string, boolean>;
  completedTierTutorials: Record<string, string[]>;
  tutorialsEnabled: boolean;
  lastKnownTier: TierSlug | null;
  _hasHydrated: boolean;

  markComplete: (tutorialId: string) => void;
  markTierTutorialComplete: (tier: string, tutorialId: string) => void;
  hasCompleted: (tutorialId: string) => boolean;
  hasTierTutorialCompleted: (tier: string, tutorialId: string) => boolean;
  resetTutorial: (tutorialId: string) => void;
  resetAll: () => void;
  setEnabled: (enabled: boolean) => void;
  setLastKnownTier: (tier: TierSlug) => void;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      completedTutorials: {},
      completedTierTutorials: {},
      tutorialsEnabled: true,
      lastKnownTier: null,
      _hasHydrated: false,

      markComplete: (tutorialId: string) => {
        set((state) => ({
          completedTutorials: { ...state.completedTutorials, [tutorialId]: true },
        }));
      },

      markTierTutorialComplete: (tier: string, tutorialId: string) => {
        set((state) => {
          const existing = state.completedTierTutorials[tier] || [];
          if (existing.includes(tutorialId)) return state;
          return {
            completedTierTutorials: {
              ...state.completedTierTutorials,
              [tier]: [...existing, tutorialId],
            },
          };
        });
      },

      hasCompleted: (tutorialId: string) => {
        return !!get().completedTutorials[tutorialId];
      },

      hasTierTutorialCompleted: (tier: string, tutorialId: string) => {
        return (get().completedTierTutorials[tier] || []).includes(tutorialId);
      },

      resetTutorial: (tutorialId: string) => {
        set((state) => {
          const updated = { ...state.completedTutorials };
          delete updated[tutorialId];
          return { completedTutorials: updated };
        });
      },

      resetAll: () => {
        set({ completedTutorials: {}, completedTierTutorials: {} });
      },

      setEnabled: (enabled: boolean) => {
        set({ tutorialsEnabled: enabled });
      },

      setLastKnownTier: (tier: TierSlug) => {
        set({ lastKnownTier: tier });
      },
    }),
    {
      name: 'taskline-tutorial-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedTutorials: state.completedTutorials,
        completedTierTutorials: state.completedTierTutorials,
        tutorialsEnabled: state.tutorialsEnabled,
        lastKnownTier: state.lastKnownTier,
      }),
      onRehydrateStorage: () => () => {
        useTutorialStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
