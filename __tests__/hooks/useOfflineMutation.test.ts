/**
 * Tests for useOfflineMutation hook
 * Source: hooks/useOfflineMutation.ts
 */
import { renderHook, act } from '@testing-library/react-native';

// ── Mock offlineStorage ──
const mockInvalidateCache = jest.fn().mockResolvedValue(undefined);
const mockUpdateCacheData = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/offlineStorage', () => ({
  invalidateCache: (...args: any[]) => mockInvalidateCache(...args),
  updateCacheData: (...args: any[]) => mockUpdateCacheData(...args),
}));

// ── Mock supabase ──
let mockInsertResult: any = { error: null };
let mockUpdateResult: any = { error: null };
let mockDeleteResult: any = { error: null };

const mockInsert = jest.fn().mockImplementation(() => Promise.resolve(mockInsertResult));
const mockUpdateChain = {
  eq: jest.fn().mockImplementation(() => Promise.resolve(mockUpdateResult)),
};
const mockUpdate = jest.fn().mockReturnValue(mockUpdateChain);
const mockDeleteChain = {
  eq: jest.fn().mockImplementation(() => Promise.resolve(mockDeleteResult)),
};
const mockDelete = jest.fn().mockReturnValue(mockDeleteChain);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

// ── Mock offline store ──
let mockIsOnline = true;
const mockAddMutation = jest.fn();
let mockPendingMutations: any[] = [];

jest.mock('@/stores/offlineStore', () => ({
  useOfflineStore: jest.fn((selector?: any) => {
    const state = {
      isOnline: mockIsOnline,
      addMutation: mockAddMutation,
      pendingMutations: mockPendingMutations,
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
}));

import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { supabase } from '@/lib/supabase';

describe('useOfflineMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockPendingMutations = [];
    mockInsertResult = { error: null };
    mockUpdateResult = { error: null };
    mockDeleteResult = { error: null };

    // Re-establish implementations after clearAllMocks
    (supabase.from as jest.Mock).mockImplementation(() => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }));
    mockInsert.mockImplementation(() => Promise.resolve(mockInsertResult));
    mockUpdate.mockReturnValue(mockUpdateChain);
    mockUpdateChain.eq.mockImplementation(() => Promise.resolve(mockUpdateResult));
    mockDelete.mockReturnValue(mockDeleteChain);
    mockDeleteChain.eq.mockImplementation(() => Promise.resolve(mockDeleteResult));
  });

  it('should return mutate function and pendingCount', () => {
    const { result } = renderHook(() => useOfflineMutation());

    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.pendingCount).toBe(0);
  });

  it('should return pending count from store', () => {
    mockPendingMutations = [{ id: '1' }, { id: '2' }];

    const { result } = renderHook(() => useOfflineMutation());

    expect(result.current.pendingCount).toBe(2);
  });

  // ── Online insert tests ──

  it('should execute insert directly when online', async () => {
    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'New Task', status: 'pending' },
        cacheKeys: ['tasks-list'],
      });
    });

    expect(mockInsert).toHaveBeenCalledWith({ title: 'New Task', status: 'pending' });
    expect(res!.error).toBeNull();
    expect(res!.queued).toBeUndefined();
  });

  it('should invalidate cache keys after successful online insert', async () => {
    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
        cacheKeys: ['tasks-list', 'dashboard-stats'],
      });
    });

    expect(mockInvalidateCache).toHaveBeenCalledWith('tasks-list');
    expect(mockInvalidateCache).toHaveBeenCalledWith('dashboard-stats');
  });

  // ── Online update tests ──

  it('should execute update directly when online', async () => {
    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'update',
        data: { status: 'completed' },
        matchColumn: 'id',
        matchValue: 'task-1',
        cacheKeys: ['tasks-list'],
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
    expect(mockUpdateChain.eq).toHaveBeenCalledWith('id', 'task-1');
    expect(res!.error).toBeNull();
  });

  // ── Online delete tests ──

  it('should execute delete directly when online', async () => {
    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'delete',
        matchColumn: 'id',
        matchValue: 'task-1',
        cacheKeys: ['tasks-list'],
      });
    });

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteChain.eq).toHaveBeenCalledWith('id', 'task-1');
    expect(res!.error).toBeNull();
  });

  // ── Online error handling ──

  it('should return error from failed online insert', async () => {
    mockInsertResult = { error: { message: 'Duplicate key' } };

    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
      });
    });

    expect(res!.error).toEqual({ message: 'Duplicate key' });
  });

  it('should return error from failed online update', async () => {
    mockUpdateResult = { error: { message: 'RLS denied' } };

    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'update',
        data: { status: 'done' },
        matchColumn: 'id',
        matchValue: 'task-1',
      });
    });

    expect(res!.error).toEqual({ message: 'RLS denied' });
  });

  it('should handle thrown exceptions during online mutation', async () => {
    mockInsert.mockRejectedValue(new Error('Connection timeout'));

    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
      });
    });

    expect(res!.error).toBeInstanceOf(Error);
    expect(res!.error.message).toBe('Connection timeout');
  });

  it('should not invalidate cache on error', async () => {
    mockInsertResult = { error: { message: 'Failed' } };

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
        cacheKeys: ['tasks-list'],
      });
    });

    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  // ── Offline (queue) tests ──

  it('should queue mutation when offline', async () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Queued Task' },
        cacheKeys: ['tasks-list'],
      });
    });

    expect(res!.queued).toBe(true);
    expect(res!.error).toBeNull();
    expect(mockAddMutation).toHaveBeenCalledWith({
      table: 'tasks',
      operation: 'insert',
      data: { title: 'Queued Task' },
      matchColumn: 'id',
      matchValue: '',
      cacheKeys: ['tasks-list'],
    });
  });

  it('should not call supabase when offline', async () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
      });
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should apply optimistic update when offline', async () => {
    mockIsOnline = false;
    const updater = jest.fn((data: any) => [...data, { id: 'new', title: 'Optimistic' }]);

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Optimistic' },
        optimisticUpdate: {
          cacheKey: 'tasks-list',
          updater,
        },
      });
    });

    expect(mockUpdateCacheData).toHaveBeenCalledWith('tasks-list', updater);
  });

  it('should not apply optimistic update when no optimisticUpdate provided', async () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'No Optimistic' },
      });
    });

    expect(mockUpdateCacheData).not.toHaveBeenCalled();
  });

  // ── Default values ──

  it('should use default matchColumn and matchValue', async () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'update',
        data: { status: 'done' },
      });
    });

    expect(mockAddMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        matchColumn: 'id',
        matchValue: '',
      })
    );
  });

  it('should use default empty cacheKeys array', async () => {
    mockIsOnline = false;

    const { result } = renderHook(() => useOfflineMutation());

    await act(async () => {
      await result.current.mutate({
        table: 'tasks',
        operation: 'insert',
        data: { title: 'Test' },
      });
    });

    expect(mockAddMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKeys: [],
      })
    );
  });

  // ── Unknown operation ──

  it('should return error for unknown operation when online', async () => {
    const { result } = renderHook(() => useOfflineMutation());

    const res = await act(async () => {
      return await result.current.mutate({
        table: 'tasks',
        operation: 'upsert' as any,
        data: { title: 'Test' },
      });
    });

    expect(res!.error).toBeDefined();
    expect(res!.error.message).toContain('Unknown operation');
  });
});
