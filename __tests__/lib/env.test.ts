/**
 * Tests for lib/env.ts
 * Covers ENV object structure and validateEnv() function
 */

// The module reads from expo-constants which is mocked in jest.setup.js
// We test the actual module output.

let ENV: typeof import('@/lib/env').ENV;
let validateEnv: typeof import('@/lib/env').validateEnv;

beforeEach(() => {
  jest.resetModules();
  // Suppress console.warn from validateEnv
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const mod = require('@/lib/env');
  ENV = mod.ENV;
  validateEnv = mod.validateEnv;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================
// ENV object
// ============================================================
describe('ENV object', () => {
  it('has SUPABASE_URL key', () => {
    expect(ENV).toHaveProperty('SUPABASE_URL');
    expect(typeof ENV.SUPABASE_URL).toBe('string');
  });

  it('has SUPABASE_ANON_KEY key', () => {
    expect(ENV).toHaveProperty('SUPABASE_ANON_KEY');
    expect(typeof ENV.SUPABASE_ANON_KEY).toBe('string');
  });

  it('has APP_URL key', () => {
    expect(ENV).toHaveProperty('APP_URL');
    expect(typeof ENV.APP_URL).toBe('string');
  });

  it('has GOOGLE_MAPS_API_KEY key', () => {
    expect(ENV).toHaveProperty('GOOGLE_MAPS_API_KEY');
    expect(typeof ENV.GOOGLE_MAPS_API_KEY).toBe('string');
  });

  it('has SENTRY_DSN key', () => {
    expect(ENV).toHaveProperty('SENTRY_DSN');
    expect(typeof ENV.SENTRY_DSN).toBe('string');
  });

  it('SUPABASE_URL is a valid URL', () => {
    expect(ENV.SUPABASE_URL).toMatch(/^https?:\/\//);
  });

  it('SUPABASE_ANON_KEY is a non-empty string', () => {
    expect(ENV.SUPABASE_ANON_KEY.length).toBeGreaterThan(0);
  });

  it('APP_URL is a valid URL', () => {
    expect(ENV.APP_URL).toMatch(/^https?:\/\//);
  });

  it('SENTRY_DSN is a valid Sentry URL', () => {
    expect(ENV.SENTRY_DSN).toMatch(/^https?:\/\//);
    expect(ENV.SENTRY_DSN).toContain('sentry');
  });

  it('ENV does not contain placeholder "your-" values in required fields', () => {
    expect(ENV.SUPABASE_URL).not.toContain('your-');
    expect(ENV.SUPABASE_ANON_KEY).not.toContain('your-');
  });
});

// ============================================================
// validateEnv
// ============================================================
describe('validateEnv', () => {
  it('returns true when all required vars are present', () => {
    const result = validateEnv();
    expect(result).toBe(true);
  });

  it('does not warn about missing Supabase vars when valid', () => {
    validateEnv();
    // console.warn should only have been called for GOOGLE_MAPS_API_KEY if empty
    const calls = (console.warn as jest.Mock).mock.calls;
    const supabaseWarnings = calls.filter((c: any[]) =>
      c[0]?.includes?.('Missing or invalid environment variables'),
    );
    expect(supabaseWarnings).toHaveLength(0);
  });

  it('returns false when SUPABASE_URL is missing', () => {
    jest.resetModules();

    // Override the env module to return empty SUPABASE_URL
    jest.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: {} } },
    }));

    // We need to monkey-patch since ENV is hardcoded
    // Instead, test the function behavior by directly verifying the logic
    // We'll test by temporarily modifying ENV in a controlled way
    const mod = require('@/lib/env');
    const originalUrl = mod.ENV.SUPABASE_URL;
    mod.ENV.SUPABASE_URL = '';

    const result = mod.validateEnv();
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing or invalid'),
    );

    // Restore
    mod.ENV.SUPABASE_URL = originalUrl;
  });

  it('returns false when SUPABASE_ANON_KEY is missing', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const originalKey = mod.ENV.SUPABASE_ANON_KEY;
    mod.ENV.SUPABASE_ANON_KEY = '';

    const result = mod.validateEnv();
    expect(result).toBe(false);

    mod.ENV.SUPABASE_ANON_KEY = originalKey;
  });

  it('returns false when SUPABASE_URL contains placeholder "your-"', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const originalUrl = mod.ENV.SUPABASE_URL;
    mod.ENV.SUPABASE_URL = 'https://your-project.supabase.co';

    const result = mod.validateEnv();
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_URL'),
    );

    mod.ENV.SUPABASE_URL = originalUrl;
  });

  it('returns false when SUPABASE_ANON_KEY contains placeholder "your-"', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const originalKey = mod.ENV.SUPABASE_ANON_KEY;
    mod.ENV.SUPABASE_ANON_KEY = 'your-anon-key';

    const result = mod.validateEnv();
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_ANON_KEY'),
    );

    mod.ENV.SUPABASE_ANON_KEY = originalKey;
  });

  it('warns when GOOGLE_MAPS_API_KEY is empty', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const originalKey = mod.ENV.GOOGLE_MAPS_API_KEY;
    mod.ENV.GOOGLE_MAPS_API_KEY = '';

    mod.validateEnv();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('GOOGLE_MAPS_API_KEY'),
    );

    mod.ENV.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it('still returns true even when GOOGLE_MAPS_API_KEY is empty', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const originalKey = mod.ENV.GOOGLE_MAPS_API_KEY;
    mod.ENV.GOOGLE_MAPS_API_KEY = '';

    // GOOGLE_MAPS_API_KEY is not in the required list,
    // so validateEnv should still return true
    const result = mod.validateEnv();
    expect(result).toBe(true);

    mod.ENV.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it('returns false when both SUPABASE_URL and SUPABASE_ANON_KEY are missing', () => {
    jest.resetModules();
    const mod = require('@/lib/env');
    const origUrl = mod.ENV.SUPABASE_URL;
    const origKey = mod.ENV.SUPABASE_ANON_KEY;
    mod.ENV.SUPABASE_URL = '';
    mod.ENV.SUPABASE_ANON_KEY = '';

    const result = mod.validateEnv();
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_URL'),
    );

    mod.ENV.SUPABASE_URL = origUrl;
    mod.ENV.SUPABASE_ANON_KEY = origKey;
  });
});
