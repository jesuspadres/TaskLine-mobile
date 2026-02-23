/**
 * Tests for lib/websiteApi.ts
 * Covers all exported API functions: createCheckoutSession, updateSubscription,
 * createPortalSession, createFoundingLockInSession, createConnectDashboardSession,
 * syncSubscription, reactivateSubscription, cancelSubscription,
 * sendCounterOffer, getCounterOffers, deleteAccount,
 * previewSubscriptionChange, analyzeRequest, draftProject, draftTasks,
 * respondToClient, submitAiFeedback, websiteApiFetch
 */

import {
  mockSupabase,
  resetSupabaseMocks,
} from '../setup/supabaseMock';

// Must be top-level so jest hoists it before websiteApi import
jest.mock('@/lib/supabase', () => {
  // Lazy require to get the mock after initialization
  const { mockSupabase: ms } = require('../setup/supabaseMock');
  return {
    supabase: ms,
    signIn: ms.auth.signInWithPassword,
    signUp: ms.auth.signUp,
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
    resetPassword: ms.auth.resetPasswordForEmail,
  };
});

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import {
  websiteApiFetch,
  createCheckoutSession,
  updateSubscription,
  createPortalSession,
  createFoundingLockInSession,
  createConnectDashboardSession,
  syncSubscription,
  reactivateSubscription,
  cancelSubscription,
  sendCounterOffer,
  getCounterOffers,
  deleteAccount,
  previewSubscriptionChange,
  analyzeRequest,
  draftProject,
  draftTasks,
  respondToClient,
  submitAiFeedback,
} from '@/lib/websiteApi';

// Helper to create a mock Response
function mockResponse(body: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    bytes: jest.fn(),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Mock getSession to return a valid session for buildAuthCookie
  mockSupabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: 9999999999,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-1', email: 'test@test.com' },
      },
    },
    error: null,
  });
});

afterEach(() => {
  resetSupabaseMocks();
});

// ============================================================
// websiteApiFetch
// ============================================================
describe('websiteApiFetch', () => {
  it('makes a fetch call with Cookie header from session', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await websiteApiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test');
    expect(options.headers).toHaveProperty('Cookie');
    expect(options.headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('throws when not authenticated (no session)', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(websiteApiFetch('/api/test')).rejects.toThrow('Not authenticated');
  });

  it('passes custom options through to fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await websiteApiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ key: 'value' }));
  });

  it('merges custom headers with default headers', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await websiteApiFetch('/api/test', {
      headers: { 'X-Custom': 'value' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Custom']).toBe('value');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Cookie']).toBeDefined();
  });
});

// ============================================================
// createCheckoutSession
// ============================================================
describe('createCheckoutSession', () => {
  it('calls the correct endpoint with tier and interval', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: 'https://checkout.stripe.com/session', sessionId: 'cs_123' }),
    );

    const result = await createCheckoutSession('pro', 'month');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/stripe/create-checkout-session');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.tier).toBe('pro');
    expect(body.interval).toBe('month');
    expect(body.source).toBe('mobile');
    expect(result.url).toBe('https://checkout.stripe.com/session');
    expect(result.sessionId).toBe('cs_123');
  });

  it('throws when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Payment failed' }, false, 400),
    );

    await expect(createCheckoutSession('pro', 'month')).rejects.toThrow('Payment failed');
  });

  it('throws when no URL returned', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ sessionId: 'cs_123' }));

    await expect(createCheckoutSession('pro', 'month')).rejects.toThrow(
      'No checkout URL returned',
    );
  });

  it('throws with status code when error body parse fails', async () => {
    const badResponse = {
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new Error('parse fail')),
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(badResponse);

    await expect(createCheckoutSession('pro', 'month')).rejects.toThrow('Checkout failed (500)');
  });
});

// ============================================================
// updateSubscription
// ============================================================
describe('updateSubscription', () => {
  it('calls the correct endpoint with tier and interval', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    const result = await updateSubscription('plus', 'year');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/stripe/update-subscription');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.tier).toBe('plus');
    expect(body.interval).toBe('year');
    expect(result.success).toBe(true);
  });

  it('returns checkoutUrl when upgrade requires payment', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ requiresCheckout: true, checkoutUrl: 'https://checkout.url' }),
    );

    const result = await updateSubscription('business', 'month');
    expect(result.checkoutUrl).toBe('https://checkout.url');
    expect(result.success).toBe(true);
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Update failed' }, false, 400),
    );

    await expect(updateSubscription('pro', 'month')).rejects.toThrow('Update failed');
  });
});

