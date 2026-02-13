import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@taskline_cache:';
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function setCache(key: string, data: unknown): Promise<void> {
  try {
    const entry: CacheEntry<unknown> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function getCache<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE,
): Promise<{ data: T; timestamp: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    if (age > maxAgeMs) {
      // Expired — remove and return null
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return { data: entry.data, timestamp: entry.timestamp };
  } catch {
    return null;
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // Silently fail
  }
}

export async function updateCacheData<T>(
  key: string,
  updater: (current: T) => T,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return;

    const entry: CacheEntry<T> = JSON.parse(raw);
    entry.data = updater(entry.data);
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Silently fail
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Silently fail
  }
}
