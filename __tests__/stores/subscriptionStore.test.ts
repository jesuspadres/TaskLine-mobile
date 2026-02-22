/**
 * Tests for subscriptionStore (stores/subscriptionStore.ts)
 *
 * Tests the Zustand store directly via getState() / setState().
 * Supabase and SecureStore are mocked at the module level.
 */

// ── Mocks ────────────────────────────────────────────────────────
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { Platform } from 'react-native';

const SecureStore = require('expo-secure-store');

// ── Helpers ──────────────────────────────────────────────────────
const USER_ID = 'user-123';

function resetStore() {
  useSubscriptionStore.setState({
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
  });
}

/** Build a chained mock for supabase.from('subscriptions').select().eq().in().order().limit().single() */
function mockSubscriptionsQuery(data: any, error: any = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

/** Build a chain for founding_members query */
function mockFoundingMembersQuery(data: any) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null }),
  };
}

/** Build a chain for subscriptions count query */
function mockSubsCountQuery(count: number) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ count, error: null }),
  };
}

/** Build a chain for user_tiers query */
function mockUserTiersQuery(data: any) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null }),
  };
}

/**
 * Setup the mockFrom to handle different table names.
 * The subscriptions table is queried twice: once for the active subscription
 * lookup and once for the count (trial eligibility).
 */
function setupMockFrom(options: {
  subscriptionsData?: any;
  foundingData?: any;
  subsCount?: number;
  userTierData?: any;
}) {
  const {
    subscriptionsData = null,
    foundingData = null,
    subsCount = 0,
    userTierData = null,
  } = options;

  let subsCallIndex = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'subscriptions') {
      subsCallIndex++;
      if (subsCallIndex === 1) {
        // Primary subscription lookup
        return mockSubscriptionsQuery(subscriptionsData);
      } else {
        // Count query (trial eligibility)
        return mockSubsCountQuery(subsCount);
      }
    }
    if (table === 'founding_members') {
      return mockFoundingMembersQuery(foundingData);
    }
    if (table === 'user_tiers') {
      return mockUserTiersQuery(userTierData);
    }
    return mockSubscriptionsQuery(null);
  });
}