// ============================================================
// createPortalSession
// ============================================================
describe('createPortalSession', () => {
  it('returns portal URL on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: 'https://billing.stripe.com/portal' }),
    );

    const url = await createPortalSession();
    expect(url).toBe('https://billing.stripe.com/portal');
  });

  it('throws when no URL returned', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await expect(createPortalSession()).rejects.toThrow('No portal URL returned');
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Portal unavailable' }, false, 500),
    );

    await expect(createPortalSession()).rejects.toThrow('Portal unavailable');
  });
});

// ============================================================
// createFoundingLockInSession
// ============================================================
describe('createFoundingLockInSession', () => {
  it('returns checkout URL on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: 'https://checkout.stripe.com/founding' }),
    );

    const url = await createFoundingLockInSession();
    expect(url).toBe('https://checkout.stripe.com/founding');
  });

  it('throws when no URL returned', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await expect(createFoundingLockInSession()).rejects.toThrow('No checkout URL returned');
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Lock-in expired' }, false, 400),
    );

    await expect(createFoundingLockInSession()).rejects.toThrow('Lock-in expired');
  });
});

// ============================================================
// createConnectDashboardSession
// ============================================================
describe('createConnectDashboardSession', () => {
  it('returns dashboard URL on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: 'https://connect.stripe.com/dashboard' }),
    );

    const url = await createConnectDashboardSession();
    expect(url).toBe('https://connect.stripe.com/dashboard');
  });

  it('throws when no URL returned', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await expect(createConnectDashboardSession()).rejects.toThrow('No dashboard URL returned');
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Dashboard unavailable' }, false, 500),
    );

    await expect(createConnectDashboardSession()).rejects.toThrow('Dashboard unavailable');
  });
});

// ============================================================
// syncSubscription
// ============================================================
describe('syncSubscription', () => {
  it('returns sync result on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ tier: 'pro', status: 'active', synced: true }),
    );

    const result = await syncSubscription('cs_session_123');
    expect(result.tier).toBe('pro');
    expect(result.synced).toBe(true);
  });

  it('sends checkoutSessionId in body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ tier: 'pro', synced: true }));

    await syncSubscription('cs_123');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.checkoutSessionId).toBe('cs_123');
  });

  it('returns free tier fallback on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({}, false, 500),
    );

    const result = await syncSubscription();
    expect(result.tier).toBe('free');
    expect(result.synced).toBe(false);
  });

  it('works without checkoutSessionId parameter', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ tier: 'free', synced: true }),
    );

    const result = await syncSubscription();
    expect(result.synced).toBe(true);
  });
});

// ============================================================
// reactivateSubscription
// ============================================================
describe('reactivateSubscription', () => {
  it('calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, true));

    await reactivateSubscription();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/stripe/reactivate-subscription');
    expect(options.method).toBe('POST');
  });

  it('does not throw on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));
    await expect(reactivateSubscription()).resolves.toBeUndefined();
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Cannot reactivate' }, false, 400),
    );

    await expect(reactivateSubscription()).rejects.toThrow('Cannot reactivate');
  });
});

// ============================================================
// cancelSubscription
// ============================================================
describe('cancelSubscription', () => {
  it('returns cancellation details on success', async () => {
    const cancellationData = {
      success: true,
      cancelAt: '2024-12-31',
      effectiveEndDate: '2024-12-31',
      creditBalance: 0,
      cyclesCovered: 0,
    };
    mockFetch.mockResolvedValueOnce(mockResponse(cancellationData));

    const result = await cancelSubscription();
    expect(result.success).toBe(true);
    expect(result.cancelAt).toBe('2024-12-31');
    expect(result.effectiveEndDate).toBe('2024-12-31');
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Cancellation failed' }, false, 500),
    );

    await expect(cancelSubscription()).rejects.toThrow('Cancellation failed');
  });
});

// ============================================================
// sendCounterOffer
// ============================================================
describe('sendCounterOffer', () => {
  it('calls the correct endpoint with booking ID', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    await sendCounterOffer('booking-123', '2024-03-15', '14:00', 'How about this?');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/booking/booking-123/counter');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.proposed_date).toBe('2024-03-15');
    expect(body.proposed_time).toBe('14:00');
    expect(body.message).toBe('How about this?');
  });

  it('works without optional message', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    await sendCounterOffer('booking-123', '2024-03-15', '14:00');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBeUndefined();
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Max counter offers reached' }, false, 400),
    );

    await expect(
      sendCounterOffer('booking-123', '2024-03-15', '14:00'),
    ).rejects.toThrow('Max counter offers reached');
  });
});

