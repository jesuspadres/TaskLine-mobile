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
}

function makeTierState(tier: TierSlug): Pick<SubscriptionState, 'isFree' | 'isPro' | 'isPlus' | 'isBusiness'> {
  return {
    isFree: tier === 'free',
    isPro: tier === 'pro',
    isPlus: tier === 'plus',
    isBusiness: tier === 'business',
  };
}

export function useSubscription() {
  const { user } = useAuthStore();
  const [state, setState] = useState<SubscriptionState>({
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
  });

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      // 1. Primary: Check the subscriptions table (Stripe-managed subscriptions)
      //    Join with tiers table to get the tier slug
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

      if (subscription?.tier) {
        const tierSlug = (subscription.tier.slug as TierSlug) || 'free';
        const billingInterval = subscription.billing_interval;
        setState({
          tier: tierSlug,
          status: subscription.status || 'none',
          billingPeriod: billingInterval === 'year' ? 'annual' : billingInterval === 'month' ? 'monthly' : null,
          currentPeriodEnd: subscription.current_period_end || null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          loading: false,
          ...makeTierState(tierSlug),
        });
        return;
      }

      // 2. Fallback: Check user_tiers table (lifetime/founding member users)
      const { data: userTier } = await (supabase
        .from('user_tiers') as any)
        .select(`
          tier:tiers(name, slug, features)
        `)
        .eq('user_id', user.id)
        .single();

      if (userTier?.tier) {
        const tierSlug = (userTier.tier.slug as TierSlug) || 'free';
        setState({
          tier: tierSlug,
          status: 'active',
          billingPeriod: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          loading: false,
          ...makeTierState(tierSlug),
        });
        return;
      }

      // 3. Default: Free tier
      setState({
        tier: 'free',
        status: 'none',
        billingPeriod: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        loading: false,
        ...makeTierState('free'),
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
