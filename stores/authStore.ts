import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, signIn, signUp, signOut, getSession, getUser } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  suppressAuthChange: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  register: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSuppressAuthChange: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  suppressAuthChange: false,

  initialize: async () => {
    try {
      set({ loading: true });

      // Get current session
      const { session } = await getSession();

      if (session) {
        try {
          const { user } = await getUser();
          set({ user, session, loading: false, initialized: true });
        } catch (refreshError: any) {
          // Refresh token expired or revoked — clear session and send to login
          if (refreshError?.message?.includes('Refresh Token') || refreshError?.status === 401) {
            await signOut();
          }
          set({ user: null, session: null, loading: false, initialized: true });
        }
      } else {
        set({ user: null, session: null, loading: false, initialized: true });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        // Skip if signup flow is suppressing auth changes (plans step not yet shown)
        if (get().suppressAuthChange) return;

        if (session?.user) {
          set({ user: session.user, session });
        } else {
          set({ user: null, session: null });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ user: null, session: null, loading: false, initialized: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    const { data, error } = await signIn(email, password);

    if (error) {
      set({ loading: false });
      return { error };
    }

    set({
      user: data.user,
      session: data.session,
      loading: false,
    });

    return { error: null };
  },

  register: async (email: string, password: string, name?: string) => {
    set({ loading: true });
    const { data, error } = await signUp(email, password, name);

    if (error) {
      set({ loading: false });
      return { error };
    }

    // For email confirmation flow, user might not be immediately available
    if (data.user && data.session) {
      set({
        user: data.user,
        session: data.session,
        loading: false,
      });
    } else {
      set({ loading: false });
    }

    return { error: null };
  },

  logout: async () => {
    set({ loading: true });
    await signOut();
    set({ user: null, session: null, loading: false });
  },

  refreshUser: async () => {
    const { user } = await getUser();
    if (user) {
      set({ user });
    }
  },

  setSuppressAuthChange: (value: boolean) => {
    set({ suppressAuthChange: value });
  },
}));