// ============================================================
// getCounterOffers
// ============================================================
describe('getCounterOffers', () => {
  it('returns counter offers array on success', async () => {
    const offers = [
      { id: '1', proposed_date: '2024-03-15' },
      { id: '2', proposed_date: '2024-03-16' },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse({ counterOffers: offers }));

    const result = await getCounterOffers('booking-123');
    expect(result).toEqual(offers);
  });

  it('uses GET method', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ counterOffers: [] }));

    await getCounterOffers('booking-123');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('GET');
  });

  it('returns empty array on error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false, 500));

    const result = await getCounterOffers('booking-123');
    expect(result).toEqual([]);
  });

  it('returns empty array when counterOffers field is missing', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    const result = await getCounterOffers('booking-123');
    expect(result).toEqual([]);
  });
});

// ============================================================
// deleteAccount
// ============================================================
describe('deleteAccount', () => {
  it('calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await deleteAccount();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/account/delete');
    expect(options.method).toBe('POST');
  });

  it('does not throw on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));
    await expect(deleteAccount()).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Deletion failed' }, false, 500),
    );

    await expect(deleteAccount()).rejects.toThrow('Deletion failed');
  });
});

// ============================================================
// previewSubscriptionChange
// ============================================================
describe('previewSubscriptionChange', () => {
  it('calls the GET endpoint with query params', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        hasSubscription: true,
        currentTier: 'pro',
        newTier: 'plus',
        totalDue: 3000,
        currency: 'usd',
      }),
    );

    const result = await previewSubscriptionChange('plus', 'month');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('tier=plus');
    expect(url).toContain('interval=month');
    expect(result.currentTier).toBe('pro');
    expect(result.newTier).toBe('plus');
    expect(result.totalDue).toBe(3000);
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Preview failed' }, false, 400),
    );

    await expect(previewSubscriptionChange('plus', 'month')).rejects.toThrow('Preview failed');
  });
});

// ============================================================
// analyzeRequest
// ============================================================
describe('analyzeRequest', () => {
  it('calls the correct endpoint with requestId', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        analysis: { id: 'a-1', summary: 'Plumbing job', sentiment: 'neutral' },
        cached: false,
      }),
    );

    const result = await analyzeRequest('req-123');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.requestId).toBe('req-123');
    expect(result.analysis.summary).toBe('Plumbing job');
    expect(result.cached).toBe(false);
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Analysis failed' }, false, 500),
    );

    await expect(analyzeRequest('req-123')).rejects.toThrow('Analysis failed');
  });
});

// ============================================================
// draftProject
// ============================================================
describe('draftProject', () => {
  it('calls the correct endpoint with requestId and optional analysisId', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        draft: { name: 'Plumbing Fix', budgetTotal: 500, lineItems: [] },
      }),
    );

    const result = await draftProject('req-123', 'analysis-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requestId).toBe('req-123');
    expect(body.analysisId).toBe('analysis-1');
    expect(result.draft.name).toBe('Plumbing Fix');
  });

  it('works without analysisId', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ draft: { name: 'Project', budgetTotal: 100, lineItems: [] } }),
    );

    await draftProject('req-123');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requestId).toBe('req-123');
    expect(body.analysisId).toBeUndefined();
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Draft project failed' }, false, 500),
    );

    await expect(draftProject('req-123')).rejects.toThrow('Draft project failed');
  });
});

// ============================================================
// draftTasks
// ============================================================
describe('draftTasks', () => {
  it('calls the correct endpoint with projectId', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        tasks: [{ title: 'Task 1', status: 'backlog', priority: 'medium' }],
      }),
    );

    const result = await draftTasks('proj-123');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.projectId).toBe('proj-123');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Task 1');
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Draft tasks failed' }, false, 500),
    );

    await expect(draftTasks('proj-123')).rejects.toThrow('Draft tasks failed');
  });
});

// ============================================================
// respondToClient
// ============================================================
describe('respondToClient', () => {
  it('returns draft when send is false', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ draft: 'Thank you for reaching out...' }),
    );

    const result = await respondToClient('req-123', undefined, false);
    expect(result.draft).toBe('Thank you for reaching out...');
  });

  it('returns success when send is true', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, messageId: 'msg-456' }),
    );

    const result = await respondToClient('req-123', 'Custom message', true);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-456');
  });

  it('sends correct body with all params', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    await respondToClient('req-123', 'My message', true);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requestId).toBe('req-123');
    expect(body.message).toBe('My message');
    expect(body.send).toBe(true);
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Respond failed' }, false, 500),
    );

    await expect(respondToClient('req-123')).rejects.toThrow('Respond failed');
  });
});

// ============================================================
// submitAiFeedback
// ============================================================
describe('submitAiFeedback', () => {
  it('updates ai_analyses table with feedback', async () => {
    await submitAiFeedback('analysis-1', 'helpful');

    expect(mockSupabase.from).toHaveBeenCalledWith('ai_analyses');
  });

  it('accepts "not_helpful" feedback', async () => {
    // Should not throw
    await expect(submitAiFeedback('analysis-1', 'not_helpful')).resolves.toBeUndefined();
  });
});
