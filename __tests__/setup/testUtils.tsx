/**
 * Test utilities — render helpers, mock providers, factories
 */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

// ── Mock i18n ──
const translations: Record<string, string> = {};
export const mockT = jest.fn((key: string, options?: any) => {
  if (translations[key]) return translations[key];
  // Return the key itself for untranslated strings (makes assertions readable)
  if (options?.defaultValue) return options.defaultValue;
  return key;
});

export function setTranslation(key: string, value: string) {
  translations[key] = value;
}

export function clearTranslations() {
  Object.keys(translations).forEach((k) => delete translations[k]);
}

jest.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({
    t: mockT,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

// ── Mock useTheme ──
const lightColors = {
  primary: '#0B3D91',
  primaryLight: '#2563eb',
  primaryDark: '#082B66',
  accent: '#F5A623',
  accentLight: '#FEF3C7',
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceSecondary: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  priorityLow: '#10b981',
  priorityMedium: '#f59e0b',
  priorityHigh: '#ef4444',
  statusNew: '#8b5cf6',
  statusNewLight: '#f3e8ff',
  statusReviewing: '#f59e0b',
  statusConverted: '#10b981',
  statusDeclined: '#6b7280',
  statusActive: '#3b82f6',
  statusActiveLight: '#dbeafe',
  statusPending: '#f59e0b',
  statusPendingLight: '#fef3c7',
  statusCompleted: '#10b981',
  statusCompletedLight: '#d1fae5',
  statusCancelled: '#ef4444',
  statusCancelledLight: '#fee2e2',
  statusOnHold: '#6b7280',
  statusOnHoldLight: '#f3f4f6',
  statusDraft: '#6b7280',
  statusDraftLight: '#f3f4f6',
  statusSent: '#3b82f6',
  statusSentLight: '#dbeafe',
  statusPaid: '#10b981',
  statusPaidLight: '#d1fae5',
  statusOverdue: '#ef4444',
  statusOverdueLight: '#fee2e2',
  statusScheduled: '#3b82f6',
  statusScheduledLight: '#dbeafe',
  statusConfirmed: '#10b981',
  statusConfirmedLight: '#d1fae5',
  statusInProgress: '#f59e0b',
  statusInProgressLight: '#fef3c7',
  statusApproved: '#10b981',
  statusApprovedLight: '#d1fae5',
  statusRejected: '#ef4444',
  statusRejectedLight: '#fee2e2',
  statusArchived: '#6b7280',
  statusArchivedLight: '#f3f4f6',
  icon: '#6b7280',
  tabBarActive: '#0B3D91',
  tabBarInactive: '#6b7280',
  inputBackground: '#f9fafb',
  inputBorder: '#d1d5db',
  inputText: '#111827',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: '#000000',
  card: '#ffffff',
  cardBorder: '#e5e7eb',
  cardShadow: 'rgba(0, 0, 0, 0.08)',
  divider: '#e5e7eb',
  skeleton: '#e5e7eb',
  skeletonHighlight: '#f3f4f6',
};

let mockIsDark = false;
let mockThemeMode: 'light' | 'dark' | 'system' = 'light';

export function setMockTheme(isDark: boolean, mode?: 'light' | 'dark' | 'system') {
  mockIsDark = isDark;
  mockThemeMode = mode || (isDark ? 'dark' : 'light');
}

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: lightColors,
    isDark: mockIsDark,
    mode: mockThemeMode,
    setMode: jest.fn(),
    toggleTheme: jest.fn(),
  }),
}));

// ── Mock useHaptics ──
jest.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({
    impact: jest.fn(),
    notification: jest.fn(),
    selection: jest.fn(),
  }),
}));

// ── Mock auth store ──
const mockAuthState = {
  user: null as any,
  session: null as any,
  loading: false,
  initialized: true,
  suppressAuthChange: false,
  initialize: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  setSuppressAuthChange: jest.fn(),
};

export function setMockAuth(overrides: Partial<typeof mockAuthState>) {
  Object.assign(mockAuthState, overrides);
}

