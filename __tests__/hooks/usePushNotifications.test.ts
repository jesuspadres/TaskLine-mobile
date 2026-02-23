/**
 * Tests for usePushNotifications hook
 * Source: hooks/usePushNotifications.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// ── Mock push notification lib ──
const mockInitializeNotifications = jest.fn();
const mockRegisterForPushNotifications = jest.fn().mockResolvedValue('ExponentPushToken[test123]');
const mockSavePushToken = jest.fn().mockResolvedValue(undefined);
const mockSetBadgeCount = jest.fn().mockResolvedValue(undefined);

let receivedListener: ((notification: any) => void) | null = null;
let responseListener: ((response: any) => void) | null = null;

const mockReceivedRemove = jest.fn();
const mockResponseRemove = jest.fn();

const mockAddNotificationReceivedListener = jest.fn((listener) => {
  receivedListener = listener;
  return { remove: mockReceivedRemove };
});

const mockAddNotificationResponseReceivedListener = jest.fn((listener) => {
  responseListener = listener;
  return { remove: mockResponseRemove };
});

jest.mock('@/lib/pushNotifications', () => ({
  initializeNotifications: (...args: any[]) => mockInitializeNotifications(...args),
  registerForPushNotifications: (...args: any[]) => mockRegisterForPushNotifications(...args),
  savePushToken: (...args: any[]) => mockSavePushToken(...args),
  setBadgeCount: (...args: any[]) => mockSetBadgeCount(...args),
  addNotificationReceivedListener: (...args: any[]) => mockAddNotificationReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args: any[]) => mockAddNotificationResponseReceivedListener(...args),
}));

jest.mock('@/lib/security', () => ({
  secureLog: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Mock auth store ──
let mockUser: any = null;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector?: any) => {
    const state = { user: mockUser };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
}));

// ── Mock expo-router ──
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { usePushNotifications } from '@/hooks/usePushNotifications';

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    receivedListener = null;
    responseListener = null;
    mockRegisterForPushNotifications.mockResolvedValue('ExponentPushToken[test123]');
  });

  it('should return pushToken, registering, and register', async () => {
    const { result } = renderHook(() => usePushNotifications());

    expect(result.current).toHaveProperty('pushToken');
    expect(result.current).toHaveProperty('registering');
    expect(result.current).toHaveProperty('register');
    expect(typeof result.current.register).toBe('function');

    // Flush async effects (auto-registration)
    await act(async () => {});
  });

  it('should initialize notifications on mount', async () => {
    renderHook(() => usePushNotifications());

    expect(mockInitializeNotifications).toHaveBeenCalledTimes(1);

    // Flush async effects
    await act(async () => {});
  });

  it('should only initialize notifications once across re-renders', async () => {
    const { rerender } = renderHook(() => usePushNotifications());

    rerender({});
    rerender({});

    expect(mockInitializeNotifications).toHaveBeenCalledTimes(1);

    // Flush async effects
    await act(async () => {});
  });

  it('should register for push notifications when user exists', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockRegisterForPushNotifications).toHaveBeenCalled();
    });
  });

  it('should save push token after registration', async () => {
    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockSavePushToken).toHaveBeenCalledWith('user-1', 'ExponentPushToken[test123]');
    });
  });

  it('should set pushToken state after registration', async () => {
    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.pushToken).toBe('ExponentPushToken[test123]');
    });
  });

  it('should clear badge count on mount when user exists', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
    });
  });

  it('should set up notification received listener', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockAddNotificationReceivedListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('should set up notification response listener', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('should clean up listeners on unmount', async () => {
    const { unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockAddNotificationReceivedListener).toHaveBeenCalled();
    });

    unmount();

    expect(mockReceivedRemove).toHaveBeenCalled();
    expect(mockResponseRemove).toHaveBeenCalled();
  });

  it('should not register when user is null', async () => {
    mockUser = null;

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
    expect(result.current.pushToken).toBeNull();
  });

  it('should clear pushToken when user becomes null', async () => {
    mockUser = null;

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.pushToken).toBeNull();

    // Flush async effects
    await act(async () => {});
  });

  it('should handle registration failure gracefully', async () => {
    mockRegisterForPushNotifications.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.registering).toBe(false);
    });

    expect(result.current.pushToken).toBeNull();
  });

  it('should handle null token (unsupported device)', async () => {
    mockRegisterForPushNotifications.mockResolvedValue(null);

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.registering).toBe(false);
    });

    expect(result.current.pushToken).toBeNull();
    expect(mockSavePushToken).not.toHaveBeenCalled();
  });

  it('should allow manual registration via register()', async () => {
    mockRegisterForPushNotifications.mockResolvedValue(null); // Initial fails

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.registering).toBe(false);
    });

    // Manually register with success
    mockRegisterForPushNotifications.mockResolvedValue('ExponentPushToken[manual]');

    let token: string | null = null;
    await act(async () => {
      token = await result.current.register();
    });

    expect(token).toBe('ExponentPushToken[manual]');
    expect(result.current.pushToken).toBe('ExponentPushToken[manual]');
  });

  // ── Navigation tests ──

  it('should navigate to notifications screen when entity_type is missing', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: {},
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith('/(app)/notifications');
  });

  it('should navigate to client-detail for client entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'client', entity_id: 'c-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/client-detail',
        params: { id: 'c-1' },
      })
    );
  });

  it('should navigate to project-detail for project entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'project', entity_id: 'p-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/project-detail',
        params: { id: 'p-1' },
      })
    );
  });

  it('should navigate to request-detail for request entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'request', entity_id: 'r-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/request-detail',
        params: { id: 'r-1' },
      })
    );
  });

  it('should navigate to request-detail for client_request entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'client_request', entity_id: 'cr-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/request-detail',
        params: { id: 'cr-1' },
      })
    );
  });

  it('should navigate to invoices for invoice entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'invoice', entity_id: 'inv-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith('/(app)/invoices');
  });

  it('should navigate to bookings for booking entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'booking', entity_id: 'b-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith('/(app)/bookings');
  });

  it('should navigate to tasks for task entity', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'task', entity_id: 't-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith('/(app)/tasks');
  });

  it('should navigate to notifications for unknown entity type', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(responseListener).not.toBeNull();
    });

    if (responseListener) {
      responseListener({
        notification: {
          request: {
            content: {
              data: { entity_type: 'unknown_type', entity_id: 'x-1' },
            },
          },
        },
      });
    }

    expect(mockPush).toHaveBeenCalledWith('/(app)/notifications');
  });
});
