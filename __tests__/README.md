# TaskLine Mobile — Test Suite

## Quick Start

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode (re-runs on file changes)
npm run test:coverage   # Run with coverage report
```

## Run by Layer

```bash
npm run test:components   # 20 component suites
npm run test:hooks        # 11 hook suites
npm run test:stores       # 4 store suites
npm run test:lib          # 6 library suites
npm run test:screens      # 10 screen suites
```

## Run a Single File

```bash
npx jest __tests__/components/Button.test.tsx
npx jest __tests__/hooks/useTheme.test.ts
```

## Run Tests Matching a Name

```bash
npx jest -t "renders loading"
npx jest -t "navigates to"
```

---

## Structure

```
__tests__/
├── setup/
│   ├── testUtils.tsx        # Render helper, mock providers, factories
│   └── supabaseMock.ts      # Chainable Supabase query builder mock
├── components/              # 20 suites — UI component tests
├── hooks/                   # 11 suites — Custom hook tests
├── lib/                     #  6 suites — Utility/library tests
├── screens/                 # 10 suites — Screen integration tests
└── stores/                  #  4 suites — Zustand store tests
```

### Components (20 suites)

| File | What it tests |
|------|--------------|
| Avatar.test.tsx | Initials fallback, sizing, custom colors |
| Badge.test.tsx | Variants (success, warning, error, info), custom styles |
| Button.test.tsx | Variants, sizes, loading state, disabled, haptic feedback |
| Card.test.tsx | Pressable cards, elevation, custom styles |
| ConfirmDialog.test.tsx | Confirm/cancel callbacks, destructive variant, haptics |
| EmptyState.test.tsx | Icon, title, description, action button |
| FilterChips.test.tsx | Selection, multi-select, scroll behavior |
| FloatingActionButton.test.tsx | Press handler, positioning, icon rendering |
| Input.test.tsx | Placeholder, error state, secure text, multiline |
| LoadingOverlay.test.tsx | Visibility, overlay styling |
| LoadingSkeleton.test.tsx | Card/List/Stats/Box skeleton variants |
| Modal.test.tsx | Open/close, sizes (small/medium/large/full), animation |
| NotificationBell.test.tsx | Unread badge count, navigation on press |
| OfflineBanner.test.tsx | Offline/syncing/failed states, pending count |
| SearchBar.test.tsx | Text input, clear button, placeholder |
| SectionHeader.test.tsx | Title, icon, action button |
| Select.test.tsx | Dropdown, search/filter, checkmark highlight, empty state |
| StatCard.test.tsx | Value, label, icon, trend indicator |
| StatusBadge.test.tsx | All status types (active, pending, completed, etc.) |
| Toast.test.tsx | Success/error/info variants, auto-dismiss, showToast() |

### Hooks (11 suites)

| File | What it tests |
|------|--------------|
| useCollapsibleFilters.test.ts | Scroll-based filter collapse, layout measurement |
| useHaptics.test.ts | Impact/notification/selection feedback, web platform guard |
| useNavigationBadges.test.ts | Real-time badge counts, Supabase channel subscriptions |
| useNetworkStatus.test.ts | Online/offline detection, listener cleanup, rapid changes |
| useNotifications.test.ts | CRUD, real-time subscription, mark read, archive |
| useOfflineData.test.ts | Cache-first fetching, TTL, stale detection, refresh |
| useOfflineMutation.test.ts | Offline queue, retry logic, sync on reconnect |
| usePushNotifications.test.ts | Permission request, token registration, handlers |
| useSubscription.test.ts | Tier resolution (subscriptions → user_tiers → free), refresh |
| useTheme.test.ts | Light/dark/system modes, color memoization, persistence |
| useTranslations.test.ts | Translation lookup, locale switching, SecureStore persistence |

### Stores (4 suites)

| File | What it tests |
|------|--------------|
| authStore.test.ts | Login, logout, signup, session restore, auth state changes |
| offlineStore.test.ts | Mutation queue, FIFO sync, retry with backoff, persistence |
| subscriptionStore.test.ts | Tier fetch cascade, founding member, trial detection |
| themeStore.test.ts | Mode switching, system appearance listener, persistence |

### Libraries (6 suites)

| File | What it tests |
|------|--------------|
| env.test.ts | Environment variable presence and format |
| offlineStorage.test.ts | AsyncStorage cache, TTL expiry, key listing, clear |
| plans.test.ts | Plan definitions, feature gates, getPlan() lookup |
| security.test.ts | secureLog redaction, sanitizeInput, validateEmail |
| supabase.test.ts | Client initialization, SecureStore chunking adapter |
| websiteApi.test.ts | API wrappers (checkout, sync, delete account) |

### Screens (10 suites)

| File | What it tests |
|------|--------------|
| clients.test.tsx | List rendering, search/filter, badges, empty state, navigation |
| dashboard.test.tsx | Stats, revenue, today's tasks, invoices, skeleton loading |
| forgot-password.test.tsx | Email input, validation, reset link sent confirmation |
| invoices.test.tsx | List, status filters, search, amount display |
| login.test.tsx | Email/password inputs, validation, error toast, navigation |
| notifications.test.tsx | List, mark read, mark all read, filter, archive, routing |
| projects.test.tsx | List, stage badges, approval status, search, navigation |
| settings.test.tsx | All sections, subscription card, theme/language, navigation |
| signup.test.tsx | Multi-step flow (name → DOB → email → password → business → terms) |
| tasks.test.tsx | List, priority/status filters, search, view modes |

---

## Test Infrastructure

### jest.setup.js

Global mocks for native modules that don't run in the test environment:

- **Expo modules** — haptics, secure-store, localization, constants, notifications, device, clipboard, linking, web-browser, file-system, print, sharing
- **Storage** — AsyncStorage (in-memory), SecureStore
- **Navigation** — react-native-reanimated, react-native-gesture-handler, expo-router
- **UI** — react-native-maps, react-native-svg, react-native-qrcode-svg, @expo/vector-icons (renders icon names as text)
- **Analytics** — @sentry/react-native
- **Network** — @react-native-community/netinfo

### testUtils.tsx

Provides a custom `render()` that wraps components with all required providers, plus:

- **`mockT(key)`** — Returns the i18n key as-is (e.g. `'dashboard.welcome'`)
- **`setMockAuth(overrides)`** — Override auth store state
- **`setMockAuthUser(user?)`** — Set the authenticated user
- **`setMockSubscription(overrides)`** — Override subscription state
- **`factories`** — Data factories for `client`, `project`, `task`, `invoice`, etc.

### supabaseMock.ts

Chainable mock that mirrors the Supabase query builder API:

```typescript
const { mockSupabase, setMockResponse } = require('./supabaseMock');

