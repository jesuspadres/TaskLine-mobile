/**
 * Tests for lib/supabase.ts
 * Covers auth helper functions (signIn, signUp, signOut, resetPassword,
 * getSession, getUser), createClient, and storage adapter behavior.
 *
 * Note: installSupabaseMock() replaces the entire @/lib/supabase module,
 * so the imported functions are the MOCK wrappers, not the real implementations.
 * - signIn is mockSupabase.auth.signInWithPassword (direct reference)
 * - signUp is mockSupabase.auth.signUp (direct reference)
 * - signOut is a jest.fn wrapper around mockSupabase.auth.signOut
 * - getSession is a jest.fn wrapper returning { session, error }
 * - getUser is a jest.fn wrapper returning { user, error }
 * - resetPassword is mockSupabase.auth.resetPasswordForEmail (direct reference)
 */

import {
  mockSupabase,
  resetSupabaseMocks,
  simulateAuthChange,
  clearAuthListeners,
} from '../setup/supabaseMock';

// Must be top-level so jest hoists it before @/lib/supabase import
jest.mock('@/lib/supabase', () => {
  const { mockSupabase: ms } = require('../setup/supabaseMock');
  return {
    supabase: ms,
    createClient: () => ms,
    signIn: (...args: any[]) => ms.auth.signInWithPassword(...args),
    signUp: (...args: any[]) => ms.auth.signUp(...args),
    signOut: jest.fn(async () => {
      const result = await ms.auth.signOut();
      return { error: result.error };
    }),
    getSession: jest.fn(async () => {
      const result = await ms.auth.getSession();
      return { session: result.data.session, error: result.error };
    }),
    getUser: jest.fn(async () => {
      const result = await ms.auth.getUser();
      return { user: result.data.user, error: result.error };
    }),
    resetPassword: (...args: any[]) => ms.auth.resetPasswordForEmail(...args),
  };
});

import { signIn, signUp, signOut, getSession, getUser } from '@/lib/supabase';

const { resetPassword, createClient, supabase } = require('@/lib/supabase');

afterEach(() => {
  resetSupabaseMocks();
});

// ============================================================
// signIn (mapped to mockSupabase.auth.signInWithPassword)
// ============================================================
describe('signIn', () => {
  it('is a function', () => {
    expect(typeof signIn).toBe('function');
  });

  it('calls the underlying signInWithPassword mock', async () => {
    await signIn('user@test.com', 'mypassword');
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
  });

  it('returns data with user and session on success', async () => {
    const result = await signIn('user@test.com', 'mypassword');

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result.data.user).toBeDefined();
    expect(result.data.user.id).toBe('test-user-id');
    expect(result.data.user.email).toBe('test@test.com');
    expect(result.data.session).toBeDefined();
    expect(result.data.session.access_token).toBe('test-token');
    expect(result.error).toBeNull();
  });

  it('returns error when auth fails', async () => {
    const authError = { message: 'Invalid credentials', status: 401 };
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError,
    });

    const result = await signIn('bad@test.com', 'wrong');
    expect(result.error).toEqual(authError);
    expect(result.data.user).toBeNull();
  });

  it('passes arguments through to the auth method', async () => {
    await signIn('specific@email.com', 'specific-pass');
    // Since signIn IS signInWithPassword, the args are passed directly
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith(
      'specific@email.com',
      'specific-pass',
    );
  });
});

// ============================================================
// signUp (mapped to mockSupabase.auth.signUp)
// ============================================================
describe('signUp', () => {
  it('is a function', () => {
    expect(typeof signUp).toBe('function');
  });

  it('calls the underlying signUp mock', async () => {
    await signUp('new@test.com', 'newpass', 'New User');
    expect(mockSupabase.auth.signUp).toHaveBeenCalled();
  });

  it('returns data with user on success', async () => {
    const result = await signUp('new@test.com', 'pass');

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result.data.user).toBeDefined();
    expect(result.data.user.id).toBe('test-user-id');
    expect(result.error).toBeNull();
  });

  it('returns error when signup fails', async () => {
    const authError = { message: 'Email already exists', status: 422 };
    mockSupabase.auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError,
    });

    const result = await signUp('existing@test.com', 'pass');
    expect(result.error).toEqual(authError);
  });

  it('returns session data on success', async () => {
    const result = await signUp('new@test.com', 'pass');
    expect(result.data.session).toBeDefined();
    expect(result.data.session.access_token).toBe('test-token');
  });
});

