// Secure logging utility — prevents sensitive data from leaking to console
// Matches the website's lib/security.ts pattern

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /credit[_-]?card/i,
  /ssn/i,
  /supabase[_-]?anon/i,
];

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 20) + '...[TRUNCATED]';
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_PATTERNS.some((p) => p.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }
  return value;
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return { message: arg.message, name: arg.name };
    }
    return sanitizeValue(arg);
  });
}

const isDev = __DEV__;

export const secureLog = {
  info: (...args: unknown[]) => {
    if (isDev) console.log('[INFO]', ...formatArgs(args));
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[WARN]', ...formatArgs(args));
  },
  error: (...args: unknown[]) => {
    // Always log errors, but sanitize
    console.error('[ERROR]', ...formatArgs(args));
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[DEBUG]', ...formatArgs(args));
  },
};

// Input sanitization for user-provided text before Supabase queries
export function sanitizeInput(input: string): string {
  if (!input) return '';
  // Remove null bytes
  return input.replace(/\0/g, '').trim();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
