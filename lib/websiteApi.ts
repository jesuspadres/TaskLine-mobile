/**
 * Helpers for making authenticated calls to the TaskLine website API.
 *
 * The website uses cookie-based Supabase SSR auth. We construct the auth cookie
 * from the mobile app's Supabase session and send it via the Cookie header.
 */
import { File as ExpoFile } from 'expo-file-system';
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
    body: JSON.stringify({ tier, interval, source: 'mobile' }),
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
 * Update an existing Stripe subscription (upgrade, downgrade, or change interval).
 * For upgrades that require payment, returns a checkout URL.
 * For downgrades/interval changes, the update is applied immediately or scheduled.
 */
export async function updateSubscription(
  tier: string,
  interval: 'month' | 'year',
): Promise<{ checkoutUrl?: string; success: boolean }> {
  const res = await websiteApiFetch('/api/stripe/update-subscription', {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Update failed (${res.status})`);
  }

  const data = await res.json();
  if (data.requiresCheckout && data.checkoutUrl) {
    return { checkoutUrl: data.checkoutUrl, success: true };
  }
  return { success: true };
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
 * Get the founding member spots counter (public data).
 * Returns how many spots are claimed and remaining.
 */
export async function getFoundingSpots(): Promise<{ claimed: number; total: number; remaining: number }> {
  const res = await websiteApiFetch('/api/founding/spots');

  if (!res.ok) {
    throw new Error(`Failed to fetch founding spots (${res.status})`);
  }

  return res.json();
}

/**
 * Claim a founding member spot. Only works for Free/Pro users
 * who haven't already claimed a spot.
 * Returns the assigned spot number and trial end date.
 */
export async function claimFoundingSpot(): Promise<{
  success: boolean;
  spot_number: number;
  trial_ends_at: string;
}> {
  const res = await websiteApiFetch('/api/founding/claim', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Claim failed (${res.status})`);
  }

  return res.json();
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
 * Reactivate a subscription that was scheduled for cancellation.
 * Calls the website API which updates Stripe and the database.
 */
export async function reactivateSubscription(): Promise<void> {
  const res = await websiteApiFetch('/api/stripe/reactivate-subscription', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Reactivation failed (${res.status})`);
  }
}

/**
 * Cancel the current subscription.
 * Credit-aware: if the customer has credit, the subscription is extended
 * until the credit runs out instead of canceling at period end.
 */
export async function cancelSubscription(): Promise<{
  success: boolean;
  cancelAt: string | null;
  effectiveEndDate: string;
  creditBalance: number;
  cyclesCovered: number;
}> {
  const res = await websiteApiFetch('/api/stripe/cancel-subscription', {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Cancellation failed (${res.status})`);
  }

  return res.json();
}

/**
 * Send a counter offer for a booking (propose alternative date/time).
 * Max 3 rounds per booking.
 */
export async function sendCounterOffer(bookingId: string, proposedDate: string, proposedStartTime: string, proposedEndTime: string, message?: string): Promise<{ success: boolean }> {
  const res = await websiteApiFetch(`/api/booking/${bookingId}/counter`, {
    method: 'POST',
    body: JSON.stringify({ proposedDate, proposedStartTime, proposedEndTime, message }),
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
export interface CounterProposal {
  id: string;
  original_date: string;
  original_start_time: string;
  original_end_time: string;
  proposed_date: string;
  proposed_start_time: string;
  proposed_end_time: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  round_number: number;
  created_at: string;
  responded_at: string | null;
  response_message: string | null;
}

export interface CounterOfferHistory {
  proposals: CounterProposal[];
  canCounter: boolean;
  declinedCount: number;
  maxRounds: number;
}

export async function getCounterOffers(bookingId: string): Promise<CounterOfferHistory> {
  const res = await websiteApiFetch(`/api/booking/${bookingId}/counter`, {
    method: 'GET',
  });

  if (!res.ok) return { proposals: [], canCounter: true, declinedCount: 0, maxRounds: 3 };
  const data = await res.json();
  return {
    proposals: data.proposals || [],
    canCounter: data.canCounter ?? true,
    declinedCount: data.declinedCount ?? 0,
    maxRounds: data.maxRounds ?? 3,
  };
}

// ================================================================
// Request Form Settings
// ================================================================

/**
 * Get timeline options for the client request form.
 */
export async function getRequestFormSettings(userId: string): Promise<{ timeline_options: string[] }> {
  const res = await websiteApiFetch(`/api/request-form-settings?userId=${userId}`);

  if (!res.ok) {
    return { timeline_options: ['ASAP', '1-2 weeks', '1 month', '2-3 months', '3-6 months', 'Flexible'] };
  }

  return res.json();
}

/**
 * Update timeline options for the client request form.
 */
export async function updateRequestFormSettings(timelineOptions: string[]): Promise<{ success: boolean; timeline_options: string[] }> {
  const res = await websiteApiFetch('/api/request-form-settings', {
    method: 'PUT',
    body: JSON.stringify({ timeline_options: timelineOptions }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save (${res.status})`);
  }

  return res.json();
}

// ================================================================
// Branding Settings
// ================================================================

export interface BrandingSettings {
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  show_business_name: boolean;
}

export async function getBrandingSettings(): Promise<{ settings: BrandingSettings; requiresUpgrade?: boolean }> {
  const res = await websiteApiFetch('/api/branding');

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.requiresUpgrade) {
      return {
        settings: { primary_color: '#FFFFFF', accent_color: '#16A34A', logo_url: null, show_business_name: true },
        requiresUpgrade: true,
      };
    }
  }

  if (!res.ok) {
    return {
      settings: { primary_color: '#FFFFFF', accent_color: '#16A34A', logo_url: null, show_business_name: true },
    };
  }

  return res.json();
}

export async function updateBrandingSettings(settings: Omit<BrandingSettings, 'logo_url'>): Promise<BrandingSettings> {
  const res = await websiteApiFetch('/api/branding', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save branding (${res.status})`);
  }

  return res.json();
}

export async function uploadBrandingLogo(uri: string, mimeType: string): Promise<{ logoUrl: string }> {
  const ext = mimeType.split('/')[1] === 'svg+xml' ? 'svg' : mimeType.split('/')[1] || 'png';
  const fileName = `logo.${ext}`;

  // Read file as base64 using new expo-file-system v19 File API
  const file = new ExpoFile(uri);
  const base64 = await file.base64();

  const res = await websiteApiFetch('/api/branding/logo', {
    method: 'POST',
    body: JSON.stringify({ file: base64, mimeType, fileName }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Logo upload failed (${res.status})`);
  }

  return res.json();
}

export async function deleteBrandingLogo(): Promise<void> {
  const res = await websiteApiFetch('/api/branding/logo', { method: 'DELETE' });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Logo removal failed (${res.status})`);
  }
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
// Subscription Preview
// ================================================================

export interface SubscriptionPreview {
  hasSubscription: boolean;
  currentTier: string;
  currentInterval: string;
  newTier: string;
  newInterval: string;
  prorationAmount: number;
  totalDue: number;
  unusedCredit: number;
  accountCredit: number;
  accountCreditApplied: number;
  remainingCredit: number;
  currency: string;
  immediateCharge: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Preview the cost of changing subscription (proration, total due, etc.).
 * Calls the GET endpoint which does NOT modify the subscription.
 */
export async function previewSubscriptionChange(
  tier: string,
  interval: 'month' | 'year',
): Promise<SubscriptionPreview> {
  const res = await websiteApiFetch(
    `/api/stripe/update-subscription?tier=${tier}&interval=${interval}`,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Preview failed (${res.status})`);
  }

  return res.json();
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