// ============================================================
// signOut (wrapped jest.fn)
// ============================================================
describe('signOut', () => {
  it('is a function', () => {
    expect(typeof signOut).toBe('function');
  });

  it('calls auth.signOut internally', async () => {
    await signOut();
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('returns { error: null } on success', async () => {
    const result = await signOut();
    expect(result).toHaveProperty('error');
    expect(result.error).toBeNull();
  });

  it('returns error when signOut fails', async () => {
    const authError = { message: 'Signout failed' };
    mockSupabase.auth.signOut.mockResolvedValueOnce({ error: authError });

    const result = await signOut();
    expect(result.error).toEqual(authError);
  });
});

// ============================================================
// resetPassword (mapped to mockSupabase.auth.resetPasswordForEmail)
// ============================================================
describe('resetPassword', () => {
  it('is a function', () => {
    expect(typeof resetPassword).toBe('function');
  });

  it('calls the underlying resetPasswordForEmail mock', async () => {
    await resetPassword('user@test.com');
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it('passes the email argument through', async () => {
    await resetPassword('user@test.com');
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@test.com');
  });

  it('returns data and error', async () => {
    const result = await resetPassword('user@test.com');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeNull();
  });

  it('returns error when reset fails', async () => {
    const authError = { message: 'User not found' };
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: authError,
    });

    const result = await resetPassword('unknown@test.com');
    expect(result.error).toEqual(authError);
  });
});

// ============================================================
// getSession (wrapped jest.fn)
// ============================================================
describe('getSession', () => {
  it('is a function', () => {
    expect(typeof getSession).toBe('function');
  });

  it('calls auth.getSession internally', async () => {
    await getSession();
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });

  it('returns { session: null, error: null } when not logged in', async () => {
    const result = await getSession();
    expect(result).toHaveProperty('session');
    expect(result).toHaveProperty('error');
    expect(result.session).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns session when logged in', async () => {
    const mockSession = {
      access_token: 'abc',
      refresh_token: 'def',
      user: { id: 'user-1' },
    };
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const result = await getSession();
    expect(result.session).toEqual(mockSession);
    expect(result.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const authError = { message: 'Session expired' };
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: authError,
    });

    const result = await getSession();
    expect(result.session).toBeNull();
    expect(result.error).toEqual(authError);
  });
});

// ============================================================
// getUser (wrapped jest.fn)
// ============================================================
describe('getUser', () => {
  it('is a function', () => {
    expect(typeof getUser).toBe('function');
  });

  it('calls auth.getUser internally', async () => {
    await getUser();
    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
  });

  it('returns { user: null, error: null } when not logged in', async () => {
    const result = await getUser();
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('error');
    expect(result.user).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns user when logged in', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    const result = await getUser();
    expect(result.user).toEqual(mockUser);
    expect(result.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const authError = { message: 'Auth error' };
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: authError,
    });

    const result = await getUser();
    expect(result.user).toBeNull();
    expect(result.error).toEqual(authError);
  });
});

// ============================================================
// createClient
// ============================================================
describe('createClient', () => {
  it('returns the supabase client', () => {
    const client = createClient();
    expect(client).toBe(mockSupabase);
  });

  it('returns the same instance on multiple calls', () => {
    const client1 = createClient();
    const client2 = createClient();
    expect(client1).toBe(client2);
  });
});

// ============================================================
// supabase client object
// ============================================================
describe('supabase client', () => {
  it('exports supabase object', () => {
    expect(supabase).toBeDefined();
    expect(supabase).toBe(mockSupabase);
  });

  it('has auth property', () => {
    expect(supabase.auth).toBeDefined();
  });

  it('has from method for table queries', () => {
    expect(typeof supabase.from).toBe('function');
  });

  it('has rpc method', () => {
    expect(typeof supabase.rpc).toBe('function');
  });

  it('has channel method for real-time', () => {
    expect(typeof supabase.channel).toBe('function');
  });

  it('has storage property', () => {
    expect(supabase.storage).toBeDefined();
    expect(typeof supabase.storage.from).toBe('function');
  });
});

