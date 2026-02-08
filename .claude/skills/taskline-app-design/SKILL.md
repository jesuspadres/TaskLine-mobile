---
name: taskline-app-design
description: Technical app design skill for building TaskLine's mobile application. Use when writing code, designing components, defining architecture, or implementing features for the TaskLine mobile app. Covers React Native/Expo patterns, component library, state management, API integration, and mobile-specific implementation details tied to the existing TaskLine Next.js backend.
---

# TaskLine Mobile App Design Skill

This skill provides the technical blueprint for building TaskLine's mobile app. It assumes the existing Next.js web app serves as the backend (API routes), and the mobile app is a native client consuming those APIs.

---

## Recommended Tech Stack for Mobile App

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Expo (React Native)** | Jessy knows React/TS, fastest path to native |
| Navigation | **Expo Router** | File-based routing (mirrors Next.js mental model) |
| UI Components | **Tamagui** or **NativeWind** | Tailwind-like patterns Jessy already knows |
| State | **Zustand** | Lightweight, TypeScript-first, no boilerplate |
| Data Fetching | **TanStack Query (React Query)** | Caching, offline, background sync |
| Auth | **Supabase JS client** | Same auth system as web |
| Maps | **react-native-maps** | Google Maps integration |
| Camera | **expo-camera** + **expo-image-picker** | Photo capture for job sites |
| Notifications | **expo-notifications** | Push notifications |
| Storage | **expo-secure-store** + **AsyncStorage** | Tokens + cached data |
| Animations | **react-native-reanimated** | Smooth native animations |
| Gestures | **react-native-gesture-handler** | Swipe actions, pull-to-refresh |
| i18n | **i18next + react-i18next** | Mirror existing en/es translations |
| PDF | **expo-print** + **expo-sharing** | Invoice PDF generation |

---

## Project Structure

```
taskline-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/                   # Bottom tab navigator
│   │   ├── index.tsx             # Home/Dashboard
│   │   ├── jobs.tsx              # Requests + Bookings
│   │   ├── add.tsx               # Quick Add (modal trigger)
│   │   ├── work.tsx              # Projects + Tasks
│   │   └── more.tsx              # Extended nav
│   ├── (auth)/                   # Auth screens
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── client/[id].tsx           # Client detail
│   ├── project/[id].tsx          # Project detail
│   ├── invoice/[id].tsx          # Invoice detail
│   ├── request/[id].tsx          # Request detail
│   ├── booking/[id].tsx          # Booking detail
│   ├── settings/                 # Settings screens
│   │   ├── index.tsx
│   │   ├── profile.tsx
│   │   ├── scheduling.tsx
│   │   └── subscription.tsx
│   └── _layout.tsx               # Root layout
├── components/
│   ├── ui/                       # Base components (Button, Card, Input, Badge, etc.)
│   ├── cards/                    # Entity cards (ClientCard, ProjectCard, InvoiceCard)
│   ├── forms/                    # Mobile-optimized forms
│   ├── sheets/                   # Bottom sheet components
│   ├── lists/                    # Swipeable list items
│   └── maps/                     # Map components
├── hooks/                        # Custom hooks (mirror web hooks)
│   ├── useAuth.ts
│   ├── useSubscription.ts
│   ├── useNotifications.ts
│   ├── useOfflineSync.ts
│   └── useLocation.ts
├── stores/                       # Zustand stores
│   ├── authStore.ts
│   ├── syncStore.ts
│   └── settingsStore.ts
├── api/                          # API client layer
│   ├── client.ts                 # Axios/fetch base config
│   ├── auth.ts
│   ├── clients.ts
│   ├── projects.ts
│   ├── invoices.ts
│   ├── requests.ts
│   ├── scheduling.ts
│   └── types.ts                  # Shared TypeScript types
├── i18n/                         # Translations
│   ├── en.json                   # Copy from web messages/en.json
│   └── es.json                   # Copy from web messages/es.json
├── utils/
│   ├── format.ts                 # Date, currency, storage formatting
│   ├── offline.ts                # Offline queue management
│   └── haptics.ts                # Haptic feedback helpers
├── constants/
│   ├── colors.ts                 # Design tokens
│   ├── layout.ts                 # Spacing, sizes
│   └── tiers.ts                  # Mirror lib/plans.ts
└── assets/                       # Images, fonts
```

