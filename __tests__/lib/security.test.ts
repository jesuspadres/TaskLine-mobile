/**
 * Tests for lib/security.ts
 * Covers secureLog (info/warn/error/debug), sanitizeInput, and isValidEmail
 */

// We need to test both dev and non-dev modes, so we control __DEV__ via module re-import
// The source uses module-level `const isDev = __DEV__` so we set __DEV__ before require

let secureLog: typeof import('@/lib/security').secureLog;
let sanitizeInput: typeof import('@/lib/security').sanitizeInput;
let isValidEmail: typeof import('@/lib/security').isValidEmail;

// Save original console methods and __DEV__
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleDebug = console.debug;
const originalDev = (global as any).__DEV__;

beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.debug = originalConsoleDebug;
  jest.resetModules();
});

afterAll(() => {
  (global as any).__DEV__ = originalDev;
});

function loadSecurityModule(devMode: boolean) {
  jest.resetModules();
  (global as any).__DEV__ = devMode;
  const mod = require('@/lib/security');
  secureLog = mod.secureLog;
  sanitizeInput = mod.sanitizeInput;
  isValidEmail = mod.isValidEmail;
}

// ============================================================
// secureLog
// ============================================================
describe('secureLog', () => {
  describe('in dev mode', () => {
    beforeEach(() => {
      loadSecurityModule(true);
    });

    // --- info ---
    it('info logs with [INFO] prefix in dev', () => {
      secureLog.info('hello');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'hello');
    });

    it('info logs multiple arguments', () => {
      secureLog.info('a', 42, true);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'a', 42, true);
    });

    // --- warn ---
    it('warn logs with [WARN] prefix in dev', () => {
      secureLog.warn('caution');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'caution');
    });

    // --- error ---
    it('error logs with [ERROR] prefix in dev', () => {
      secureLog.error('failure');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'failure');
    });

    // --- debug ---
    it('debug logs with [DEBUG] prefix in dev', () => {
      secureLog.debug('trace');
      expect(console.debug).toHaveBeenCalledWith('[DEBUG]', 'trace');
    });
  });

  describe('in production mode', () => {
    beforeEach(() => {
      loadSecurityModule(false);
    });

    it('info does NOT log in production', () => {
      secureLog.info('should not appear');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('warn does NOT log in production', () => {
      secureLog.warn('should not appear');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('debug does NOT log in production', () => {
      secureLog.debug('should not appear');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('error ALWAYS logs even in production', () => {
      secureLog.error('critical failure');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'critical failure');
    });
  });

  describe('sensitive key sanitization', () => {
    beforeEach(() => {
      loadSecurityModule(true);
    });

    it('redacts "password" key', () => {
      secureLog.info({ password: 'secret123' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { password: '[REDACTED]' });
    });

    it('redacts "token" key', () => {
      secureLog.info({ token: 'abc123' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { token: '[REDACTED]' });
    });

    it('redacts "secret" key', () => {
      secureLog.info({ secret: 'mysecret' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { secret: '[REDACTED]' });
    });

    it('redacts "api_key" key', () => {
      secureLog.info({ api_key: 'key-123' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { api_key: '[REDACTED]' });
    });

    it('redacts "apiKey" key (camelCase)', () => {
      secureLog.info({ apiKey: 'key-456' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { apiKey: '[REDACTED]' });
    });

    it('redacts "authorization" key', () => {
      secureLog.info({ authorization: 'Bearer xxx' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { authorization: '[REDACTED]' });
    });

    it('redacts "cookie" key', () => {
      secureLog.info({ cookie: 'session=abc' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { cookie: '[REDACTED]' });
    });

    it('redacts "session" key', () => {
      secureLog.info({ session: 'sess-123' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { session: '[REDACTED]' });
    });

    it('redacts "credit_card" key', () => {
      secureLog.info({ credit_card: '4111-1111' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { credit_card: '[REDACTED]' });
    });

    it('redacts "creditCard" key (camelCase)', () => {
      secureLog.info({ creditCard: '4111-1111' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { creditCard: '[REDACTED]' });
    });

    it('redacts "ssn" key', () => {
      secureLog.info({ ssn: '123-45-6789' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { ssn: '[REDACTED]' });
    });

    it('redacts "supabase_anon" key', () => {
      secureLog.info({ supabase_anon: 'ey...' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { supabase_anon: '[REDACTED]' });
    });

    it('redacts case-insensitively (e.g. PASSWORD, Token)', () => {
      secureLog.info({ PASSWORD: 'test', Token: 'abc' });
      expect(console.log).toHaveBeenCalledWith('[INFO]', {
        PASSWORD: '[REDACTED]',
        Token: '[REDACTED]',
      });
    });

    it('does NOT redact non-sensitive keys', () => {
      secureLog.info({ name: 'John', age: 30 });
      expect(console.log).toHaveBeenCalledWith('[INFO]', { name: 'John', age: 30 });
    });

    it('redacts nested sensitive keys', () => {
      secureLog.info({ user: { name: 'John', password: 'pass' } });
      expect(console.log).toHaveBeenCalledWith('[INFO]', {
        user: { name: 'John', password: '[REDACTED]' },
      });
    });

    it('handles mixed sensitive and non-sensitive keys', () => {
      secureLog.info({ email: 'test@test.com', api_key: 'secret', count: 5 });
      expect(console.log).toHaveBeenCalledWith('[INFO]', {
        email: 'test@test.com',
        api_key: '[REDACTED]',
        count: 5,
      });
    });
  });

  describe('string truncation', () => {
    beforeEach(() => {
      loadSecurityModule(true);
    });

    it('truncates strings longer than 100 characters', () => {
      const longString = 'a'.repeat(150);
      secureLog.info(longString);
      // first 20 chars + ...[TRUNCATED]
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'a'.repeat(20) + '...[TRUNCATED]');
    });

    it('does NOT truncate strings of exactly 100 characters', () => {
      const exactString = 'b'.repeat(100);
      secureLog.info(exactString);
      expect(console.log).toHaveBeenCalledWith('[INFO]', exactString);
    });

    it('does NOT truncate strings shorter than 100 characters', () => {
      const shortString = 'c'.repeat(50);
      secureLog.info(shortString);
      expect(console.log).toHaveBeenCalledWith('[INFO]', shortString);
    });

    it('truncates strings at exactly 101 characters', () => {
      const str101 = 'd'.repeat(101);
      secureLog.info(str101);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'd'.repeat(20) + '...[TRUNCATED]');
    });

    it('truncates long string values inside objects', () => {
      const longVal = 'x'.repeat(200);
      secureLog.info({ description: longVal });
      expect(console.log).toHaveBeenCalledWith('[INFO]', {
        description: 'x'.repeat(20) + '...[TRUNCATED]',
      });
    });
  });

  describe('Error object formatting', () => {
    beforeEach(() => {
      loadSecurityModule(true);
    });

    it('formats Error objects into { message, name }', () => {
      const err = new Error('something broke');
      secureLog.error(err);
      expect(console.error).toHaveBeenCalledWith('[ERROR]', {
        message: 'something broke',
        name: 'Error',
      });
    });

    it('formats TypeError correctly', () => {
      const err = new TypeError('cannot read property');
      secureLog.error(err);
      expect(console.error).toHaveBeenCalledWith('[ERROR]', {
        message: 'cannot read property',
        name: 'TypeError',
      });
    });

    it('formats custom error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const err = new CustomError('custom issue');
      secureLog.error(err);
      expect(console.error).toHaveBeenCalledWith('[ERROR]', {
        message: 'custom issue',
        name: 'CustomError',
      });
    });

    it('handles Error mixed with other args', () => {
      const err = new Error('oops');
      secureLog.error('Context:', err, 42);
      expect(console.error).toHaveBeenCalledWith(
        '[ERROR]',
        'Context:',
        { message: 'oops', name: 'Error' },
        42,
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      loadSecurityModule(true);
    });

    it('handles null argument', () => {
      secureLog.info(null);
      expect(console.log).toHaveBeenCalledWith('[INFO]', null);
    });

    it('handles undefined argument', () => {
      secureLog.info(undefined);
      expect(console.log).toHaveBeenCalledWith('[INFO]', undefined);
    });

    it('handles number argument', () => {
      secureLog.info(42);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 42);
    });

    it('handles boolean argument', () => {
      secureLog.info(true);
      expect(console.log).toHaveBeenCalledWith('[INFO]', true);
    });

    it('handles empty object', () => {
      secureLog.info({});
      expect(console.log).toHaveBeenCalledWith('[INFO]', {});
    });

    it('handles no arguments', () => {
      secureLog.info();
      expect(console.log).toHaveBeenCalledWith('[INFO]');
    });
  });
});

// ============================================================
// sanitizeInput
// ============================================================
describe('sanitizeInput', () => {
  beforeEach(() => {
    loadSecurityModule(true);
  });

  it('removes null bytes from input', () => {
    expect(sanitizeInput('hello\0world')).toBe('helloworld');
  });

  it('removes multiple null bytes', () => {
    expect(sanitizeInput('\0a\0b\0c\0')).toBe('abc');
  });

  it('trims leading whitespace', () => {
    expect(sanitizeInput('  hello')).toBe('hello');
  });

  it('trims trailing whitespace', () => {
    expect(sanitizeInput('hello  ')).toBe('hello');
  });

  it('trims both leading and trailing whitespace', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('returns empty string for null-ish input (undefined cast)', () => {
    expect(sanitizeInput(undefined as any)).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(sanitizeInput(null as any)).toBe('');
  });

  it('passes through normal strings unchanged', () => {
    expect(sanitizeInput('normal text')).toBe('normal text');
  });

  it('handles strings with only whitespace', () => {
    expect(sanitizeInput('   ')).toBe('');
  });

  it('handles strings with only null bytes', () => {
    expect(sanitizeInput('\0\0\0')).toBe('');
  });

  it('removes null bytes AND trims whitespace', () => {
    expect(sanitizeInput('  hello\0world  ')).toBe('helloworld');
  });

  it('preserves internal spaces while trimming ends', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world');
  });

  it('handles special characters (non-null)', () => {
    expect(sanitizeInput('hello@#$%^&*()')).toBe('hello@#$%^&*()');
  });

  it('handles unicode characters', () => {
    expect(sanitizeInput('  hola mundo  ')).toBe('hola mundo');
  });

  it('handles tabs and newlines (only null bytes removed, trimming handles whitespace)', () => {
    expect(sanitizeInput('\thello\n')).toBe('hello');
  });
});

// ============================================================
// isValidEmail
// ============================================================
describe('isValidEmail', () => {
  beforeEach(() => {
    loadSecurityModule(true);
  });

  // Valid emails
  it('returns true for standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('returns true for email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('returns true for email with plus sign', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('returns true for email with dots in local part', () => {
    expect(isValidEmail('first.last@example.com')).toBe(true);
  });

  it('returns true for email with hyphens in domain', () => {
    expect(isValidEmail('user@my-company.com')).toBe(true);
  });

  it('returns true for email with numbers', () => {
    expect(isValidEmail('user123@example456.com')).toBe(true);
  });

  // Invalid emails
  it('returns false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false for string without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('returns false for string with no domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('returns false for string with no local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('returns false for string with no TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('returns false for email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('returns false for email with space in domain', () => {
    expect(isValidEmail('user@exam ple.com')).toBe(false);
  });

  it('returns false for double @', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
  });

  it('returns false for just @', () => {
    expect(isValidEmail('@')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isValidEmail('not an email')).toBe(false);
  });
});