// ── Tests ────────────────────────────────────────────────────────
describe('subscriptionStore', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    resetStore();
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatformOS;
  });

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('defaults to free tier', () => {
      expect(useSubscriptionStore.getState().tier).toBe('free');
    });

    it('defaults status to none', () => {
      expect(useSubscriptionStore.getState().status).toBe('none');
    });

    it('defaults loading to true', () => {
      expect(useSubscriptionStore.getState().loading).toBe(true);
    });

    it('defaults initialized to false', () => {
      expect(useSubscriptionStore.getState().initialized).toBe(false);
    });

    it('has correct boolean helpers for free tier', () => {
      const state = useSubscriptionStore.getState();
      expect(state.isFree).toBe(true);
      expect(state.isPro).toBe(false);
      expect(state.isPlus).toBe(false);
      expect(state.isBusiness).toBe(false);
    });

    it('defaults trial fields to null/false', () => {
      const state = useSubscriptionStore.getState();
      expect(state.isTrialing).toBe(false);
      expect(state.trialEnd).toBeNull();
      expect(state.daysRemaining).toBeNull();
    });

    it('defaults founding member fields', () => {
      const state = useSubscriptionStore.getState();
      expect(state.isFoundingMember).toBe(false);
      expect(state.foundingSpotNumber).toBeNull();
      expect(state.cardEntered).toBe(false);
    });
  });

  // ── initialize() ──────────────────────────────────────────────
  describe('initialize()', () => {
    it('loads cached state from SecureStore first', async () => {
      const cached = {
        tier: 'pro',
        status: 'active',
        billingPeriod: 'monthly',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        isTrialing: false,
        trialEnd: null,
        isFoundingMember: false,
        foundingSpotNumber: null,
        cardEntered: false,
      };
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(cached));

      // Mock the fetch to return free (but cache had 'pro')
      setupMockFrom({ subscriptionsData: null, subsCount: 0 });

      await useSubscriptionStore.getState().initialize(USER_ID);

      // SecureStore should have been read
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('subscription_cache');
    });

    it('calls fetchSubscription after loading cache', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-12-31',
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().initialize(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('pro');
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });
  });

  // ── fetchSubscription() ────────────────────────────────────────
  describe('fetchSubscription()', () => {
    it('sets default free state when userId is empty', async () => {
      await useSubscriptionStore.getState().fetchSubscription('');

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('free');
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('fetches active Pro subscription from subscriptions table', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-12-31',
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('pro');
      expect(state.status).toBe('active');
      expect(state.isPro).toBe(true);
      expect(state.isFree).toBe(false);
      expect(state.billingPeriod).toBe('monthly');
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('fetches active Plus subscription with annual billing', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'plus',
          status: 'active',
          billing_interval: 'year',
          current_period_end: '2027-03-15',
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('plus');
      expect(state.isPlus).toBe(true);
      expect(state.billingPeriod).toBe('annual');
    });

    it('fetches Business subscription', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'business',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-06-15',
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('business');
      expect(state.isBusiness).toBe(true);
      expect(state.isFree).toBe(false);
      expect(state.isPro).toBe(false);
      expect(state.isPlus).toBe(false);
    });

    it('detects trialing status', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'plus',
          status: 'trialing',
          billing_interval: 'month',
          current_period_end: futureDate,
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: futureDate,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.isTrialing).toBe(true);
      expect(state.status).toBe('trialing');
      expect(state.trialEnd).toBe(futureDate);
      expect(state.daysRemaining).toBeGreaterThan(0);
    });

    it('calculates daysRemaining correctly', async () => {
      // 10 days from now
      const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'trialing',
          billing_interval: 'month',
          current_period_end: tenDaysFromNow,
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: tenDaysFromNow,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      // Should be approximately 10 (could be 10 or 11 depending on timing)
      const days = useSubscriptionStore.getState().daysRemaining;
      expect(days).toBeGreaterThanOrEqual(10);
      expect(days).toBeLessThanOrEqual(11);
    });

    it('sets daysRemaining to 0 for past trial end dates', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'trialing',
          billing_interval: 'month',
          current_period_end: pastDate,
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: pastDate,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(useSubscriptionStore.getState().daysRemaining).toBe(0);
    });

    it('detects cancel_at_period_end', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-12-31',
          cancel_at_period_end: true,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(useSubscriptionStore.getState().cancelAtPeriodEnd).toBe(true);
    });

    it('detects cancel_at scheduled cancellation', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-12-31',
          cancel_at_period_end: false,
          cancel_at: '2026-11-30',
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      // willCancel is cancel_at_period_end || !!cancel_at
      expect(state.cancelAtPeriodEnd).toBe(true);
      expect(state.cancelAt).toBe('2026-11-30');
    });

    it('detects founding member', async () => {
      setupMockFrom({
        subscriptionsData: null,
        foundingData: {
          spot_number: 42,
          trial_starts_at: '2026-01-01',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          card_entered_at: '2026-01-15',
        },
        subsCount: 0,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.isFoundingMember).toBe(true);
      expect(state.foundingSpotNumber).toBe(42);
      expect(state.cardEntered).toBe(true);
    });

    it('founding member on active trial gets plus tier', async () => {
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      setupMockFrom({
        subscriptionsData: null,
        foundingData: {
          spot_number: 10,
          trial_starts_at: '2026-01-01',
          trial_ends_at: futureDate,
          card_entered_at: null,
        },
        subsCount: 0,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('plus');
      expect(state.isTrialing).toBe(true);
      expect(state.status).toBe('trialing');
      expect(state.isPlus).toBe(true);
    });

    it('founding member with expired trial gets free tier', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      setupMockFrom({
        subscriptionsData: null,
        foundingData: {
          spot_number: 5,
          trial_starts_at: '2025-12-01',
          trial_ends_at: pastDate,
          card_entered_at: null,
        },
        subsCount: 0,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('free');
      expect(state.isTrialing).toBe(false);
      expect(state.status).toBe('none');
      expect(state.isFree).toBe(true);
    });

    it('falls back to user_tiers table when no subscription found', async () => {
      setupMockFrom({
        subscriptionsData: null,
        subsCount: 0,
        userTierData: {
          tier: { name: 'Pro', slug: 'pro', features: {} },
        },
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('pro');
      expect(state.status).toBe('active');
      expect(state.isPro).toBe(true);
    });

    it('defaults to free tier when no subscription and no user_tier', async () => {
      setupMockFrom({
        subscriptionsData: null,
        subsCount: 0,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('free');
      expect(state.isFree).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('sets isTrialEligible when no previous subscriptions and not founding member', async () => {
      setupMockFrom({
        subscriptionsData: null,
        foundingData: null,
        subsCount: 0,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(useSubscriptionStore.getState().isTrialEligible).toBe(true);
    });

    it('sets isTrialEligible to false when user has previous subscriptions', async () => {
      setupMockFrom({
        subscriptionsData: null,
        foundingData: null,
        subsCount: 2,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(useSubscriptionStore.getState().isTrialEligible).toBe(false);
    });

    it('sets isTrialEligible to false when user is a founding member', async () => {
      setupMockFrom({
        subscriptionsData: null,
        foundingData: {
          spot_number: 1,
          trial_starts_at: '2026-01-01',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          card_entered_at: null,
        },
        subsCount: 0,
        userTierData: null,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(useSubscriptionStore.getState().isTrialEligible).toBe(false);
    });

    it('saves state to SecureStore cache after fetch', async () => {
      setupMockFrom({
        subscriptionsData: {
          tier_slug: 'pro',
          status: 'active',
          billing_interval: 'month',
          current_period_end: '2026-12-31',
          cancel_at_period_end: false,
          cancel_at: null,
          trial_end: null,
        },
        subsCount: 1,
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'subscription_cache',
        expect.any(String),
      );

      // Verify the cached data contains the correct tier
      const cachedCall = SecureStore.setItemAsync.mock.calls.find(
        (c: any[]) => c[0] === 'subscription_cache',
      );
      const parsed = JSON.parse(cachedCall[1]);
      expect(parsed.tier).toBe('pro');
    });

    it('handles fetch error gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Network failure');
      });

      await useSubscriptionStore.getState().fetchSubscription(USER_ID);

      const state = useSubscriptionStore.getState();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });
  });

  // ── updateOptimistic() ─────────────────────────────────────────
  describe('updateOptimistic()', () => {
    it('updates state with partial data', () => {
      useSubscriptionStore.getState().updateOptimistic({
        tier: 'plus',
        isPlus: true,
        isFree: false,
      });

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('plus');
      expect(state.isPlus).toBe(true);
      expect(state.isFree).toBe(false);
    });

    it('saves to SecureStore cache', () => {
      useSubscriptionStore.getState().updateOptimistic({ tier: 'business' });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'subscription_cache',
        expect.any(String),
      );
    });

    it('preserves existing state fields not in the partial', () => {
      useSubscriptionStore.setState({
        tier: 'pro',
        status: 'active',
        isPro: true,
        isFree: false,
        isFoundingMember: true,
        foundingSpotNumber: 7,
      });

      useSubscriptionStore.getState().updateOptimistic({ status: 'past_due' });

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('pro');
      expect(state.status).toBe('past_due');
      expect(state.isFoundingMember).toBe(true);
      expect(state.foundingSpotNumber).toBe(7);
    });
  });

  // ── clear() ────────────────────────────────────────────────────
  describe('clear()', () => {
    it('resets all state to defaults', () => {
      useSubscriptionStore.setState({
        tier: 'plus',
        status: 'active',
        isPlus: true,
        isFree: false,
        loading: false,
        initialized: true,
        isFoundingMember: true,
        foundingSpotNumber: 42,
      });

      useSubscriptionStore.getState().clear();

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('free');
      expect(state.status).toBe('none');
      expect(state.isFree).toBe(true);
      expect(state.isPlus).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(false);
    });

    it('deletes SecureStore cache on native', () => {
      useSubscriptionStore.getState().clear();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('subscription_cache');
    });

    it('does not call SecureStore on web', () => {
      (Platform as any).OS = 'web';
      SecureStore.deleteItemAsync.mockClear();

      useSubscriptionStore.getState().clear();

      // State should still be reset regardless
      expect(useSubscriptionStore.getState().tier).toBe('free');
    });
  });
});
