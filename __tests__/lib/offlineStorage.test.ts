/**
 * Tests for lib/offlineStorage.ts
 * Covers setCache, getCache, invalidateCache, updateCacheData,
 * clearAllCache, and subscribeCacheKey
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setCache,
  getCache,
  invalidateCache,
  updateCacheData,
  clearAllCache,
  subscribeCacheKey,
} from '@/lib/offlineStorage';

const CACHE_PREFIX = '@taskline_cache:';

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// setCache
// ============================================================
describe('setCache', () => {
  it('stores data with cache prefix and timestamp in AsyncStorage', async () => {
    await setCache('myKey', { name: 'test' });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(`${CACHE_PREFIX}myKey`);

    const stored = JSON.parse(call[1]);
    expect(stored.data).toEqual({ name: 'test' });
    expect(typeof stored.timestamp).toBe('number');
  });

  it('stores string data', async () => {
    await setCache('strKey', 'hello');

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(call[1]);
    expect(stored.data).toBe('hello');
  });

  it('stores array data', async () => {
    await setCache('arrKey', [1, 2, 3]);

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(call[1]);
    expect(stored.data).toEqual([1, 2, 3]);
  });

  it('stores null data', async () => {
    await setCache('nullKey', null);

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(call[1]);
    expect(stored.data).toBeNull();
  });

  it('stores numeric data', async () => {
    await setCache('numKey', 42);

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(call[1]);
    expect(stored.data).toBe(42);
  });

  it('silently handles AsyncStorage errors', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));
    // Should not throw
    await expect(setCache('failKey', 'data')).resolves.toBeUndefined();
  });

  it('stores timestamp close to current time', async () => {
    const before = Date.now();
    await setCache('timeKey', 'data');
    const after = Date.now();

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const stored = JSON.parse(call[1]);
    expect(stored.timestamp).toBeGreaterThanOrEqual(before);
    expect(stored.timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================
// getCache
// ============================================================
describe('getCache', () => {
  it('returns cached data within TTL', async () => {
    const entry = { data: { foo: 'bar' }, timestamp: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const result = await getCache('myKey');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ foo: 'bar' });
    expect(result!.timestamp).toBe(entry.timestamp);
  });

  it('returns null for missing keys', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const result = await getCache('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null and removes expired cache', async () => {
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const entry = { data: 'old', timestamp: oldTimestamp };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const result = await getCache('expiredKey');
    expect(result).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}expiredKey`);
  });

  it('respects custom maxAgeMs parameter', async () => {
    const recentTimestamp = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    const entry = { data: 'recent', timestamp: recentTimestamp };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    // With 10 minute maxAge, should return data
    const result = await getCache('key', 10 * 60 * 1000);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('recent');
  });

  it('expires data that exceeds custom maxAgeMs', async () => {
    const oldTimestamp = Date.now() - (15 * 60 * 1000); // 15 minutes ago
    const entry = { data: 'stale', timestamp: oldTimestamp };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    // With 10 minute maxAge, should return null
    const result = await getCache('key', 10 * 60 * 1000);
    expect(result).toBeNull();
  });

  it('ignores expiry when ignoreExpiry flag is true', async () => {
    const veryOldTimestamp = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
    const entry = { data: 'ancient', timestamp: veryOldTimestamp };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const result = await getCache('key', undefined, true);
    expect(result).not.toBeNull();
    expect(result!.data).toBe('ancient');
  });

  it('uses correct cache prefix when reading', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await getCache('testKey');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`${CACHE_PREFIX}testKey`);
  });

  it('returns null on JSON parse errors', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid-json{{{');

    const result = await getCache('badJson');
    expect(result).toBeNull();
  });

  it('returns null on AsyncStorage errors', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Read failed'));

    const result = await getCache('errorKey');
    expect(result).toBeNull();
  });

  it('default TTL is 24 hours', async () => {
    // Data stored 23 hours ago should be valid
    const recentEnough = Date.now() - (23 * 60 * 60 * 1000);
    const entry = { data: 'valid', timestamp: recentEnough };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const result = await getCache('recentKey');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('valid');
  });
});

// ============================================================
// invalidateCache
// ============================================================
describe('invalidateCache', () => {
  it('removes the cache entry from AsyncStorage', async () => {
    await invalidateCache('myKey');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}myKey`);
  });

  it('silently handles removal errors', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));
    await expect(invalidateCache('failKey')).resolves.toBeUndefined();
  });

  it('notifies cache listeners on invalidation', async () => {
    const listener = jest.fn();
    const unsub = subscribeCacheKey('notifyKey', listener);

    await invalidateCache('notifyKey');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does not notify listeners for different keys', async () => {
    const listener = jest.fn();
    const unsub = subscribeCacheKey('otherKey', listener);

    await invalidateCache('differentKey');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ============================================================
// updateCacheData
// ============================================================
describe('updateCacheData', () => {
  it('updates cached data using the updater function', async () => {
    const entry = { data: [1, 2, 3], timestamp: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    await updateCacheData<number[]>('arrKey', (current) => [...current, 4]);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const updated = JSON.parse(call[1]);
    expect(updated.data).toEqual([1, 2, 3, 4]);
    // Timestamp should be preserved from original
    expect(updated.timestamp).toBe(entry.timestamp);
  });

  it('does nothing if key does not exist', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await updateCacheData('missingKey', (data) => data);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('notifies listeners after update', async () => {
    const entry = { data: 'old', timestamp: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const listener = jest.fn();
    const unsub = subscribeCacheKey('updKey', listener);

    await updateCacheData<string>('updKey', () => 'new');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('silently handles AsyncStorage errors', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Read failed'));
    await expect(updateCacheData('failKey', (d) => d)).resolves.toBeUndefined();
  });

  it('uses correct cache prefix', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await updateCacheData('someKey', (d) => d);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`${CACHE_PREFIX}someKey`);
  });

  it('can transform object data', async () => {
    const entry = { data: { count: 5, name: 'test' }, timestamp: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    await updateCacheData<{ count: number; name: string }>('objKey', (current) => ({
      ...current,
      count: current.count + 1,
    }));

    const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const updated = JSON.parse(call[1]);
    expect(updated.data.count).toBe(6);
    expect(updated.data.name).toBe('test');
  });
});

// ============================================================
// clearAllCache
// ============================================================
describe('clearAllCache', () => {
  it('removes all keys with the cache prefix', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([
      `${CACHE_PREFIX}key1`,
      `${CACHE_PREFIX}key2`,
      'other-key',
    ]);

    await clearAllCache();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      `${CACHE_PREFIX}key1`,
      `${CACHE_PREFIX}key2`,
    ]);
  });

  it('does not call multiRemove if no cache keys exist', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(['other-key', 'another-key']);

    await clearAllCache();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('does not call multiRemove if storage is empty', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([]);

    await clearAllCache();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('silently handles errors', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValueOnce(new Error('Keys failed'));
    await expect(clearAllCache()).resolves.toBeUndefined();
  });
});

// ============================================================
// subscribeCacheKey
// ============================================================
describe('subscribeCacheKey', () => {
  it('returns an unsubscribe function', () => {
    const unsub = subscribeCacheKey('key', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('listener is called when cache is invalidated', async () => {
    const listener = jest.fn();
    const unsub = subscribeCacheKey('subKey', listener);

    await invalidateCache('subKey');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('listener is NOT called after unsubscribing', async () => {
    const listener = jest.fn();
    const unsub = subscribeCacheKey('subKey2', listener);

    unsub();
    await invalidateCache('subKey2');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners for the same key', async () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const unsub1 = subscribeCacheKey('multiKey', listener1);
    const unsub2 = subscribeCacheKey('multiKey', listener2);

    await invalidateCache('multiKey');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    unsub1();
    unsub2();
  });

  it('unsubscribing one listener does not affect others', async () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const unsub1 = subscribeCacheKey('multiKey2', listener1);
    const unsub2 = subscribeCacheKey('multiKey2', listener2);

    unsub1();
    await invalidateCache('multiKey2');
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
    unsub2();
  });

  it('listener is called on updateCacheData', async () => {
    const entry = { data: 'val', timestamp: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entry));

    const listener = jest.fn();
    const unsub = subscribeCacheKey('updKey2', listener);

    await updateCacheData('updKey2', () => 'newVal');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('listeners for different keys are independent', async () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubA = subscribeCacheKey('keyA', listenerA);
    const unsubB = subscribeCacheKey('keyB', listenerB);

    await invalidateCache('keyA');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
    unsubA();
    unsubB();
  });
});
