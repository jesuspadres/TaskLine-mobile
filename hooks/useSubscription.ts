import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

/**
 * Hook to access subscription state.
 * Backed by a Zustand store that persists to SecureStore — no re-fetch
 * or "free tier" flash when revisiting screens.
 */
export function useSubscription() {
  const { user } = useAuthStore();
  const store = useSubscriptionStore();

  // If the store hasn't been initialized yet (e.g., deep link), trigger it
  useEffect(() => {
    if (user && !store.initialized) {
      store.initialize(user.id);
    }
  }, [user, store.initialized]);

  return {
    tier: store.tier,
    status: store.status,
    billingPeriod: store.billingPeriod,
    currentPeriodEnd: store.currentPeriodEnd,
    cancelAtPeriodEnd: store.cancelAtPeriodEnd,
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
    refresh: () => user ? store.fetchSubscription(user.id) : Promise.resolve(),
  };
}
