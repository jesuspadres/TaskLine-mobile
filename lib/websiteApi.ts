/**
 * Helpers for making authenticated calls to the TaskLine website API.
 *
 * The website uses cookie-based Supabase SSR auth. We construct the auth cookie
 * from the mobile app's Supabase session and send it via the Cookie header.
 */
import { supabase } from './supabase';
import { ENV } from './env';

const COOKIE_NAME = 'sb-iwqifenyzmzxrmftyrjr-auth-token';
const CHUNK_SIZE = 3500;

/**
 * Build the Cookie header string from the current Supabase session.
 * Supports chunking if the session token is too large for a single cookie.
 */
async function buildAuthCookie(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });

  // URL-encode the value (matching how @supabase/ssr stores cookies)
  const encoded = encodeURIComponent(sessionJson);

  if (encoded.length <= CHUNK_SIZE) {
    return `${COOKIE_NAME}=${encoded}`;
  }

  // Chunk the cookie value for large sessions
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
    chunks.push(`${COOKIE_NAME}.${chunks.length}=${encoded.slice(i, i + CHUNK_SIZE)}`);
  }
  return chunks.join('; ');
}

/**
 * Make an authenticated fetch call to the TaskLine website API.
 */
export async function websiteApiFetch(path: string, options?: RequestInit): Promise<Response> {
  const cookie = await buildAuthCookie();
  const url = `${ENV.APP_URL}${path}`;

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      ...(options?.headers || {}),
    },
  });
}

/**
 * Create a Stripe Checkout session for subscribing to a plan.
 * Returns the Stripe Checkout URL.
 */
export async function createCheckoutSession(tier: string, interval: 'month' | 'year'): Promise<string> {
  const res = await websiteApiFetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Checkout failed (${res.status})`);
  }

  const data = await res.json();
  if (data.url) return data.url;
  throw new Error('No checkout URL returned');
}

/**
 * Create a Stripe Billing Portal session for managing subscription.
 * Returns the Stripe Portal URL.
 */
export async function createPortalSession(): Promise<string> {
  const res = await websiteApiFetch('/api/stripe/create-portal-session', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Portal failed (${res.status})`);
  }

  const data = await res.json();
  if (data.url) return data.url;
  throw new Error('No portal URL returned');
}

/**
 * Create a Stripe Checkout session for founding members to lock in their discount.
 * Returns the Stripe Checkout URL.
 */
export async function createFoundingLockInSession(): Promise<string> {
  const res = await websiteApiFetch('/api/founding/lock-in-discount', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lock-in failed (${res.status})`);
  }

  const data = await res.json();
  if (data.url) return data.url;
  throw new Error('No checkout URL returned');
}

/**
 * Create a Stripe Connect Dashboard login link.
 * Returns the Stripe Dashboard URL.
 */
export async function createConnectDashboardSession(): Promise<string> {
  const res = await websiteApiFetch('/api/stripe/connect/dashboard', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Dashboard failed (${res.status})`);
  }

  const data = await res.json();
  if (data.url) return data.url;
  throw new Error('No dashboard URL returned');
}
