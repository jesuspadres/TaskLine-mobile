import { useState, useEffect, useCallback, useRef } from 'react';
import { setCache, getCache } from '@/lib/offlineStorage';
import { useOfflineStore } from '@/stores/offlineStore';

const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface UseOfflineDataOptions {
  deps?: any[];
  maxAge?: number;
  enabled?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  isStale: boolean;
  isOffline: boolean;
  error: string | null;
  refresh: () => void;
}

export function useOfflineData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: UseOfflineDataOptions,
): UseOfflineDataResult<T> {
  const { deps = [], maxAge = DEFAULT_MAX_AGE, enabled = true } = options ?? {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOnline = useOfflineStore((s) => s.isOnline);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCacheAndFetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // 1. Try cache first (when offline, ignore TTL — stale data is better than nothing)
    const cached = await getCache<T>(cacheKey, maxAge, !isOnline);
    if (cached && mountedRef.current) {
      setData(cached.data);
      setIsStale(true);
      setLoading(false);
    }

    // 2. Fetch fresh data if online
    if (isOnline) {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (!cached) {
        // No cache — show loading
      } else {
        setRefreshing(true);
      }

      try {
        const freshData = await fetchFn();
        if (mountedRef.current) {
          setData(freshData);
          setIsStale(false);
          setError(null);
          await setCache(cacheKey, freshData);
        }
      } catch (err: any) {
        if (mountedRef.current) {
          // If we have cached data, keep showing it
          if (!cached) {
            setError(err.message || 'Failed to load data');
          }
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        fetchingRef.current = false;
      }
    } else {
      // Offline — just show cache (or null)
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, isOnline, enabled, ...deps]);

  useEffect(() => {
    loadCacheAndFetch();
  }, [loadCacheAndFetch]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    loadCacheAndFetch();
  }, [loadCacheAndFetch]);

  return { data, loading, refreshing, isStale, isOffline: !isOnline, error, refresh };
}