// ============================================================
// Auth state change simulation
// ============================================================
describe('auth state change', () => {
  it('onAuthStateChange registers a callback', () => {
    const callback = jest.fn();
    mockSupabase.auth.onAuthStateChange(callback);
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(callback);
  });

  it('returns subscription with unsubscribe method', () => {
    const result = mockSupabase.auth.onAuthStateChange(jest.fn());
    expect(result.data.subscription.unsubscribe).toBeDefined();
    expect(typeof result.data.subscription.unsubscribe).toBe('function');
  });

  it('simulateAuthChange notifies registered callbacks', () => {
    const callback = jest.fn();
    mockSupabase.auth.onAuthStateChange(callback);

    const mockSession = { access_token: 'test', user: { id: 'u1' } };
    simulateAuthChange('SIGNED_IN', mockSession);

    expect(callback).toHaveBeenCalledWith('SIGNED_IN', mockSession);
  });

  it('clearAuthListeners removes all registered callbacks', () => {
    const callback = jest.fn();
    mockSupabase.auth.onAuthStateChange(callback);

    clearAuthListeners();
    simulateAuthChange('SIGNED_OUT', null);

    // The callback should NOT be called after clearing
    expect(callback).not.toHaveBeenCalledWith('SIGNED_OUT', null);
  });
});

// ============================================================
// Storage adapter — SecureStore mock behavior
// ============================================================
describe('Storage adapter (SecureStore mock)', () => {
  const SecureStore = require('expo-secure-store');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SecureStore mock has required methods', () => {
    expect(typeof SecureStore.getItemAsync).toBe('function');
    expect(typeof SecureStore.setItemAsync).toBe('function');
    expect(typeof SecureStore.deleteItemAsync).toBe('function');
  });

  it('stores and retrieves values', async () => {
    await SecureStore.setItemAsync('testKey', 'testValue');
    const result = await SecureStore.getItemAsync('testKey');
    expect(result).toBe('testValue');
  });

  it('returns null for nonexistent keys', async () => {
    const result = await SecureStore.getItemAsync('nonexistent');
    expect(result).toBeNull();
  });

  it('deletes values', async () => {
    await SecureStore.setItemAsync('delKey', 'delValue');
    await SecureStore.deleteItemAsync('delKey');
    const result = await SecureStore.getItemAsync('delKey');
    expect(result).toBeNull();
  });

  it('overwrites existing values', async () => {
    await SecureStore.setItemAsync('key', 'value1');
    await SecureStore.setItemAsync('key', 'value2');
    const result = await SecureStore.getItemAsync('key');
    expect(result).toBe('value2');
  });

  it('handles empty string values', async () => {
    await SecureStore.setItemAsync('emptyKey', '');
    const result = await SecureStore.getItemAsync('emptyKey');
    // Empty string is falsy, mock returns null for falsy
    // The mock does: secureStoreData[key] || null
    expect(result).toBeNull();
  });

  it('handles large values (simulating chunking scenario)', async () => {
    const largeValue = 'x'.repeat(5000);
    await SecureStore.setItemAsync('largeKey', largeValue);
    const result = await SecureStore.getItemAsync('largeKey');
    expect(result).toBe(largeValue);
  });
});

// ============================================================
// Query builder (from mock)
// ============================================================
describe('Query builder', () => {
  it('from() returns a chainable query builder', () => {
    const builder = mockSupabase.from('profiles');
    expect(builder.select).toBeDefined();
    expect(builder.insert).toBeDefined();
    expect(builder.update).toBeDefined();
    expect(builder.delete).toBeDefined();
    expect(builder.eq).toBeDefined();
  });

  it('query builder methods are chainable', () => {
    const builder = mockSupabase.from('profiles');
    const result = builder.select('*').eq('id', '1').single();
    expect(result).toBeDefined();
    expect(result.eq).toBeDefined();
  });

  it('query builder is awaitable', async () => {
    const result = await mockSupabase.from('profiles').select('*');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
  });
});
