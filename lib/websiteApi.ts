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
 * Returns the Stripe Checkout URL and session ID.
 */
export async function createCheckoutSession(tier: string, interval: 'month' | 'year'): Promise<{ url: string; sessionId: string }> {
  const res = await websiteApiFetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Checkout failed (${res.status})`);
  }

  const data = await res.json();
  if (data.url) return { url: data.url, sessionId: data.sessionId };
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

/**
 * Sync the user's Stripe subscription to the database.
 * This is a fallback for when the Stripe webhook hasn't processed yet.
 * Pass `checkoutSessionId` for the most reliable lookup.
 * Returns the current tier slug and subscription status.
 */
export async function syncSubscription(checkoutSessionId?: string): Promise<{ tier: string; status?: string; synced: boolean }> {
  const res = await websiteApiFetch('/api/subscription/sync', {
    method: 'POST',
    body: JSON.stringify({ checkoutSessionId }),
  });

  if (!res.ok) {
    return { tier: 'free', synced: false };
  }

  return res.json();
}

/**
 * Send a counter offer for a booking (propose alternative date/time).
 * Max 3 rounds per booking.
 */
export async function sendCounterOffer(bookingId: string, proposedDate: string, proposedTime: string, message?: string): Promise<{ success: boolean }> {
  const res = await websiteApiFetch(`/api/booking/${bookingId}/counter`, {
    method: 'POST',
    body: JSON.stringify({ proposed_date: proposedDate, proposed_time: proposedTime, message }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Counter offer failed (${res.status})`);
  }

  return res.json();
}

/**
 * Get counter offer history for a booking.
 */
export async function getCounterOffers(bookingId: string): Promise<any[]> {
  const res = await websiteApiFetch(`/api/booking/${bookingId}/counter`, {
    method: 'GET',
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.counterOffers || [];
}

/**
 * Delete the current user's account and all associated data.
 * Calls the website API which uses the service role to remove the auth user.
 */
export async function deleteAccount(): Promise<void> {
  const res = await websiteApiFetch('/api/account/delete', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Account deletion failed (${res.status})`);
  }
}

// ================================================================
// AI Assistant API
// ================================================================

export interface AiAnalysis {
  id: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'cautious' | 'urgent';
  estimated_value: string;
  priority_score: number;
  recommended_actions: { action: string; reason: string }[];
  follow_up_questions: string[];
  status: string;
  feedback?: string | null;
  draft_project?: any;
  auto_response_sent?: boolean;
  project_created?: boolean;
  project_id?: string | null;
}

export interface AiDraftProject {
  name: string;
  description: string;
  budgetTotal: number;
  estimatedDurationDays: number;
  lineItems: { description: string; amount: number; type: 'labor' | 'materials' | 'other' }[];
}

export interface AiDraftTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'backlog';
}

/**
 * Analyze a client request with AI.
 * Returns the analysis (may be cached from a previous run).
 */
export async function analyzeRequest(requestId: string): Promise<{ analysis: AiAnalysis; cached: boolean }> {
  const res = await websiteApiFetch('/api/ai/analyze-request', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Analysis failed (${res.status})`);
  }

  return res.json();
}

/**
 * Generate an AI project draft from a client request.
 */
export async function draftProject(requestId: string, analysisId?: string): Promise<{ draft: AiDraftProject }> {
  const res = await websiteApiFetch('/api/ai/draft-project', {
    method: 'POST',
    body: JSON.stringify({ requestId, analysisId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Draft project failed (${res.status})`);
  }

  return res.json();
}

/**
 * Generate AI-drafted tasks for a project.
 */
export async function draftTasks(projectId: string): Promise<{ tasks: AiDraftTask[] }> {
  const res = await websiteApiFetch('/api/ai/draft-tasks', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Draft tasks failed (${res.status})`);
  }

  return res.json();
}

/**
 * Generate or send a follow-up message to a client.
 * With send=false: returns { draft } with the AI-generated message.
 * With send=true: sends the message and returns { success, messageId }.
 */
export async function respondToClient(
  requestId: string,
  message?: string,
  send?: boolean,
): Promise<{ draft?: string; success?: boolean; messageId?: string }> {
  const res = await websiteApiFetch('/api/ai/respond-to-client', {
    method: 'POST',
    body: JSON.stringify({ requestId, message, send }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Respond failed (${res.status})`);
  }

  return res.json();
}

/**
 * Submit feedback on an AI analysis (helpful / not_helpful).
 */
export async function submitAiFeedback(analysisId: string, feedback: 'helpful' | 'not_helpful'): Promise<void> {
  await (supabase.from('ai_analyses') as any)
    .update({ feedback })
    .eq('id', analysisId);
}
