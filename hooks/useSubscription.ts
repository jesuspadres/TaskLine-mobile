import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

/**
 * Hook to access subscription state.
 * Backed by a Zustand store that persists to SecureStore — no re-fetch
 * or "free tier" flash when revisiting screens.
 * Re-fetches automatically when the app returns to the foreground.
 */
export function useSubscription() {
  const { user } = useAuthStore();
  const store = useSubscriptionStore();
  const appState = useRef(AppState.currentState);

  // If the store hasn't been initialized yet (e.g., deep link), trigger it
  useEffect(() => {
    if (user && !store.initialized) {
      store.initialize(user.id);
    }
  }, [user, store.initialized]);

  // Re-fetch when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && user) {
        store.fetchSubscription(user.id);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [user]);

  return {
    tier: store.tier,
    status: store.status,
    billingPeriod: store.billingPeriod,
    currentPeriodEnd: store.currentPeriodEnd,
    cancelAtPeriodEnd: store.cancelAtPeriodEnd,
    cancelAt: store.cancelAt,
    loading: store.loading,
    isFree: store.isFree,
    isPro: store.isPro,
    isPlus: store.isPlus,
    isBusiness: store.isBusiness,
    isTrialing: store.isTrialing,
    trialEnd: store.trialEnd,
    daysRemaining: store.daysRemaining,
    isFoundingMember: store.isFoundingMember,
    foundingSpotNumber: store.foundingSpotNumber,
    cardEntered: store.cardEntered,
    isTrialEligible: store.isTrialEligible,
    refresh: () => user ? store.fetchSubscription(user.id) : Promise.resolve(),
    updateOptimistic: store.updateOptimistic,
  };
}