---

## API Integration Strategy

The mobile app consumes the EXISTING Next.js API routes. No new backend needed initially.

### Base API Client
```typescript
// api/client.ts
import { getAuthToken } from '@/stores/authStore'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL // TaskLine web app URL

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()
  
  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }

  return response.json()
}
```

### Key API Endpoints (Already Exist)
```
GET    /api/dashboard/stats        → Dashboard data
GET    /api/service-requests       → List requests
POST   /api/service-requests       → Create request
GET    /api/service-requests/[id]  → Request detail
GET    /api/badges                 → Navigation badge counts
GET    /api/alerts                 → Critical alerts
GET    /api/tier-limits            → User tier limits
GET    /api/catalog                → Service catalog
POST   /api/sms/send              → Send SMS
GET    /api/scheduling/slots       → Available booking slots
POST   /api/scheduling/book        → Create booking
GET    /api/invoices/[id]          → Invoice detail
POST   /api/stripe/create-checkout-session → Upgrade
GET    /api/founding/status        → Founding member status
GET    /api/profile                → User profile
```

### Supabase Direct Access (For Real-Time)
```typescript
// For tables where real-time updates matter
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
)

// Real-time subscription for notifications
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, handleNewNotification)
  .subscribe()
```

---

## Component Patterns

### Swipeable List Item
```typescript
// components/lists/SwipeableItem.tsx
// Every list item in the app should support swipe actions
// Right swipe = positive action (green)
// Left swipe = negative/secondary action (red/gray)

interface SwipeableItemProps {
  children: React.ReactNode
  onSwipeRight?: () => void    // Approve, Complete, Send
  onSwipeLeft?: () => void     // Archive, Delete, Decline
  rightLabel?: string
  leftLabel?: string
  rightColor?: string          // Default: green
  leftColor?: string           // Default: red
}
```

### Bottom Sheet Pattern
```typescript
// components/sheets/QuickAddSheet.tsx
// The ➕ button opens this sheet
// Uses @gorhom/bottom-sheet for native feel

const quickAddOptions = [
  { icon: '📬', label: t('quickAdd.request'), screen: '/request/new' },
  { icon: '👤', label: t('quickAdd.client'), screen: '/client/new' },
  { icon: '📁', label: t('quickAdd.project'), screen: '/project/new' },
  { icon: '📄', label: t('quickAdd.invoice'), screen: '/invoice/new' },
  { icon: '📝', label: t('quickAdd.note'), screen: '/note/new' },
]
```

### Entity Card Pattern
```typescript
// components/cards/BaseCard.tsx
// Consistent card layout across all entity types

interface BaseCardProps {
  status: string
  statusColor: string
  title: string
  subtitle?: string
  metadata?: Array<{ icon: string; text: string }>
  onPress: () => void
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
}
```

### Mobile Form Pattern
```typescript
// components/forms/StepperForm.tsx
// Multi-step form for complex creation flows

interface StepperFormProps {
  steps: Array<{
    title: string
    component: React.ComponentType
    validate?: () => boolean
  }>
  onComplete: (data: any) => void
}

// Usage for invoice creation:
const invoiceSteps = [
  { title: t('invoice.selectClient'), component: ClientSelector },
  { title: t('invoice.addItems'), component: LineItemEditor },
  { title: t('invoice.reviewSend'), component: InvoiceReview },
]
```

---

## Offline Strategy