export function setMockAuthUser(user?: { id?: string; email?: string; user_metadata?: any }) {
  const defaultUser = {
    id: 'test-user-id',
    email: 'test@test.com',
    user_metadata: { name: 'Test User' },
  };
  mockAuthState.user = user ? { ...defaultUser, ...user } : defaultUser;
  mockAuthState.session = { access_token: 'test-token', user: mockAuthState.user };
  mockAuthState.initialized = true;
  mockAuthState.loading = false;
}

jest.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector?: any) => {
      if (typeof selector === 'function') return selector(mockAuthState);
      return mockAuthState;
    }),
    { getState: () => mockAuthState }
  ),
}));

// ── Mock subscription store ──
const mockSubscriptionState = {
  tier: 'free',
  status: 'active',
  isFree: true,
  isPro: false,
  isPlus: false,
  isBusiness: false,
  loading: false,
  initialize: jest.fn(),
  fetchSubscription: jest.fn(),
};

export function setMockSubscription(overrides: Partial<typeof mockSubscriptionState>) {
  Object.assign(mockSubscriptionState, overrides);
}

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionState,
}));

// ── Mock offline store ──
jest.mock('@/stores/offlineStore', () => {
  const state = {
    isOnline: true,
    isSyncing: false,
    pendingMutations: [],
    failedMutations: [],
    setOnline: jest.fn(),
    addMutation: jest.fn(),
    removeMutation: jest.fn(),
    clearFailed: jest.fn(),
    syncAll: jest.fn(),
  };
  return {
    useOfflineStore: Object.assign(
      jest.fn((selector?: any) => {
        if (typeof selector === 'function') return selector(state);
        return state;
      }),
      { getState: () => state }
    ),
  };
});

// ── Render helper with all providers ──
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// ── Data factories ──
export const factories = {
  user: (overrides?: any) => ({
    id: 'user-1',
    email: 'test@test.com',
    user_metadata: { name: 'Test User' },
    ...overrides,
  }),

  client: (overrides?: any) => ({
    id: 'client-1',
    user_id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    address: '123 Main St',
    notes: '',
    is_onboarded: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  project: (overrides?: any) => ({
    id: 'project-1',
    user_id: 'user-1',
    client_id: 'client-1',
    title: 'Test Project',
    description: 'A test project',
    status: 'active',
    project_stage: 'planning',
    approval_status: null,
    budget: 5000,
    start_date: '2024-01-01',
    end_date: '2024-06-30',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  task: (overrides?: any) => ({
    id: 'task-1',
    user_id: 'user-1',
    project_id: 'project-1',
    title: 'Test Task',
    description: 'A test task',
    status: 'pending',
    priority: 'medium',
    due_date: '2024-03-01',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  invoice: (overrides?: any) => ({
    id: 'invoice-1',
    user_id: 'user-1',
    client_id: 'client-1',
    project_id: 'project-1',
    invoice_number: 'INV-001',
    status: 'draft',
    amount: 1000,
    tax_amount: 100,
    total_amount: 1100,
    due_date: '2024-02-01',
    issued_date: '2024-01-01',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  booking: (overrides?: any) => ({
    id: 'booking-1',
    user_id: 'user-1',
    client_id: 'client-1',
    title: 'Test Booking',
    start_time: '2024-01-15T09:00:00Z',
    end_time: '2024-01-15T10:00:00Z',
    status: 'confirmed',
    notes: '',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  notification: (overrides?: any) => ({
    id: 'notification-1',
    user_id: 'user-1',
    title: 'Test Notification',
    message: 'Something happened',
    type: 'info',
    is_read: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  property: (overrides?: any) => ({
    id: 'property-1',
    user_id: 'user-1',
    client_id: 'client-1',
    name: 'Test Property',
    address: '456 Oak Ave',
    type: 'residential',
    notes: '',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  request: (overrides?: any) => ({
    id: 'request-1',
    user_id: 'user-1',
    client_name: 'Jane Smith',
    client_email: 'jane@example.com',
    service_type: 'plumbing',
    description: 'Fix a leak',
    status: 'new',
    priority: 'medium',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),
};

// ── Re-exports ──
export * from '@testing-library/react-native';
export { customRender as render };
