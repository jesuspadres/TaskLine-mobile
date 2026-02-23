/**
 * Tests for useNetworkStatus hook
 * Source: hooks/useNetworkStatus.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';

// ── Mock offline store ──
const mockSetOnline = jest.fn();
let mockIsOnline = true;

jest.mock('@/stores/offlineStore', () => ({
  useOfflineStore: jest.fn((selector?: any) => {
    const state = {
      isOnline: mockIsOnline,
      setOnline: mockSetOnline,
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
}));

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  let netInfoCallback: ((state: any) => void) | null = null;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    netInfoCallback = null;

    // Re-establish mock implementations after clearAllMocks
    (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
      netInfoCallback = callback;
      return mockUnsubscribe;
    });

    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('should return isOnline status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toHaveProperty('isOnline');
    expect(result.current.isOnline).toBe(true);
  });

  it('should register NetInfo listener on mount', () => {
    renderHook(() => useNetworkStatus());

    expect(NetInfo.addEventListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should fetch initial network state on mount', async () => {
    renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(NetInfo.fetch).toHaveBeenCalled();
    });
  });

  it('should set online to true when connected and reachable', async () => {
    renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(mockSetOnline).toHaveBeenCalledWith(true);
    });
  });

  it('should set online to false when not connected', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(mockSetOnline).toHaveBeenCalledWith(false);
    });
  });

  it('should update online status when network state changes', async () => {
    renderHook(() => useNetworkStatus());

    expect(netInfoCallback).not.toBeNull();

    // Simulate going offline
    await act(async () => {
      netInfoCallback!({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('should treat isInternetReachable=null as online (connected)', async () => {
    renderHook(() => useNetworkStatus());

    // isInternetReachable can be null initially on some platforms
    await act(async () => {
      if (netInfoCallback) {
        netInfoCallback({
          isConnected: true,
          isInternetReachable: null,
        });
      }
    });

    // isInternetReachable !== false means connected = true
    expect(mockSetOnline).toHaveBeenCalledWith(true);
  });

  it('should treat isInternetReachable=false as offline', async () => {
    renderHook(() => useNetworkStatus());

    await act(async () => {
      if (netInfoCallback) {
        netInfoCallback({
          isConnected: true,
          isInternetReachable: false,
        });
      }
    });

    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('should unsubscribe from NetInfo on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle rapid network changes', async () => {
    renderHook(() => useNetworkStatus());

    // Wait for initial NetInfo.fetch() to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    mockSetOnline.mockClear();

    if (netInfoCallback) {
      await act(async () => {
        netInfoCallback!({ isConnected: false, isInternetReachable: false });
        netInfoCallback!({ isConnected: true, isInternetReachable: true });
        netInfoCallback!({ isConnected: false, isInternetReachable: false });
      });

      // Last call should be false
      const lastCall = mockSetOnline.mock.calls[mockSetOnline.mock.calls.length - 1];
      expect(lastCall[0]).toBe(false);
    }
  });

  it('should return false when isOnline is false in store', () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
  });

  it('should only register one listener regardless of re-renders', () => {
    const { rerender } = renderHook(() => useNetworkStatus());

    rerender({});
    rerender({});

    // addEventListener should only be called once (from mount effect)
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });
});
