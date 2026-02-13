import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { invalidateCache, updateCacheData } from '@/lib/offlineStorage';
import { useOfflineStore } from '@/stores/offlineStore';

interface MutateParams {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data?: Record<string, any>;
  matchColumn?: string;
  matchValue?: string;
  cacheKeys?: string[];
  optimisticUpdate?: {
    cacheKey: string;
    updater: (current: any) => any;
  };
}

interface MutateResult {
  error: any | null;
  queued?: boolean;
}

export function useOfflineMutation() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const addMutation = useOfflineStore((s) => s.addMutation);
  const pendingCount = useOfflineStore((s) => s.pendingMutations.length);

  const mutate = useCallback(
    async (params: MutateParams): Promise<MutateResult> => {
      const {
        table,
        operation,
        data = {},
        matchColumn = 'id',
        matchValue = '',
        cacheKeys = [],
        optimisticUpdate,
      } = params;

      if (isOnline) {
        // Execute directly
        try {
          let result: { error: any };

          switch (operation) {
            case 'insert':
              result = await supabase.from(table).insert(data as any);
              break;
            case 'update':
              result = await (supabase.from(table) as any)
                .update(data)
                .eq(matchColumn, matchValue);
              break;
            case 'delete':
              result = await (supabase.from(table) as any)
                .delete()
                .eq(matchColumn, matchValue);
              break;
            default:
              return { error: new Error(`Unknown operation: ${operation}`) };
          }

          if (result.error) {
            return { error: result.error };
          }

          // Invalidate caches
          await Promise.all(cacheKeys.map((key) => invalidateCache(key)));

          return { error: null };
        } catch (err) {
          return { error: err };
        }
      } else {
        // Queue for later
        addMutation({
          table,
          operation,
          data,
          matchColumn,
          matchValue,
          cacheKeys,
        });

        // Apply optimistic update to cache
        if (optimisticUpdate) {
          await updateCacheData(
            optimisticUpdate.cacheKey,
            optimisticUpdate.updater,
          );
        }

        return { error: null, queued: true };
      }
    },
    [isOnline, addMutation],
  );

  return { mutate, pendingCount };
}