setMockResponse({ data: [{ id: '1', name: 'Test' }], error: null });
// mockSupabase.from('table').select('*').eq('id', '1') → returns mock response
```

---

## Coverage Thresholds

| Scope | Branches | Functions | Lines | Statements |
|-------|----------|-----------|-------|------------|
| **hooks/** | 80% | 80% | 85% | 85% |
| **stores/** | 85% | 95% | 95% | 95% |
| **global** | 15% | 15% | 18% | 18% |

Global thresholds are lower because many large screen files have partial coverage. The enforced thresholds on hooks and stores ensure the core business logic stays well-tested.

---

## Writing New Tests

### Component test template

```tsx
import React from 'react';
import { render, screen, fireEvent } from '../setup/testUtils';
import { MyComponent } from '@/components';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('handles press', () => {
    const onPress = jest.fn();
    render(<MyComponent onPress={onPress} />);
    fireEvent.press(screen.getByText('Press me'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

### Hook test template

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useMyHook } from '@/hooks/useMyHook';

describe('useMyHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(0);
  });

  it('updates on action', () => {
    const { result } = renderHook(() => useMyHook());
    act(() => { result.current.increment(); });
    expect(result.current.value).toBe(1);
  });
});
```

### Screen test template

Screen tests need more mocks. Copy an existing screen test as a starting point — they include mocks for expo-router, offline data, components, and Supabase.

### Key conventions

- Import `render`, `screen`, `fireEvent`, `waitFor` from `../setup/testUtils` (not directly from `@testing-library/react-native`)
- i18n keys render as-is in tests (e.g. `screen.getByText('dashboard.welcome')`)
- Icons render their name as text (e.g. `screen.getByText('checkmark')`)
- Use `getAllByText()` when text appears in multiple places
- Use regex for composite text nodes: `screen.getByText(/auth\.agreePrefix/)`
- Async operations need `await waitFor(() => { ... })`
