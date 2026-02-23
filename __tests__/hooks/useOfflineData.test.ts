/**
 * Tests for useOfflineData hook
 * Source: hooks/useOfflineData.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// ── Mock offlineStorage ──
const mockGetCache = jest.fn();
const mockSetCache = jest.fn();
const mockSubscribeCacheKey = jest.fn(() => jest.fn());

jest.mock('@/lib/offlineStorage', () => ({
  getCache: (...args: any[]) => mockGetCache(...args),
  setCache: (...args: any[]) => mockSetCache(...args),
  subscribeCacheKey: (...args: any[]) => mockSubscribeCacheKey(...args),
}));

// ── Mock offline store ──
let mockIsOnline = true;

jest.mock('@/stores/offlineStore', () => ({
  useOfflineStore: jest.fn((selector?: any) => {
    const state = {
      isOnline: mockIsOnline,
      setOnline: jest.fn(),
      addMutation: jest.fn(),
      pendingMutations: [],
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
}));

import { useOfflineData } from '@/hooks/useOfflineData';

describe('useOfflineData', () => {
  const mockFetchFn = jest.fn();
  const CACHE_KEY = 'test-cache-key';

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    mockFetchFn.mockResolvedValue([{ id: 1, name: 'Test' }]);
  });

  it('should return all expected properties', async () => {
    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('refreshing');
    expect(result.current).toHaveProperty('isStale');
    expect(result.current).toHaveProperty('isOffline');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');

    // Flush async effects (cache read + fetch)
    await act(async () => {});
  });

  it('should start in loading state', async () => {
    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // Flush async effects
    await act(async () => {});
  });

  it('should fetch fresh data when online and no cache', async () => {
    const freshData = [{ id: 1, name: 'Fresh' }];
    mockFetchFn.mockResolvedValue(freshData);

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalled();
    expect(result.current.data).toEqual(freshData);
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should use cache-first strategy when cache exists', async () => {
    const cachedData = [{ id: 1, name: 'Cached' }];
    mockGetCache.mockResolvedValue({ data: cachedData, timestamp: Date.now() });

    const freshData = [{ id: 1, name: 'Fresh' }];
    mockFetchFn.mockResolvedValue(freshData);

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    // Initially should show cached data (stale)
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    // Eventually fresh data replaces cache
    await waitFor(() => {
      expect(result.current.data).toEqual(freshData);
      expect(result.current.isStale).toBe(false);
    });
  });

  it('should show cached data when offline', async () => {
    mockIsOnline = false;
    const cachedData = [{ id: 1, name: 'Cached' }];
    mockGetCache.mockResolvedValue({ data: cachedData, timestamp: Date.now() - 10000 });

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(cachedData);
      expect(result.current.loading).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });

    // Should NOT call fetch when offline
    expect(mockFetchFn).not.toHaveBeenCalled();
  });

  it('should return null data when offline and no cache', async () => {
    mockIsOnline = false;
    mockGetCache.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isOffline).toBe(true);
  });

  it('should handle fetch errors gracefully with no cache', async () => {
    mockFetchFn.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('should keep cached data on fetch error when cache exists', async () => {
    const cachedData = [{ id: 1, name: 'Cached' }];
    mockGetCache.mockResolvedValue({ data: cachedData, timestamp: Date.now() });
    mockFetchFn.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still show cached data, not the error
    expect(result.current.data).toEqual(cachedData);
  });

  it('should save fresh data to cache', async () => {
    const freshData = [{ id: 1, name: 'Fresh' }];
    mockFetchFn.mockResolvedValue(freshData);

    renderHook(() => useOfflineData(CACHE_KEY, mockFetchFn));

    await waitFor(() => {
      expect(mockSetCache).toHaveBeenCalledWith(CACHE_KEY, freshData);
    });
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn, { enabled: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('should pass maxAge to getCache', async () => {
    const customMaxAge = 5000;

    renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn, { maxAge: customMaxAge })
    );

    await waitFor(() => {
      expect(mockGetCache).toHaveBeenCalledWith(CACHE_KEY, customMaxAge, expect.any(Boolean));
    });
  });

  it('should ignore TTL when offline', async () => {
    mockIsOnline = false;
    mockGetCache.mockResolvedValue({ data: ['old'], timestamp: Date.now() - 999999999 });

    renderHook(() => useOfflineData(CACHE_KEY, mockFetchFn));

    await waitFor(() => {
      // When offline, ignoreExpiry (3rd arg) should be true
      expect(mockGetCache).toHaveBeenCalledWith(CACHE_KEY, expect.any(Number), true);
    });
  });

  it('should subscribe to cache key changes', async () => {
    renderHook(() => useOfflineData(CACHE_KEY, mockFetchFn));

    expect(mockSubscribeCacheKey).toHaveBeenCalledWith(CACHE_KEY, expect.any(Function));

    // Flush async effects
    await act(async () => {});
  });

  it('should clean up cache subscription on unmount', async () => {
    const mockUnsub = jest.fn();
    mockSubscribeCacheKey.mockReturnValue(mockUnsub);

    const { unmount } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    // Flush async effects before unmount
    await act(async () => {});

    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('should set isOffline based on online status', async () => {
    mockIsOnline = true;
    const { result: onlineResult, unmount: unmountOnline } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );
    expect(onlineResult.current.isOffline).toBe(false);
    // Flush async effects
    await act(async () => {});
    unmountOnline();

    mockIsOnline = false;
    const { result: offlineResult } = renderHook(() =>
      useOfflineData('other-key', mockFetchFn)
    );
    expect(offlineResult.current.isOffline).toBe(true);
    // Flush async effects
    await act(async () => {});
  });

  it('should provide a refresh function', async () => {
    mockFetchFn.mockResolvedValue([{ id: 1 }]);

    const { result } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue([{ id: 2 }]);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalled();
    });
  });

  it('should not update state after unmount', async () => {
    // Slow fetch
    let resolveFetch: (v: any) => void;
    mockFetchFn.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const { result, unmount } = renderHook(() =>
      useOfflineData(CACHE_KEY, mockFetchFn)
    );

    // Unmount before fetch completes
    unmount();

    // Resolve fetch after unmount — should not cause state update error
    await act(async () => {
      resolveFetch!([{ id: 1 }]);
      await new Promise((r) => setTimeout(r, 10));
    });

    // No error should occur
  });
});