### What to Cache Locally
```
ALWAYS cached (on login):
├── User profile + subscription tier
├── Today's schedule (bookings)
├── Active client list (name, phone, email)
├── Active project list (name, status, client)
├── Pending requests (last 20)
└── Tier limits

CACHED on first visit (refreshed in background):
├── Client details + properties
├── Project details + tasks
├── Invoice list
├── Notification history
└── Calendar data (next 7 days)

NEVER cached (always live):
├── Payment processing
├── Stripe checkout
├── SMS sending (queued offline)
└── Real-time availability slots
```

### Offline Action Queue
```typescript
// stores/syncStore.ts
interface QueuedAction {
  id: string
  type: 'CREATE_CLIENT' | 'UPDATE_PROJECT' | 'SEND_INVOICE' | ...
  payload: any
  createdAt: number
  retryCount: number
}

// When back online, process queue in order
// Show sync indicator: "Syncing 3 changes..."
```

---

## Push Notification Strategy

### Notification Categories
```
URGENT (always delivered immediately):
├── New service request received
├── Booking confirmed/cancelled
├── Invoice payment received
└── Approval needed

INFORMATIONAL (respect quiet hours):
├── Task due tomorrow
├── Invoice overdue
├── Weekly summary
└── New feature announcement

CONTEXTUAL (location/time triggered):
├── "You're near [Client]'s property"
├── "Your next appointment is in 30 minutes"
└── "Don't forget to invoice for today's job"
```

### Deep Linking
Every notification should deep-link to the relevant screen:
```
taskline://request/abc123     → Request detail
taskline://booking/def456     → Booking detail  
taskline://invoice/ghi789     → Invoice detail
taskline://dashboard           → Home screen
```

---

## Design Tokens

```typescript
// constants/colors.ts
export const colors = {
  // Brand
  primary: '#3B82F6',      // TaskLine blue
  primaryDark: '#2563EB',
  
  // Status (consistent everywhere)
  success: '#10B981',       // Completed, Paid, Approved
  warning: '#F59E0B',       // In Progress, Pending
  danger: '#EF4444',        // Overdue, Urgent, Declined
  info: '#3B82F6',          // New, Informational
  neutral: '#6B7280',       // Cancelled, Archived, Inactive
  
  // Surfaces
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  
  // Dark mode variants
  dark: {
    background: '#111827',
    surface: '#1F2937',
    surfaceElevated: '#374151',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
  }
}

// constants/layout.ts
export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
}

export const touchTarget = {
  minimum: 44,   // Apple HIG minimum
  preferred: 56, // Comfortable for field workers
}

export const borderRadius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
}

export const fontSize = {
  display: 28,    // Screen titles
  headline: 22,   // Section headers
  title: 18,      // Card titles
  body: 16,       // Content (minimum for readability)
  caption: 14,    // Secondary info
  footnote: 12,   // Timestamps
}
```

---

## Testing Strategy for Mobile

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Jest + React Native Testing Library | Hooks, utils, stores |
| Component | React Native Testing Library | UI components |
| E2E | Detox or Maestro | Critical user flows |
| Visual | Storybook for React Native | Component catalog |

### Critical E2E Flows to Test
1. Login → Dashboard loads → See today's schedule
2. Quick Add → Create Client → Client appears in list
3. View Request → Accept → Create Project from request
4. Create Invoice → Add items → Send to client
5. Offline mode → Queue actions → Reconnect → Sync

---

## Migration Path from Web

### Phase 1: Core Loop (MVP)
- Auth (login/signup)
- Dashboard (today's focus view)
- Request list + detail
- Client list + detail
- Quick add (client, request)
- Push notifications

### Phase 2: Full Workflow
- Project management
- Task management
- Invoice creation + PDF
- Booking/scheduling views
- Calendar

### Phase 3: Mobile-Only Features
- GPS check-in at job sites
- Camera capture + photo attachments
- Offline mode + sync
- Location-based notifications
- Widgets (iOS + Android)

### Phase 4: Polish
- Dark mode
- Haptic feedback throughout
- Advanced animations
- Apple Watch / WearOS companion
- Siri Shortcuts / Google Assistant integration
