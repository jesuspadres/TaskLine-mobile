/**
 * Tests for useNavigationBadges hook
 * Source: hooks/useNavigationBadges.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

// ── Mock supabase ──
const mockChannelUnsubscribe = jest.fn();
const mockChannelOn = jest.fn().mockReturnThis();
const mockChannelSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockChannelUnsubscribe });

let queryResponses: Record<string, { data: any; error: any; count: number | null }> = {};

function mockCreateQueryBuilder(table: string) {
  const builder: any = {};
  const methods = ['select', 'eq', 'neq', 'order', 'limit', 'single', 'in', 'is'];
  methods.forEach((m) => {
    builder[m] = jest.fn().mockReturnValue(builder);
  });
  Object.defineProperty(builder, 'then', {
    value: (resolve: any, reject?: any) => {
      const response = queryResponses[table] || { data: null, error: null, count: 0 };
      return Promise.resolve({ ...response }).then(resolve, reject);
    },
    writable: true,
    configurable: true,
  });
  return builder;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => mockCreateQueryBuilder(table)),
    channel: jest.fn(() => ({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
      unsubscribe: mockChannelUnsubscribe,
    })),
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

import { useNavigationBadges } from '@/hooks/useNavigationBadges';
import { supabase } from '@/lib/supabase';

describe('useNavigationBadges', () => {
  let appStateCallback: ((state: string) => void) | null = null;
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    appStateCallback = null;
    queryResponses = {
      requests: { data: null, error: null, count: 3 },
      projects: { data: null, error: null, count: 1 },
      tasks: { data: null, error: null, count: 5 },
      notifications: { data: null, error: null, count: 2 },
    };

    // Re-establish mocks after clearAllMocks
    (supabase.from as jest.Mock).mockImplementation((table: string) => mockCreateQueryBuilder(table));
    (supabase.channel as jest.Mock).mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
      unsubscribe: mockChannelUnsubscribe,
    });
    mockChannelOn.mockReturnThis();
    mockChannelSubscribe.mockReturnValue({ unsubscribe: mockChannelUnsubscribe });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateCallback = handler as any;
      return { remove: mockRemove } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return counts and refresh function', async () => {
    const { result } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(result.current).toHaveProperty('counts');
      expect(result.current).toHaveProperty('refresh');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  it('should initialize counts to zero', () => {
    mockUser = null;
    const { result } = renderHook(() => useNavigationBadges());

    expect(result.current.counts).toEqual({
      requests: 0,
      projects: 0,
      tasks: 0,
      notifications: 0,
    });
  });

  it('should fetch counts on mount when user exists', async () => {
    const { result } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('requests');
      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(supabase.from).toHaveBeenCalledWith('notifications');
    });
  });

  it('should not fetch when user is null', async () => {
    mockUser = null;
    const fromSpy = supabase.from as jest.Mock;

    renderHook(() => useNavigationBadges());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // from() should not be called at all (no queries, no channels)
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('should set up real-time subscriptions for 4 tables', async () => {
    renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledTimes(4);
    });

    const channelNames = (supabase.channel as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(channelNames).toContain('requests_badge_user-1');
    expect(channelNames).toContain('projects_badge_user-1');
    expect(channelNames).toContain('tasks_badge_user-1');
    expect(channelNames).toContain('notifications_badge_user-1');
  });

  it('should subscribe to postgres_changes on each channel', async () => {
    renderHook(() => useNavigationBadges());

    await waitFor(() => {
      // 4 channels, each with .on() called
      expect(mockChannelOn).toHaveBeenCalledTimes(4);
    });

    // Verify the 'postgres_changes' event is used for each
    mockChannelOn.mock.calls.forEach((call: any[]) => {
      expect(call[0]).toBe('postgres_changes');
      expect(call[1]).toHaveProperty('event', '*');
      expect(call[1]).toHaveProperty('schema', 'public');
    });
  });

  it('should unsubscribe from all channels on unmount', async () => {
    const { unmount } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();

    // Should call unsubscribe for each of the 4 channels
    expect(mockChannelUnsubscribe).toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    queryResponses = {
      requests: { data: null, error: { message: 'DB error' }, count: null },
      projects: { data: null, error: { message: 'DB error' }, count: null },
      tasks: { data: null, error: { message: 'DB error' }, count: null },
      notifications: { data: null, error: { message: 'DB error' }, count: null },
    };

    const { result } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      // Counts should default to 0 when error
      expect(result.current.counts.requests).toBe(0);
      expect(result.current.counts.projects).toBe(0);
      expect(result.current.counts.tasks).toBe(0);
      expect(result.current.counts.notifications).toBe(0);
    });
  });

  it('should handle null counts by defaulting to 0', async () => {
    queryResponses = {
      requests: { data: null, error: null, count: null },
      projects: { data: null, error: null, count: null },
      tasks: { data: null, error: null, count: null },
      notifications: { data: null, error: null, count: null },
    };

    const { result } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(result.current.counts.requests).toBe(0);
      expect(result.current.counts.projects).toBe(0);
    });
  });

  it('should refresh counts when app comes to foreground', async () => {
    const fromSpy = supabase.from as jest.Mock;

    renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    fromSpy.mockClear();

    if (appStateCallback) {
      await act(async () => {
        appStateCallback!('active');
      });

      // fetchCounts should be called
      expect(fromSpy).toHaveBeenCalled();
    }
  });

  it('should not refresh on background state', async () => {
    const fromSpy = supabase.from as jest.Mock;

    renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalled();
    });

    fromSpy.mockClear();

    if (appStateCallback) {
      await act(async () => {
        appStateCallback!('background');
      });

      expect(fromSpy).not.toHaveBeenCalled();
    }
  });

  it('should clean up AppState listener on unmount', () => {
    const { unmount } = renderHook(() => useNavigationBadges());

    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('should allow manual refresh via returned function', async () => {
    const fromSpy = supabase.from as jest.Mock;

    const { result } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(result.current.refresh).toBeDefined();
    });

    fromSpy.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fromSpy).toHaveBeenCalled();
  });

  it('should clean up old channels before creating new ones on re-render', async () => {
    const { rerender } = renderHook(() => useNavigationBadges());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    const firstCallCount = mockChannelUnsubscribe.mock.calls.length;

    // Trigger user change to re-run effect
    mockUser = { id: 'user-2', email: 'other@test.com' };
    rerender({});

    await waitFor(() => {
      // Old channels should have been unsubscribed
      expect(mockChannelUnsubscribe.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
});
