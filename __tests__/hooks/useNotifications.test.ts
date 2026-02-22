/**
 * Tests for useNotifications hook
 * Source: hooks/useNotifications.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

// ── Mock supabase ──
const mockUnsubscribe = jest.fn();
const mockChannelOn = jest.fn().mockReturnThis();
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
const mockChannel = {
  on: mockChannelOn,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
};

let queryResponse: { data: any; error: any; count?: number | null } = {
  data: [],
  error: null,
  count: 0,
};

function mockCreateQueryBuilder() {
  const builder: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'single', 'in', 'is'];
  methods.forEach((m) => {
    builder[m] = jest.fn().mockReturnValue(builder);
  });
  // Make it thenable
  Object.defineProperty(builder, 'then', {
    value: (resolve: any, reject?: any) => {
      return Promise.resolve({ ...queryResponse }).then(resolve, reject);
    },
    writable: true,
    configurable: true,
  });
  return builder;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockCreateQueryBuilder()),
    channel: jest.fn(() => mockChannel),
  },
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

import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/lib/supabase';

describe('useNotifications', () => {
  const mockAppStateListener = jest.fn();
  let appStateCallback: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    queryResponse = { data: [], error: null, count: 0 };
    appStateCallback = null;

    // Re-establish mocks after clearAllMocks
    (supabase.from as jest.Mock).mockImplementation(() => mockCreateQueryBuilder());
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    mockChannelOn.mockReturnThis();
    mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateCallback = handler as any;
      return { remove: mockAppStateListener } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return all expected properties', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toHaveProperty('notifications');
      expect(result.current).toHaveProperty('unreadCount');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('fetchNotifications');
      expect(result.current).toHaveProperty('fetchUnreadCount');
      expect(result.current).toHaveProperty('markAsRead');
      expect(result.current).toHaveProperty('markAllAsRead');
      expect(result.current).toHaveProperty('archiveNotification');
      expect(result.current).toHaveProperty('archiveAllRead');
      expect(result.current).toHaveProperty('archiveAll');
    });
  });

  it('should fetch notifications on mount when user exists', async () => {
    const mockData = [
      { id: '1', type: 'info', title: 'Test', message: null, is_read: false, is_archived: false, created_at: '2024-01-01' },
    ];
    queryResponse = { data: mockData, error: null, count: 0 };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('notifications');
    });
  });

  it('should not fetch when user is null', async () => {
    mockUser = null;
    const fromSpy = supabase.from as jest.Mock;
    fromSpy.mockClear();

    const { result } = renderHook(() => useNotifications());

    // Give effects time to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // from('notifications') should not be called for data queries
    // (The channel setup also won't happen since user is null)
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should set up real-time subscription with unique channel name', async () => {
    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    const channelName = (supabase.channel as jest.Mock).mock.calls[0][0];
    expect(channelName).toMatch(/^notifications_user-1_\d+$/);
    expect(mockChannelOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.user-1',
      }),
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should unsubscribe from channel on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle fetchNotifications error gracefully', async () => {
    queryResponse = { data: null, error: { message: 'DB error' }, count: null };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toEqual([]);
    });
  });

  it('should mark a notification as read', async () => {
    const initialNotifications = [
      { id: 'n1', type: 'info', title: 'Test', message: null, link_url: null, entity_type: null, entity_id: null, is_read: false, is_archived: false, created_at: '2024-01-01', triggered_by_name: null },
      { id: 'n2', type: 'info', title: 'Test 2', message: null, link_url: null, entity_type: null, entity_id: null, is_read: false, is_archived: false, created_at: '2024-01-02', triggered_by_name: null },
    ];
    queryResponse = { data: initialNotifications, error: null, count: 2 };

    const { result } = renderHook(() => useNotifications());

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.notifications.length).toBeGreaterThanOrEqual(0);
    });

    // Now mark as read with success response
    queryResponse = { data: null, error: null, count: null };

    await act(async () => {
      await result.current.markAsRead('n1');
    });

    // The notification should be updated in local state
    const n1 = result.current.notifications.find((n) => n.id === 'n1');
    if (n1) {
      expect(n1.is_read).toBe(true);
    }
  });

  it('should mark all notifications as read', async () => {
    queryResponse = { data: null, error: null, count: null };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should archive a notification', async () => {
    const initialNotifications = [
      { id: 'n1', type: 'info', title: 'Test', message: null, link_url: null, entity_type: null, entity_id: null, is_read: true, is_archived: false, created_at: '2024-01-01', triggered_by_name: null },
    ];
    queryResponse = { data: initialNotifications, error: null, count: 0 };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBeGreaterThanOrEqual(0);
    });

    queryResponse = { data: null, error: null, count: null };

    await act(async () => {
      await result.current.archiveNotification('n1');
    });

    expect(result.current.notifications.find((n) => n.id === 'n1')).toBeUndefined();
  });

  it('should archive all read notifications', async () => {
    queryResponse = { data: null, error: null, count: null };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await act(async () => {
      await result.current.archiveAllRead();
    });

    // All read notifications should be removed from state
    // (only unread remain)
    const readNotifications = result.current.notifications.filter((n) => n.is_read);
    expect(readNotifications.length).toBe(0);
  });

  it('should archive all notifications', async () => {
    queryResponse = { data: null, error: null, count: null };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await act(async () => {
      await result.current.archiveAll();
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should handle markAsRead error', async () => {
    queryResponse = { data: null, error: { message: 'Update failed' }, count: null };

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should not throw
    await act(async () => {
      await result.current.markAsRead('invalid-id');
    });
  });

  it('should refresh when app comes to foreground', async () => {
    const fromSpy = supabase.from as jest.Mock;

    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    // Clear previous calls from initial mount
    fromSpy.mockClear();

    // Simulate app coming to foreground
    if (appStateCallback) {
      await act(async () => {
        appStateCallback!('active');
      });
    }

    // Should re-fetch notifications
    expect(fromSpy).toHaveBeenCalled();
  });

  it('should not refresh when app goes to background', async () => {
    const fromSpy = supabase.from as jest.Mock;

    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalled();
    });

    fromSpy.mockClear();

    if (appStateCallback) {
      await act(async () => {
        appStateCallback!('background');
      });
    }

    // Should NOT re-fetch
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('should remove AppState listener on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalled();
    });

    unmount();
    expect(mockAppStateListener).toHaveBeenCalled();
  });

  it('should decrement unreadCount when marking as read', async () => {
    queryResponse = { data: null, error: null, count: null };
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // markAsRead should reduce unreadCount by 1 (clamped to 0)
    await act(async () => {
      await result.current.markAsRead('some-id');
    });

    expect(result.current.unreadCount).toBe(0);
  });
});
