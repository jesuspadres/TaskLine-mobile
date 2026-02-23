/**
 * Tests for authStore (stores/authStore.ts)
 *
 * Tests the Zustand store directly via getState() / setState().
 * Supabase helpers are mocked at the module level.
 */

// ── Mock Supabase before import ──────────────────────────────────
const mockOnAuthStateChange = jest.fn();
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
  },
  signIn: (...args: any[]) => mockSignIn(...args),
  signUp: (...args: any[]) => mockSignUp(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  getSession: (...args: any[]) => mockGetSession(...args),
  getUser: (...args: any[]) => mockGetUser(...args),
}));

import { useAuthStore } from '@/stores/authStore';

// ── Helpers ──────────────────────────────────────────────────────
const fakeUser = { id: 'user-1', email: 'test@example.com' } as any;
const fakeSession = { access_token: 'tok', user: fakeUser } as any;

function resetStore() {
  useAuthStore.setState({
    user: null,
    session: null,
    loading: true,
    initialized: false,
    suppressAuthChange: false,
  });
}

// ── Tests ────────────────────────────────────────────────────────
describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    // Default: onAuthStateChange returns an unsubscribe stub
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  // ── Initial state ──────────────────────────────────────────────
  describe('initial state', () => {
    it('has user as null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('has session as null', () => {
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('has loading as true', () => {
      expect(useAuthStore.getState().loading).toBe(true);
    });

    it('has initialized as false', () => {
      expect(useAuthStore.getState().initialized).toBe(false);
    });

    it('has suppressAuthChange as false', () => {
      expect(useAuthStore.getState().suppressAuthChange).toBe(false);
    });
  });

  // ── initialize() ──────────────────────────────────────────────
  describe('initialize()', () => {
    it('sets user and session when an existing session is found', async () => {
      mockGetSession.mockResolvedValue({ session: fakeSession });
      mockGetUser.mockResolvedValue({ user: fakeUser });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.session).toEqual(fakeSession);
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('sets null user/session and initialized when no session exists', async () => {
      mockGetSession.mockResolvedValue({ session: null });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });

    it('signs out and clears state when refresh token is expired', async () => {
      mockGetSession.mockResolvedValue({ session: fakeSession });
      mockGetUser.mockRejectedValue({
        message: 'Refresh Token has expired',
        status: 401,
      });
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().initialize();

      expect(mockSignOut).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.initialized).toBe(true);
    });

    it('signs out when getUser returns 401 status', async () => {
      mockGetSession.mockResolvedValue({ session: fakeSession });
      mockGetUser.mockRejectedValue({ status: 401, message: 'Unauthorized' });
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().initialize();

      expect(mockSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('does not sign out on non-401 getUser errors', async () => {
      mockGetSession.mockResolvedValue({ session: fakeSession });
      mockGetUser.mockRejectedValue({ status: 500, message: 'Server error' });

      await useAuthStore.getState().initialize();

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it('sets up an auth state change listener', async () => {
      mockGetSession.mockResolvedValue({ session: null });

      await useAuthStore.getState().initialize();

      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
      expect(typeof mockOnAuthStateChange.mock.calls[0][0]).toBe('function');
    });

    it('auth listener updates state when a session arrives', async () => {
      let authCallback: Function = () => {};
      mockOnAuthStateChange.mockImplementation((cb: Function) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      mockGetSession.mockResolvedValue({ session: null });

      await useAuthStore.getState().initialize();

      // Simulate an auth state change event
      authCallback('SIGNED_IN', fakeSession);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.session).toEqual(fakeSession);
    });

    it('auth listener clears state when session is removed', async () => {
      let authCallback: Function = () => {};
      mockOnAuthStateChange.mockImplementation((cb: Function) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      mockGetSession.mockResolvedValue({ session: fakeSession });
      mockGetUser.mockResolvedValue({ user: fakeUser });

      await useAuthStore.getState().initialize();

      // Simulate sign out event
      authCallback('SIGNED_OUT', null);

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('auth listener ignores changes when suppressAuthChange is true', async () => {
      let authCallback: Function = () => {};
      mockOnAuthStateChange.mockImplementation((cb: Function) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      mockGetSession.mockResolvedValue({ session: null });

      await useAuthStore.getState().initialize();

      // Enable suppression
      useAuthStore.getState().setSuppressAuthChange(true);

      // Fire an auth event — should be ignored
      authCallback('SIGNED_IN', fakeSession);

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('handles getSession throwing and still initializes', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
    });
  });

  // ── login() ────────────────────────────────────────────────────
  describe('login()', () => {
    it('sets user, session, and loading=false on success', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await useAuthStore.getState().login('test@example.com', 'pass');

      expect(result.error).toBeNull();
      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.session).toEqual(fakeSession);
      expect(state.loading).toBe(false);
    });

    it('sets loading=true during login', async () => {
      let capturedLoading: boolean | undefined;
      mockSignIn.mockImplementation(() => {
        capturedLoading = useAuthStore.getState().loading;
        return Promise.resolve({
          data: { user: fakeUser, session: fakeSession },
          error: null,
        });
      });

      await useAuthStore.getState().login('test@example.com', 'pass');

      expect(capturedLoading).toBe(true);
    });

    it('returns error and sets loading=false on failure', async () => {
      const authError = new Error('Invalid credentials');
      mockSignIn.mockResolvedValue({ data: {}, error: authError });

      const result = await useAuthStore.getState().login('bad@example.com', 'wrong');

      expect(result.error).toBe(authError);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('passes email and password to signIn', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      await useAuthStore.getState().login('hello@test.com', 'secret123');

      expect(mockSignIn).toHaveBeenCalledWith('hello@test.com', 'secret123');
    });
  });

  // ── register() ─────────────────────────────────────────────────
  describe('register()', () => {
    it('sets user and session when signup returns both', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      const result = await useAuthStore.getState().register('new@example.com', 'pass', 'Test');

      expect(result.error).toBeNull();
      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.session).toEqual(fakeSession);
      expect(state.loading).toBe(false);
    });

    it('only sets loading=false when email confirmation is required (no session)', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: fakeUser, session: null },
        error: null,
      });

      const result = await useAuthStore.getState().register('new@example.com', 'pass');

      expect(result.error).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      // User is NOT set because the condition checks `data.user && data.session`
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('returns error and sets loading=false on registration error', async () => {
      const regError = new Error('Email already taken');
      mockSignUp.mockResolvedValue({ data: {}, error: regError });

      const result = await useAuthStore.getState().register('dup@example.com', 'pass');

      expect(result.error).toBe(regError);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('passes name to signUp function', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      await useAuthStore.getState().register('test@example.com', 'pass', 'Jane');

      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'pass', 'Jane');
    });

    it('calls signUp without name when not provided', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      });

      await useAuthStore.getState().register('test@example.com', 'pass');

      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'pass', undefined);
    });
  });

  // ── logout() ───────────────────────────────────────────────────
  describe('logout()', () => {
    it('clears user, session, and sets loading=false', async () => {
      // Start with a logged-in state
      useAuthStore.setState({
        user: fakeUser,
        session: fakeSession,
        loading: false,
        initialized: true,
      });
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('calls signOut from supabase', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('sets loading=true during logout', async () => {
      let capturedLoading: boolean | undefined;
      mockSignOut.mockImplementation(() => {
        capturedLoading = useAuthStore.getState().loading;
        return Promise.resolve({ error: null });
      });

      await useAuthStore.getState().logout();

      expect(capturedLoading).toBe(true);
    });
  });

  // ── refreshUser() ──────────────────────────────────────────────
  describe('refreshUser()', () => {
    it('updates user in state with fresh data', async () => {
      useAuthStore.setState({ user: fakeUser });
      const updatedUser = { ...fakeUser, email: 'updated@example.com' };
      mockGetUser.mockResolvedValue({ user: updatedUser });

      await useAuthStore.getState().refreshUser();

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('does not clear user if getUser returns null', async () => {
      useAuthStore.setState({ user: fakeUser });
      mockGetUser.mockResolvedValue({ user: null });

      await useAuthStore.getState().refreshUser();

      // User should remain unchanged since the condition is `if (user)`
      expect(useAuthStore.getState().user).toEqual(fakeUser);
    });
  });

  // ── setSuppressAuthChange() ────────────────────────────────────
  describe('setSuppressAuthChange()', () => {
    it('sets suppressAuthChange to true', () => {
      useAuthStore.getState().setSuppressAuthChange(true);
      expect(useAuthStore.getState().suppressAuthChange).toBe(true);
    });

    it('sets suppressAuthChange back to false', () => {
      useAuthStore.getState().setSuppressAuthChange(true);
      useAuthStore.getState().setSuppressAuthChange(false);
      expect(useAuthStore.getState().suppressAuthChange).toBe(false);
    });
  });
});
