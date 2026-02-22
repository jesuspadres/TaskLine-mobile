/**
 * Supabase client mock for testing
 * Provides chainable query builder pattern matching the real client
 */

type MockResponse = { data: any; error: any; count?: number };

// Default success response
const defaultResponse: MockResponse = { data: null, error: null };

// Store for controlling mock responses
let nextResponse: MockResponse = { ...defaultResponse };

export function setMockResponse(data: any, error: any = null) {
  nextResponse = { data, error };
}

export function resetMockResponse() {
  nextResponse = { ...defaultResponse };
}

// Chainable query builder
function createQueryBuilder() {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    csv: jest.fn().mockReturnThis(),
    // Terminal — resolves the chain
    then: jest.fn((resolve: any) => resolve({ ...nextResponse })),
  };

  // Make it thenable (awaitable)
  Object.defineProperty(builder, 'then', {
    value: (resolve: any, reject?: any) => {
      try {
        return Promise.resolve({ ...nextResponse }).then(resolve, reject);
      } catch (err) {
        if (reject) return reject(err);
        throw err;
      }
    },
    writable: true,
    configurable: true,
  });

  return builder;
}

// Channel mock for real-time subscriptions
function createChannelMock() {
  return {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    unsubscribe: jest.fn(),
  };
}

// Auth mock
const authListeners: Array<(event: string, session: any) => void> = [];

const authMock = {
  signInWithPassword: jest.fn(() => Promise.resolve({
    data: {
      user: { id: 'test-user-id', email: 'test@test.com', user_metadata: { name: 'Test User' } },
      session: { access_token: 'test-token', refresh_token: 'test-refresh', user: { id: 'test-user-id', email: 'test@test.com' } },
    },
    error: null,
  })),
  signUp: jest.fn(() => Promise.resolve({
    data: {
      user: { id: 'test-user-id', email: 'test@test.com', user_metadata: { name: 'Test User' } },
      session: { access_token: 'test-token', refresh_token: 'test-refresh', user: { id: 'test-user-id', email: 'test@test.com' } },
    },
    error: null,
  })),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  getSession: jest.fn(() => Promise.resolve({
    data: { session: null },
    error: null,
  })),
  getUser: jest.fn(() => Promise.resolve({
    data: { user: null },
    error: null,
  })),
  resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  onAuthStateChange: jest.fn((callback: any) => {
    authListeners.push(callback);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

// Simulate auth state change (for testing)
export function simulateAuthChange(event: string, session: any) {
  authListeners.forEach((cb) => cb(event, session));
}

export function clearAuthListeners() {
  authListeners.length = 0;
}

// The mock Supabase client
export const mockSupabase = {
  from: jest.fn(() => createQueryBuilder()),
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  channel: jest.fn(() => createChannelMock()),
  removeChannel: jest.fn(),
  auth: authMock,
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: { path: 'test/path' }, error: null })),
      download: jest.fn(() => Promise.resolve({ data: new Blob(), error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/test' } })),
      remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
      list: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
};

// Install the mock — call this in your test file
export function installSupabaseMock() {
  jest.mock('@/lib/supabase', () => ({
    supabase: mockSupabase,
    createClient: () => mockSupabase,
    signIn: mockSupabase.auth.signInWithPassword,
    signUp: mockSupabase.auth.signUp,
    signOut: jest.fn(async () => {
      const result = await mockSupabase.auth.signOut();
      return { error: result.error };
    }),
    getSession: jest.fn(async () => {
      const result = await mockSupabase.auth.getSession();
      return { session: result.data.session, error: result.error };
    }),
    getUser: jest.fn(async () => {
      const result = await mockSupabase.auth.getUser();
      return { user: result.data.user, error: result.error };
    }),
    resetPassword: mockSupabase.auth.resetPasswordForEmail,
  }));
}

// Reset all mocks between tests
export function resetSupabaseMocks() {
  resetMockResponse();
  clearAuthListeners();
  jest.clearAllMocks();
}
