import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { TierSlug } from '@/lib/plans';

interface SubscriptionState {
  tier: TierSlug;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  billingPeriod: 'monthly' | 'annual' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  isFree: boolean;
  isPro: boolean;
  isPlus: boolean;
  isBusiness: boolean;
  // Trial info
  isTrialing: boolean;
  trialEnd: string | null;
  daysRemaining: number | null;
  // Founding member info
  isFoundingMember: boolean;
  foundingSpotNumber: number | null;
  cardEntered: boolean;
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
  loading: true,
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
};

export function useSubscription() {
  const { user } = useAuthStore();
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      // 1. Primary: Check the subscriptions table (Stripe-managed subscriptions)
      const { data: subscription } = await (supabase
        .from('subscriptions') as any)
        .select(`
          *,
          tier:tiers(name, slug, features, price_monthly, price_annual)
        `)
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing', 'past_due', 'canceled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 2. Check founding member status (parallel-safe, separate query)
      let foundingMember: any = null;
      try {
        const { data: fm } = await (supabase
          .from('founding_members') as any)
          .select('spot_number, trial_starts_at, trial_ends_at, card_entered_at')
          .eq('user_id', user.id)
          .single();
        foundingMember = fm;
      } catch {
        // founding_members table might not exist or user isn't a founding member
      }

      const foundingInfo = {
        isFoundingMember: !!foundingMember,
        foundingSpotNumber: foundingMember?.spot_number || null,
        cardEntered: !!foundingMember?.card_entered_at,
      };

      if (subscription?.tier) {
        const tierSlug = (subscription.tier.slug as TierSlug) || 'free';
        const billingInterval = subscription.billing_interval;
        const isTrialing = subscription.status === 'trialing';
        const trialEnd = subscription.trial_end || foundingMember?.trial_ends_at || null;

        setState({
          tier: tierSlug,
          status: subscription.status || 'none',
          billingPeriod: billingInterval === 'year' ? 'annual' : billingInterval === 'month' ? 'monthly' : null,
          currentPeriodEnd: subscription.current_period_end || null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          loading: false,
          ...makeTierState(tierSlug),
          isTrialing,
          trialEnd,
          daysRemaining: calcDaysRemaining(trialEnd),
          ...foundingInfo,
        });
        return;
      }

      // 3. Fallback: Check user_tiers table (lifetime/founding member users)
      const { data: userTier } = await (supabase
        .from('user_tiers') as any)
        .select(`
          tier:tiers(name, slug, features)
        `)
        .eq('user_id', user.id)
        .single();

      if (userTier?.tier) {
        const tierSlug = (userTier.tier.slug as TierSlug) || 'free';
        const trialEnd = foundingMember?.trial_ends_at || null;
        setState({
          tier: tierSlug,
          status: 'active',
          billingPeriod: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          loading: false,
          ...makeTierState(tierSlug),
          isTrialing: false,
          trialEnd,
          daysRemaining: calcDaysRemaining(trialEnd),
          ...foundingInfo,
        });
        return;
      }

      // 4. No subscription — check if founding member on trial (no Stripe sub yet)
      if (foundingMember && foundingMember.trial_ends_at) {
        const trialEnd = foundingMember.trial_ends_at;
        const daysRemaining = calcDaysRemaining(trialEnd);
        const isExpired = daysRemaining !== null && daysRemaining <= 0;

        setState({
          tier: isExpired ? 'free' : 'plus',
          status: isExpired ? 'none' : 'trialing',
          billingPeriod: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          loading: false,
          ...makeTierState(isExpired ? 'free' : 'plus'),
          isTrialing: !isExpired,
          trialEnd,
          daysRemaining,
          ...foundingInfo,
        });
        return;
      }

      // 5. Default: Free tier
      setState({
        ...DEFAULT_STATE,
        loading: false,
        ...foundingInfo,
      });
    } catch {
      // If tables don't exist or query fails, default to free
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    ...state,
    refresh: fetchSubscription,
  };
}
