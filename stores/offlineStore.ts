import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { invalidateCache } from '@/lib/offlineStorage';

const MAX_RETRIES = 3;

export interface PendingMutation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, any>;
  matchColumn: string;
  matchValue: string;
  cacheKeys: string[];
  createdAt: number;
  retryCount: number;
}

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingMutations: PendingMutation[];
  failedMutations: PendingMutation[];
  setOnline: (online: boolean) => void;
  addMutation: (
    mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retryCount'>,
  ) => void;
  removeMutation: (id: string) => void;
  clearFailed: () => void;
  syncAll: () => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function executeMutation(mutation: PendingMutation): Promise<boolean> {
  try {
    let result: { error: any };

    switch (mutation.operation) {
      case 'insert':
        result = await supabase
          .from(mutation.table)
          .insert(mutation.data as any);
        break;
      case 'update':
        result = await (supabase.from(mutation.table) as any)
          .update(mutation.data)
          .eq(mutation.matchColumn, mutation.matchValue);
        break;
      case 'delete':
        result = await (supabase.from(mutation.table) as any)
          .delete()
          .eq(mutation.matchColumn, mutation.matchValue);
        break;
      default:
        return false;
    }

    if (result.error) {
      return false;
    }

    // Invalidate related caches
    await Promise.all(mutation.cacheKeys.map((key) => invalidateCache(key)));
    return true;
  } catch {
    return false;
  }
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      isSyncing: false,
      pendingMutations: [],
      failedMutations: [],

      setOnline: (online: boolean) => {
        set({ isOnline: online });
        if (online && get().pendingMutations.length > 0) {
          get().syncAll();
        }
      },

      addMutation: (mutation) => {
        const full: PendingMutation = {
          ...mutation,
          id: generateId(),
          createdAt: Date.now(),
          retryCount: 0,
        };
        set((state) => ({
          pendingMutations: [...state.pendingMutations, full],
        }));
      },

      removeMutation: (id: string) => {
        set((state) => ({
          pendingMutations: state.pendingMutations.filter((m) => m.id !== id),
        }));
      },

      clearFailed: () => {
        set({ failedMutations: [] });
      },

      syncAll: async () => {
        const state = get();
        if (state.isSyncing || !state.isOnline || state.pendingMutations.length === 0) {
          return;
        }

        set({ isSyncing: true });

        const remaining: PendingMutation[] = [];
        const failed: PendingMutation[] = [...state.failedMutations];

        for (const mutation of state.pendingMutations) {
          if (!get().isOnline) {
            // Lost connection mid-sync — keep remaining
            remaining.push(mutation);
            continue;
          }

          const success = await executeMutation(mutation);
          if (success) {
            // Done — don't re-add
          } else {
            const updated = { ...mutation, retryCount: mutation.retryCount + 1 };
            if (updated.retryCount >= MAX_RETRIES) {
              failed.push(updated);
            } else {
              remaining.push(updated);
            }
          }
        }

        set({
          pendingMutations: remaining,
          failedMutations: failed,
          isSyncing: false,
        });
      },
    }),
    {
      name: 'taskline-offline-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingMutations: state.pendingMutations,
        failedMutations: state.failedMutations,
      }),
    },
  ),
);
