
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { ENV } from './env';
import type { Database } from './database.types';

// In-memory storage fallback for web/SSR
const memoryStorage: Record<string, string> = {};
const memoryStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return memoryStorage[key] || null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    memoryStorage[key] = value;
  },
  removeItem: async (key: string): Promise<void> => {
    delete memoryStorage[key];
  },
};

// Platform-aware storage adapter
// SecureStore only works on native iOS/Android, not web or SSR
// Uses chunking to handle values > 2048 bytes (SecureStore limit)
const CHUNK_SIZE = 2000;

const createStorageAdapter = () => {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  if (!isNative) {
    return memoryStorageAdapter;
  }

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const SecureStore = require('expo-secure-store');
        if (!SecureStore || typeof SecureStore.getItemAsync !== 'function') {
          return memoryStorage[key] || null;
        }

        // Check if value was chunked
        const chunkCount = await SecureStore.getItemAsync(`${key}__chunks`);
        if (chunkCount) {
          const count = parseInt(chunkCount, 10);
          let value = '';
          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
            if (chunk) value += chunk;
          }
          return value || null;
        }

        // Not chunked — read directly
        return await SecureStore.getItemAsync(key);
      } catch {
        return memoryStorage[key] || null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const SecureStore = require('expo-secure-store');
        if (!SecureStore || typeof SecureStore.setItemAsync !== 'function') {
          memoryStorage[key] = value;
          return;
        }

        // Clean up any previous chunks first
        const oldChunkCount = await SecureStore.getItemAsync(`${key}__chunks`);
        if (oldChunkCount) {
          const count = parseInt(oldChunkCount, 10);
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}__chunks`);
        }

        if (value.length <= CHUNK_SIZE) {
          await SecureStore.setItemAsync(key, value);
        } else {
          // Chunk the value across multiple keys
          const count = Math.ceil(value.length / CHUNK_SIZE);
          for (let i = 0; i < count; i++) {
            await SecureStore.setItemAsync(
              `${key}__chunk_${i}`,
              value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
            );
          }
          await SecureStore.setItemAsync(`${key}__chunks`, String(count));
          // Remove the original key if it existed
          try { await SecureStore.deleteItemAsync(key); } catch {}
        }
      } catch {
        memoryStorage[key] = value;
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        const SecureStore = require('expo-secure-store');
        if (!SecureStore || typeof SecureStore.deleteItemAsync !== 'function') {
          delete memoryStorage[key];
          return;
        }

        // Clean up chunks if they exist
        const chunkCount = await SecureStore.getItemAsync(`${key}__chunks`);
        if (chunkCount) {
          const count = parseInt(chunkCount, 10);
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}__chunks`);
        }

        try { await SecureStore.deleteItemAsync(key); } catch {}
      } catch {
        delete memoryStorage[key];
      }
    },
  };
};

const storageAdapter = createStorageAdapter();

// Create the Supabase client
export const supabase = createSupabaseClient<Database>(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Helper function for components (matches web API)
export function createClient() {
  return supabase;
}

// Auth helper functions
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signUp(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0],
      },
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${ENV.APP_URL}/reset-password`,
  });
  return { data, error };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}
