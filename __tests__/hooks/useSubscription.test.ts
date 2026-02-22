/**
 * Tests for useSubscription hook
 * Source: hooks/useSubscription.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';

// ── Mock stores ──
const mockFetchSubscription = jest.fn().mockResolvedValue(undefined);
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockUpdateOptimistic = jest.fn();

let mockSubscriptionStoreState: any = {
  tier: 'free',
  status: 'none',
  billingPeriod: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  cancelAt: null,
  loading: false,
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
  initialize: mockInitialize,
  fetchSubscription: mockFetchSubscription,
  updateOptimistic: mockUpdateOptimistic,
};

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: jest.fn(() => mockSubscriptionStoreState),
}));

let mockUser: any = null;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({ user: mockUser })),
}));

import { useSubscription } from '@/hooks/useSubscription';

describe('useSubscription', () => {
  let appStateCallback: ((state: AppStateStatus) => void) | null = null;
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    appStateCallback = null;
    mockSubscriptionStoreState = {
      tier: 'free',
      status: 'none',
      billingPeriod: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      loading: false,
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
      initialize: mockInitialize,
      fetchSubscription: mockFetchSubscription,
      updateOptimistic: mockUpdateOptimistic,
    };

    // Mock AppState.currentState so appState.current.match() works
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateCallback = handler as any;
      return { remove: mockRemove } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return all expected subscription properties', () => {
    const { result } = renderHook(() => useSubscription());

    expect(result.current).toHaveProperty('tier');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('billingPeriod');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('isFree');
    expect(result.current).toHaveProperty('isPro');
    expect(result.current).toHaveProperty('isPlus');
    expect(result.current).toHaveProperty('isBusiness');
    expect(result.current).toHaveProperty('isTrialing');
    expect(result.current).toHaveProperty('trialEnd');
    expect(result.current).toHaveProperty('daysRemaining');
    expect(result.current).toHaveProperty('isFoundingMember');
    expect(result.current).toHaveProperty('foundingSpotNumber');
    expect(result.current).toHaveProperty('cardEntered');
    expect(result.current).toHaveProperty('isTrialEligible');
    expect(result.current).toHaveProperty('refresh');
    expect(result.current).toHaveProperty('updateOptimistic');
  });

  it('should return free tier by default', () => {
    const { result } = renderHook(() => useSubscription());

    expect(result.current.tier).toBe('free');
    expect(result.current.isFree).toBe(true);
    expect(result.current.isPro).toBe(false);
    expect(result.current.isPlus).toBe(false);
    expect(result.current.isBusiness).toBe(false);
  });

  it('should initialize store when user exists and store is not initialized', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith('user-1');
    });
  });

  it('should not initialize when user is null', async () => {
    mockUser = null;

    renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('should not re-initialize when store is already initialized', async () => {
    mockSubscriptionStoreState.initialized = true;

    renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('should return pro tier state when store has pro', () => {
    mockSubscriptionStoreState = {
      ...mockSubscriptionStoreState,
      tier: 'pro',
      status: 'active',
      isFree: false,
      isPro: true,
      initialized: true,
    };

    const { result } = renderHook(() => useSubscription());

    expect(result.current.tier).toBe('pro');
    expect(result.current.isPro).toBe(true);
    expect(result.current.isFree).toBe(false);
  });

  it('should return trialing state', () => {
    mockSubscriptionStoreState = {
      ...mockSubscriptionStoreState,
      tier: 'plus',
      status: 'trialing',
      isTrialing: true,
      trialEnd: '2024-12-31T00:00:00Z',
      daysRemaining: 14,
      initialized: true,
    };

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isTrialing).toBe(true);
    expect(result.current.trialEnd).toBe('2024-12-31T00:00:00Z');
    expect(result.current.daysRemaining).toBe(14);
  });

  it('should re-fetch on app coming to foreground', async () => {
    renderHook(() => useSubscription());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Simulate background -> active transition
    if (appStateCallback) {
      // First set to background
      await act(async () => {
        appStateCallback!('background' as AppStateStatus);
      });

      mockFetchSubscription.mockClear();

      // Then to active
      await act(async () => {
        appStateCallback!('active' as AppStateStatus);
      });

      expect(mockFetchSubscription).toHaveBeenCalledWith('user-1');
    }
  });

  it('should not re-fetch if user is null on foreground', async () => {
    mockUser = null;

    renderHook(() => useSubscription());

    if (appStateCallback) {
      await act(async () => {
        appStateCallback!('background' as AppStateStatus);
      });
      await act(async () => {
        appStateCallback!('active' as AppStateStatus);
      });

      expect(mockFetchSubscription).not.toHaveBeenCalled();
    }
  });

  it('should clean up AppState listener on unmount', () => {
    const { unmount } = renderHook(() => useSubscription());

    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('should return a refresh function that calls fetchSubscription', async () => {
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetchSubscription).toHaveBeenCalledWith('user-1');
  });

  it('should return no-op refresh when user is null', async () => {
    mockUser = null;

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.refresh();
    });

    // fetchSubscription should NOT be called
    expect(mockFetchSubscription).not.toHaveBeenCalled();
  });

  it('should expose updateOptimistic from store', () => {
    const { result } = renderHook(() => useSubscription());

    expect(result.current.updateOptimistic).toBe(mockUpdateOptimistic);
  });

  it('should return founding member info', () => {
    mockSubscriptionStoreState = {
      ...mockSubscriptionStoreState,
      isFoundingMember: true,
      foundingSpotNumber: 42,
      cardEntered: true,
      initialized: true,
    };

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isFoundingMember).toBe(true);
    expect(result.current.foundingSpotNumber).toBe(42);
    expect(result.current.cardEntered).toBe(true);
  });

  it('should return cancelAtPeriodEnd and cancelAt', () => {
    mockSubscriptionStoreState = {
      ...mockSubscriptionStoreState,
      cancelAtPeriodEnd: true,
      cancelAt: '2024-12-31T00:00:00Z',
      initialized: true,
    };

    const { result } = renderHook(() => useSubscription());

    expect(result.current.cancelAtPeriodEnd).toBe(true);
    expect(result.current.cancelAt).toBe('2024-12-31T00:00:00Z');
  });
});
