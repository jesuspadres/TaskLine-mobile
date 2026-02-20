import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { TierSlug } from '@/lib/plans';

const CACHE_KEY = 'subscription_cache';

interface SubscriptionState {
  tier: TierSlug;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  billingPeriod: 'monthly' | 'annual' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  loading: boolean;
  initialized: boolean;
  isFree: boolean;
  isPro: boolean;
  isPlus: boolean;
  isBusiness: boolean;
  isTrialing: boolean;
  trialEnd: string | null;
  daysRemaining: number | null;
  isFoundingMember: boolean;
  foundingSpotNumber: number | null;
  cardEntered: boolean;
  isTrialEligible: boolean;
}

interface SubscriptionStore extends SubscriptionState {
  initialize: (userId: string) => Promise<void>;
  fetchSubscription: (userId: string) => Promise<void>;
  updateOptimistic: (partial: Partial<SubscriptionState>) => void;
  clear: () => void;
}

function makeTierState(tier: TierSlug): Pick<SubscriptionState, 'isFree' | 'isPro' | 'isPlus' | 'isBusiness'> {
  return {
    isFree: tier === 'free',
    isPro: tier === 'pro',
    isPlus: tier === 'plus',
    isBusiness: tier === 'business',
  };
}

function calcDaysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  status: 'none',
  billingPeriod: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  cancelAt: null,
  loading: true,
  initialized: false,
  isFree: true,
  isPro: false,
  isPlus: false,
  isBusiness: false,
  isTrialing: false,
  trialEnd: null,
  daysRemaining: null,
  isFoundingMember: false,
  foundingSpotNumber: null,
  cardEntered: false,
  isTrialEligible: false,
};

// Persist subscription state to SecureStore
async function saveToCache(state: SubscriptionState): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      const SecureStore = require('expo-secure-store');
      const cacheData = {
        tier: state.tier,
        status: state.status,
        billingPeriod: state.billingPeriod,
        currentPeriodEnd: state.currentPeriodEnd,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        cancelAt: state.cancelAt,
        isTrialing: state.isTrialing,
        trialEnd: state.trialEnd,
        isFoundingMember: state.isFoundingMember,
        foundingSpotNumber: state.foundingSpotNumber,
        cardEntered: state.cardEntered,
      };
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(cacheData));
    }
  } catch {
    // Best-effort caching
  }
}

