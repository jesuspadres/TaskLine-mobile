/**
 * Tests for offlineStore (stores/offlineStore.ts)
 *
 * Tests the Zustand store directly via getState() / setState().
 * Supabase and offlineStorage are mocked at the module level.
 */

// ── Mocks ────────────────────────────────────────────────────────
const mockSupabaseFrom = jest.fn();
const mockInvalidateCache = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

jest.mock('@/lib/offlineStorage', () => ({
  invalidateCache: (...args: any[]) => mockInvalidateCache(...args),
}));

import { useOfflineStore, PendingMutation } from '@/stores/offlineStore';

// ── Helpers ──────────────────────────────────────────────────────
function resetStore() {
  useOfflineStore.setState({
    isOnline: true,
    isSyncing: false,
    pendingMutations: [],
    failedMutations: [],
  });
}

function makeMutation(overrides?: Partial<Omit<PendingMutation, 'id' | 'createdAt' | 'retryCount'>>): Omit<PendingMutation, 'id' | 'createdAt' | 'retryCount'> {
  return {
    table: 'tasks',
    operation: 'update',
    data: { title: 'Test' },
    matchColumn: 'id',
    matchValue: 'task-1',
    cacheKeys: ['tasks_list'],
    ...overrides,
  };
}

function makeFullMutation(overrides?: Partial<PendingMutation>): PendingMutation {
  return {
    id: `mut-${Math.random().toString(36).slice(2, 9)}`,
    table: 'tasks',
    operation: 'update',
    data: { title: 'Test' },
    matchColumn: 'id',
    matchValue: 'task-1',
    cacheKeys: ['tasks_list'],
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────
describe('offlineStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockInvalidateCache.mockResolvedValue(undefined);
  });

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('has isOnline as true', () => {
      expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it('has isSyncing as false', () => {
      expect(useOfflineStore.getState().isSyncing).toBe(false);
    });

    it('has empty pendingMutations', () => {
      expect(useOfflineStore.getState().pendingMutations).toEqual([]);
    });

    it('has empty failedMutations', () => {
      expect(useOfflineStore.getState().failedMutations).toEqual([]);
    });
  });

  // ── setOnline() ────────────────────────────────────────────────
  describe('setOnline()', () => {
    it('sets isOnline to false', () => {
      useOfflineStore.getState().setOnline(false);
      expect(useOfflineStore.getState().isOnline).toBe(false);
    });

    it('sets isOnline to true', () => {
      useOfflineStore.setState({ isOnline: false });
      useOfflineStore.getState().setOnline(true);
      expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it('triggers syncAll when going online with pending mutations', async () => {
      const pendingMut = makeFullMutation({ id: 'sync-trigger', operation: 'insert' });
      useOfflineStore.setState({
        isOnline: false,
        pendingMutations: [pendingMut],
      });

      // Mock a successful mutation execution
      mockSupabaseFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      useOfflineStore.getState().setOnline(true);
      // Give syncAll time to complete (it runs asynchronously)
      await new Promise((r) => setTimeout(r, 100));

      // syncAll should have processed the pending mutation
      expect(useOfflineStore.getState().pendingMutations).toEqual([]);
    });

    it('does not trigger syncAll when going online with no pending mutations', () => {
      useOfflineStore.setState({ isOnline: false, pendingMutations: [] });

      useOfflineStore.getState().setOnline(true);

      // No supabase calls should have been made
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
  });

  // ── addMutation() ──────────────────────────────────────────────
  describe('addMutation()', () => {
    it('adds a mutation to the pending queue', () => {
      useOfflineStore.getState().addMutation(makeMutation());

      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending).toHaveLength(1);
      expect(pending[0].table).toBe('tasks');
      expect(pending[0].operation).toBe('update');
    });

    it('assigns an id and createdAt to the mutation', () => {
      useOfflineStore.getState().addMutation(makeMutation());

      const mutation = useOfflineStore.getState().pendingMutations[0];
      expect(mutation.id).toBeDefined();
      expect(typeof mutation.id).toBe('string');
      expect(mutation.createdAt).toBeDefined();
      expect(typeof mutation.createdAt).toBe('number');
    });

    it('initializes retryCount to 0', () => {
      useOfflineStore.getState().addMutation(makeMutation());

      expect(useOfflineStore.getState().pendingMutations[0].retryCount).toBe(0);
    });

    it('appends multiple mutations in order', () => {
      useOfflineStore.getState().addMutation(makeMutation({ table: 'tasks' }));
      useOfflineStore.getState().addMutation(makeMutation({ table: 'clients' }));
      useOfflineStore.getState().addMutation(makeMutation({ table: 'projects' }));

      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending).toHaveLength(3);
      expect(pending[0].table).toBe('tasks');
      expect(pending[1].table).toBe('clients');
      expect(pending[2].table).toBe('projects');
    });

    it('generates unique ids for each mutation', () => {
      useOfflineStore.getState().addMutation(makeMutation());
      useOfflineStore.getState().addMutation(makeMutation());

      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending[0].id).not.toBe(pending[1].id);
    });
  });

  // ── removeMutation() ──────────────────────────────────────────
  describe('removeMutation()', () => {
    it('removes a specific mutation by id', () => {
      useOfflineStore.setState({
        pendingMutations: [
          makeFullMutation({ id: 'keep-1' }),
          makeFullMutation({ id: 'remove-me' }),
          makeFullMutation({ id: 'keep-2' }),
        ],
      });

      useOfflineStore.getState().removeMutation('remove-me');

      const ids = useOfflineStore.getState().pendingMutations.map((m) => m.id);
      expect(ids).toEqual(['keep-1', 'keep-2']);
    });

    it('does nothing if id is not found', () => {
      useOfflineStore.setState({
        pendingMutations: [makeFullMutation({ id: 'only-one' })],
      });

      useOfflineStore.getState().removeMutation('nonexistent');

      expect(useOfflineStore.getState().pendingMutations).toHaveLength(1);
    });
  });

  // ── clearFailed() ──────────────────────────────────────────────
  describe('clearFailed()', () => {
    it('clears all failed mutations', () => {
      useOfflineStore.setState({
        failedMutations: [
          makeFullMutation({ id: 'failed-1', retryCount: 3 }),
          makeFullMutation({ id: 'failed-2', retryCount: 3 }),
        ],
      });

      useOfflineStore.getState().clearFailed();

      expect(useOfflineStore.getState().failedMutations).toEqual([]);
    });

    it('does nothing when already empty', () => {
      useOfflineStore.getState().clearFailed();

      expect(useOfflineStore.getState().failedMutations).toEqual([]);
    });
  });

  // ── syncAll() ──────────────────────────────────────────────────
  describe('syncAll()', () => {
    it('processes pending mutations in FIFO order', async () => {
      const callOrder: string[] = [];

      const mut1 = makeFullMutation({ id: 'first', table: 'tasks', operation: 'insert' });
      const mut2 = makeFullMutation({ id: 'second', table: 'clients', operation: 'insert' });

      useOfflineStore.setState({ pendingMutations: [mut1, mut2] });

      mockSupabaseFrom.mockImplementation((table: string) => {
        callOrder.push(table);
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      await useOfflineStore.getState().syncAll();

      expect(callOrder).toEqual(['tasks', 'clients']);
    });

    it('removes successful mutations from the queue', async () => {
      useOfflineStore.setState({
        pendingMutations: [makeFullMutation({ id: 'success-1', operation: 'insert' })],
      });

      mockSupabaseFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await useOfflineStore.getState().syncAll();

      expect(useOfflineStore.getState().pendingMutations).toEqual([]);
    });

    it('invalidates cache keys on successful mutation', async () => {
      useOfflineStore.setState({
        pendingMutations: [
          makeFullMutation({
            id: 'cache-test',
            operation: 'insert',
            cacheKeys: ['tasks_list', 'dashboard_stats'],
          }),
        ],
      });

      mockSupabaseFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await useOfflineStore.getState().syncAll();

      expect(mockInvalidateCache).toHaveBeenCalledWith('tasks_list');
      expect(mockInvalidateCache).toHaveBeenCalledWith('dashboard_stats');
    });

    it('increments retryCount on failure', async () => {
      useOfflineStore.setState({
        pendingMutations: [makeFullMutation({ id: 'fail-1', operation: 'update', retryCount: 0 })],
      });

      mockSupabaseFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      });

      await useOfflineStore.getState().syncAll();

      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending).toHaveLength(1);
      expect(pending[0].retryCount).toBe(1);
    });

    it('moves mutation to failed after MAX_RETRIES (3)', async () => {
      useOfflineStore.setState({
        pendingMutations: [makeFullMutation({ id: 'maxed-out', operation: 'update', retryCount: 2 })],
      });

      mockSupabaseFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Persistent error' } }),
        }),
      });

      await useOfflineStore.getState().syncAll();

      expect(useOfflineStore.getState().pendingMutations).toEqual([]);
      const failed = useOfflineStore.getState().failedMutations;
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe('maxed-out');
      expect(failed[0].retryCount).toBe(3);
    });

    it('sets isSyncing=true during sync and false after', async () => {
      let syncingDuringExecution = false;

      useOfflineStore.setState({
        pendingMutations: [makeFullMutation({ id: 'sync-flag', operation: 'insert' })],
      });

      mockSupabaseFrom.mockImplementation(() => {
        syncingDuringExecution = useOfflineStore.getState().isSyncing;
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      await useOfflineStore.getState().syncAll();

      expect(syncingDuringExecution).toBe(true);
      expect(useOfflineStore.getState().isSyncing).toBe(false);
    });

    it('skips if already syncing', async () => {
      useOfflineStore.setState({
        isSyncing: true,
        pendingMutations: [makeFullMutation({ id: 'skip', operation: 'insert' })],
      });

      await useOfflineStore.getState().syncAll();

      // Nothing should have been processed
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
      expect(useOfflineStore.getState().pendingMutations).toHaveLength(1);
    });

    it('skips if offline', async () => {
      useOfflineStore.setState({
        isOnline: false,
        pendingMutations: [makeFullMutation({ id: 'offline', operation: 'insert' })],
      });

      await useOfflineStore.getState().syncAll();

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
      expect(useOfflineStore.getState().pendingMutations).toHaveLength(1);
    });

    it('skips if no pending mutations', async () => {
      useOfflineStore.setState({ pendingMutations: [] });

      await useOfflineStore.getState().syncAll();

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('handles a mix of successful and failing mutations', async () => {
      const mutSuccess = makeFullMutation({ id: 'ok', table: 'tasks', operation: 'insert' });
      const mutFail = makeFullMutation({ id: 'bad', table: 'clients', operation: 'insert', retryCount: 0 });

      useOfflineStore.setState({ pendingMutations: [mutSuccess, mutFail] });

      mockSupabaseFrom.mockImplementation((table: string) => ({
        insert: jest.fn().mockResolvedValue(
          table === 'tasks' ? { error: null } : { error: { message: 'fail' } },
        ),
      }));

      await useOfflineStore.getState().syncAll();

      // Success removed, failure kept with incremented retry
      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('bad');
      expect(pending[0].retryCount).toBe(1);
    });

    it('handles delete operations', async () => {
      useOfflineStore.setState({
        pendingMutations: [
          makeFullMutation({
            id: 'del-1',
            operation: 'delete',
            matchColumn: 'id',
            matchValue: 'task-99',
          }),
        ],
      });

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ delete: mockDelete });

      await useOfflineStore.getState().syncAll();

      expect(mockSupabaseFrom).toHaveBeenCalledWith('tasks');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'task-99');
      expect(useOfflineStore.getState().pendingMutations).toEqual([]);
    });

    it('handles insert operations', async () => {
      useOfflineStore.setState({
        pendingMutations: [
          makeFullMutation({
            id: 'ins-1',
            operation: 'insert',
            data: { title: 'New Task', status: 'pending' },
          }),
        ],
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      await useOfflineStore.getState().syncAll();

      expect(mockSupabaseFrom).toHaveBeenCalledWith('tasks');
      expect(mockInsert).toHaveBeenCalledWith({ title: 'New Task', status: 'pending' });
    });

    it('handles update operations with match column', async () => {
      useOfflineStore.setState({
        pendingMutations: [
          makeFullMutation({
            id: 'upd-1',
            operation: 'update',
            data: { title: 'Updated' },
            matchColumn: 'id',
            matchValue: 'task-42',
          }),
        ],
      });

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

      await useOfflineStore.getState().syncAll();

      expect(mockUpdate).toHaveBeenCalledWith({ title: 'Updated' });
      expect(mockEq).toHaveBeenCalledWith('id', 'task-42');
    });

    it('keeps remaining mutations if connection drops mid-sync', async () => {
      const mut1 = makeFullMutation({ id: 'done', table: 'tasks', operation: 'insert' });
      const mut2 = makeFullMutation({ id: 'remaining', table: 'clients', operation: 'insert' });

      useOfflineStore.setState({ pendingMutations: [mut1, mut2] });

      let callCount = 0;
      mockSupabaseFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First mutation succeeds, but also simulates going offline
          // so the next iteration's online check fails
          return {
            insert: jest.fn().mockImplementation(async () => {
              // After the insert resolves, go offline before next loop iteration
              useOfflineStore.setState({ isOnline: false });
              return { error: null };
            }),
          };
        }
        // Should not reach here because the online check prevents execution
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      });

      await useOfflineStore.getState().syncAll();

      // The second mutation should be kept because we went offline between iterations
      const pending = useOfflineStore.getState().pendingMutations;
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('remaining');
    });

    it('preserves existing failed mutations during sync', async () => {
      const existingFailed = makeFullMutation({ id: 'old-fail', retryCount: 3 });
      const newFailing = makeFullMutation({ id: 'new-fail', operation: 'update', retryCount: 2 });

      useOfflineStore.setState({
        pendingMutations: [newFailing],
        failedMutations: [existingFailed],
      });

      mockSupabaseFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'fail' } }),
        }),
      });

      await useOfflineStore.getState().syncAll();

      const failed = useOfflineStore.getState().failedMutations;
      expect(failed).toHaveLength(2);
      expect(failed.map((f) => f.id)).toContain('old-fail');
      expect(failed.map((f) => f.id)).toContain('new-fail');
    });
  });
});