// Load cached subscription state from SecureStore
async function loadFromCache(): Promise<Partial<SubscriptionState> | null> {
  try {
    if (Platform.OS !== 'web') {
      const SecureStore = require('expo-secure-store');
      const raw = await SecureStore.getItemAsync(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        return {
          ...cached,
          ...makeTierState(cached.tier),
          daysRemaining: calcDaysRemaining(cached.trialEnd),
        };
      }
    }
  } catch {
    // Best-effort
  }
  return null;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...DEFAULT_STATE,

  initialize: async (userId: string) => {
    // Load cached state first for instant display
    const cached = await loadFromCache();
    if (cached && cached.tier) {
      set({
        ...cached as SubscriptionState,
        loading: true, // Still loading fresh data
        initialized: true,
      });
    }

    // Then fetch fresh data
    await get().fetchSubscription(userId);
  },

  fetchSubscription: async (userId: string) => {
    if (!userId) {
      set({ ...DEFAULT_STATE, loading: false, initialized: true });
      return;
    }

    try {
      // 1. Primary: Check the subscriptions table (Stripe-managed)
      // NOTE: 'canceled' is excluded — a fully canceled subscription should not
      // grant tier access. When cancel_at_period_end=true, Stripe keeps status
      // as 'active' until the period ends, so active subs are still found.
      const { data: subscription } = await (supabase
        .from('subscriptions') as any)
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 2. Check founding member status
      let foundingMember: any = null;
      try {
        const { data: fm } = await (supabase
          .from('founding_members') as any)
          .select('spot_number, trial_starts_at, trial_ends_at, card_entered_at')
          .eq('user_id', userId)
          .single();
        foundingMember = fm;
      } catch {
        // founding_members table might not exist or user isn't a founding member
      }

      // 2b. Check trial eligibility: no previous subscriptions and not a founding member
      const { count: prevSubCount } = await (supabase
        .from('subscriptions') as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const isTrialEligible = (prevSubCount ?? 0) === 0 && !foundingMember;

      const foundingInfo = {
        isFoundingMember: !!foundingMember,
        foundingSpotNumber: foundingMember?.spot_number || null,
        cardEntered: !!foundingMember?.card_entered_at,
        isTrialEligible,
      };

      if (subscription?.tier_slug) {
        const tierSlug = (subscription.tier_slug as TierSlug) || 'free';
        const billingInterval = subscription.billing_interval;
        const isTrialing = subscription.status === 'trialing';
        const trialEnd = subscription.trial_end || foundingMember?.trial_ends_at || null;
        // cancel_at_period_end OR cancel_at means the subscription is scheduled to cancel
        const willCancel = subscription.cancel_at_period_end || !!subscription.cancel_at;

        const newState: SubscriptionState = {
          tier: tierSlug,
          status: subscription.status || 'none',
          billingPeriod: billingInterval === 'year' ? 'annual' : billingInterval === 'month' ? 'monthly' : null,
          currentPeriodEnd: subscription.current_period_end || null,
          cancelAtPeriodEnd: willCancel,
          cancelAt: subscription.cancel_at || null,
          loading: false,
          initialized: true,
          ...makeTierState(tierSlug),
          isTrialing,
          trialEnd,
          daysRemaining: calcDaysRemaining(trialEnd),
          ...foundingInfo,
        };
        set(newState);
        saveToCache(newState);
        return;
      }

      // 3. Fallback: Check user_tiers table
      const { data: userTier } = await (supabase
        .from('user_tiers') as any)
        .select(`tier:tiers(name, slug, features)`)
        .eq('user_id', userId)
        .single();

      if (userTier?.tier) {
        const tierSlug = (userTier.tier.slug as TierSlug) || 'free';
        const trialEnd = foundingMember?.trial_ends_at || null;
        const newState: SubscriptionState = {
          tier: tierSlug,
          status: 'active',
          billingPeriod: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          cancelAt: null,
          loading: false,
          initialized: true,
          ...makeTierState(tierSlug),
          isTrialing: false,
          trialEnd,
          daysRemaining: calcDaysRemaining(trialEnd),
          ...foundingInfo,
        };
        set(newState);
        saveToCache(newState);
        return;
      }

      // 4. No subscription — check if founding member on trial
      if (foundingMember && foundingMember.trial_ends_at) {
        const trialEnd = foundingMember.trial_ends_at;
        const daysRemaining = calcDaysRemaining(trialEnd);
        const isExpired = daysRemaining !== null && daysRemaining <= 0;

        const newState: SubscriptionState = {
          tier: isExpired ? 'free' : 'plus',
          status: isExpired ? 'none' : 'trialing',
          billingPeriod: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          cancelAt: null,
          loading: false,
          initialized: true,
          ...makeTierState(isExpired ? 'free' : 'plus'),
          isTrialing: !isExpired,
          trialEnd,
          daysRemaining,
          ...foundingInfo,
        };
        set(newState);
        saveToCache(newState);
        return;
      }

      // 5. Default: Free tier
      const freeState: SubscriptionState = {
        ...DEFAULT_STATE,
        loading: false,
        initialized: true,
        ...foundingInfo,
      };
      set(freeState);
      saveToCache(freeState);
    } catch {
      set((prev) => ({ ...prev, loading: false, initialized: true }));
    }
  },

  updateOptimistic: (partial: Partial<SubscriptionState>) => {
    set((prev) => {
      const updated = { ...prev, ...partial };
      saveToCache(updated);
      return updated;
    });
  },

  clear: () => {
    set({ ...DEFAULT_STATE, loading: false, initialized: false });
    try {
      if (Platform.OS !== 'web') {
        const SecureStore = require('expo-secure-store');
        SecureStore.deleteItemAsync(CACHE_KEY);
      }
    } catch {
      // Best-effort
    }
  },
}));
