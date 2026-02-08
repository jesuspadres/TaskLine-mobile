# CLAUDE.md - TaskLine Mobile

> Guidelines for AI assistants working on this React Native Expo project.

## Project Overview

**TaskLine Mobile** is a premium React Native mobile application built with Expo that serves as a freelancer client portal. It provides full feature parity with the TaskLine website, allowing freelancers to manage clients, projects, tasks, invoices, bookings, properties, notifications, and subscriptions — all with dark mode support, internationalization, and mobile-optimized UX.

**Tech Stack:**
- **Framework:** Expo SDK 54 + React Native 0.76
- **Language:** TypeScript 5.9 (strict mode)
- **Navigation:** Expo Router 5 (file-based routing)
- **Backend:** Supabase (PostgreSQL, Auth, Real-time subscriptions)
- **State Management:** Zustand
- **Secure Storage:** Expo SecureStore
- **i18n:** i18n-js + expo-localization (English + Spanish)
- **Haptics:** expo-haptics

## Quick Reference

### Commands
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator
npm run web        # Run in web browser
npx expo install   # Install Expo-compatible packages (use instead of npm install)
npx tsc --noEmit   # Run TypeScript type check
```

### Project Structure
```
app/                         # Expo Router file-based routing
├── _layout.tsx              # Root layout (auth guards, ErrorBoundary, ToastProvider)
├── index.tsx                # Entry redirect
├── (auth)/                  # Auth screens (public)
│   ├── _layout.tsx          # Auth stack layout
│   ├── login.tsx            # Email/password login
│   ├── signup.tsx           # Registration
│   └── forgot-password.tsx  # Password reset
└── (app)/                   # Protected screens (requires auth)
    ├── _layout.tsx          # Tab navigation (6 tabs + 9 hidden screens)
    ├── dashboard.tsx        # Main dashboard with stats, alerts, quick actions
    ├── clients.tsx          # Client list with search/filter
    ├── projects.tsx         # Project list with status filters
    ├── tasks.tsx            # Task list with priority/status filters
    ├── requests.tsx         # Service request inbox
    ├── settings.tsx         # App settings (appearance, language, account)
    ├── invoices.tsx         # Invoice management (hidden tab)
    ├── bookings.tsx         # Booking/scheduling (hidden tab)
    ├── calendar.tsx         # Calendar view (hidden tab)
    ├── notifications.tsx    # Notification center (hidden tab)
    ├── properties.tsx       # Property management (hidden tab)
    ├── plans.tsx            # Subscription plans (hidden tab)
    ├── client-detail.tsx    # Client detail view
    ├── project-detail.tsx   # Project detail with tasks/invoices
    └── request-detail.tsx   # Request detail view

components/                  # Reusable UI component library
├── index.tsx                # Barrel exports for all components
├── Button.tsx               # Button with variants and haptic feedback
├── Input.tsx                # Text input with theming
├── Card.tsx                 # Card container
├── Badge.tsx                # Generic badge
├── Avatar.tsx               # User avatar with initials fallback
├── Select.tsx               # Dropdown select (exports SelectOption type)
├── Modal.tsx                # Modal dialog
├── DatePicker.tsx           # Platform-aware date picker
├── SearchBar.tsx            # Search input with icon
├── FilterChips.tsx          # Horizontal filter chips
├── EmptyState.tsx           # Empty state with icon and optional CTA
├── StatCard.tsx             # Dashboard stat card with fade-in animation
├── StatusBadge.tsx          # Unified status badges (color-coded)
├── SectionHeader.tsx        # Section header with icon
├── ConfirmDialog.tsx        # Confirmation dialog with haptics
├── ErrorBoundary.tsx        # React error boundary
├── NotificationBell.tsx     # Header notification icon with unread badge
├── CriticalAlertsCard.tsx   # Dashboard critical alerts
├── LoadingSkeleton.tsx      # Skeleton loaders (Card, List, Stats, Box)
└── Toast.tsx                # Toast notification system (ToastProvider + showToast)

hooks/                       # Custom React hooks
├── useTheme.ts              # Theme colors, isDark, mode, setMode, toggleTheme
├── useNavigationBadges.ts   # Real-time badge counts for tab bar
├── useNotifications.ts      # Notification CRUD + real-time subscription
├── useSubscription.ts       # Subscription tier/status from profiles
├── useTranslations.ts       # i18n: t(), locale, setLocale()
└── useHaptics.ts            # Haptic feedback (impact, notification, selection)

stores/                      # Zustand state stores
├── authStore.ts             # Auth state (user, session, login, logout)
└── themeStore.ts            # Theme state (mode, isDark, persistence)

lib/                         # Utilities and configuration
├── supabase.ts              # Supabase client with SecureStore adapter
├── database.types.ts        # Auto-generated Supabase types
├── env.ts                   # Environment variables (Supabase URL, keys, APP_URL)
├── env.example.ts           # Environment template
├── security.ts              # Secure logging, input sanitization, email validation
└── plans.ts                 # Plan/tier definitions (Free/Pro/Plus/Business)

i18n/                        # Internationalization
├── index.ts                 # i18n-js configuration with locale detection
├── en.json                  # English translations (263 keys)
└── es.json                  # Spanish translations (263 keys)

constants/                   # Design system tokens
└── theme.ts                 # Colors (light/dark), Spacing, FontSizes, BorderRadius, Shadows

assets/                      # Images, fonts, icons
```

## Architecture

### Dark Mode System
The app has a complete dark mode implementation:

1. **Theme Store** (`stores/themeStore.ts`): Zustand store with 3 modes — `'light'`, `'dark'`, `'system'`. Listens to `Appearance` changes for system mode. Persists to SecureStore.

2. **useTheme Hook** (`hooks/useTheme.ts`): Returns `{ colors, isDark, mode, setMode, toggleTheme }`. Colors are memoized based on current mode.

3. **Usage Pattern**: Every screen and component uses `useTheme()` for colors. Static styles go in `StyleSheet.create()`, color-dependent styles are inline:
   ```typescript
   const { colors, isDark } = useTheme();
   // ...
   <View style={[styles.container, { backgroundColor: colors.background }]}>
   ```

4. **Color Maps**: Status/priority color maps that depend on theme must be inside components as `useMemo` values, not at module level.

### i18n System
- **263 translation keys** covering all screens and components
- Device locale auto-detection via `expo-localization`
- Manual language switching persisted to SecureStore
- Usage: `const { t, locale, setLocale } = useTranslations();`
- Keys are namespaced: `t('dashboard.welcome')`, `t('common.save')`, etc.

### Component Library
All components in `components/` are:
- Fully theme-aware (use `useTheme()` internally)
- Exported via barrel file `components/index.tsx`
- Use `StyleSheet.create()` for non-color styles
- Accept standard React Native props where appropriate

Key exports:
```typescript
import { Button, Input, Card, Badge, Avatar, EmptyState, SearchBar, FilterChips,
  Modal, Select, DatePicker, StatusBadge, StatCard, SectionHeader, ConfirmDialog,
  ErrorBoundary, NotificationBell, CriticalAlertsCard, LoadingSkeleton,
  CardSkeleton, ListSkeleton, StatsSkeleton, SkeletonBox,
  ToastProvider, showToast } from '@/components';
```

### Real-time Features
- **Navigation Badges**: `useNavigationBadges` hook subscribes to `client_requests`, `projects`, `tasks` tables for live badge counts on tab bar
- **Notifications**: `useNotifications` hook subscribes to `notifications` table via `postgres_changes` channel
- **Toast System**: Global `showToast()` function, wrapped in `ToastProvider` at root

### Subscription System
- Plan definitions in `lib/plans.ts` (Free/Pro/Plus/Business tiers)
- `useSubscription` hook reads tier from `profiles` table
- Plans screen at `app/(app)/plans.tsx` with monthly/annual toggle
- Stripe checkout via `Linking.openURL`

## Development Guidelines

### Code Style & Patterns

1. **Imports:** Use the `@/` path alias
   ```typescript
   import { supabase } from '@/lib/supabase';
   import { useTheme } from '@/hooks/useTheme';
   import { Button, Card } from '@/components';
   ```

2. **Components:** Functional components with TypeScript interfaces
   ```typescript
   interface Props {
     title: string;
     onPress: () => void;
   }
   export function MyComponent({ title, onPress }: Props) { ... }
   ```

3. **Styles:** `StyleSheet.create()` for static styles, inline for theme-dependent colors
   ```typescript
   const { colors } = useTheme();
   return <View style={[styles.container, { backgroundColor: colors.background }]} />;
   // ...
   const styles = StyleSheet.create({
     container: { flex: 1, padding: Spacing.lg },
   });
   ```

4. **State:** Zustand for global state, React state for local
   ```typescript
   const { user } = useAuthStore();          // Global
   const [loading, setLoading] = useState(false); // Local
   ```

5. **Security:** Use `secureLog` from `lib/security.ts` instead of `console.log` for any data that could contain PII

### Supabase Integration

- **Client:** Import from `@/lib/supabase`
- **Types:** Import from `@/lib/database.types`
- **Auth:** Use `useAuthStore()` for auth operations
- **Queries:** Use typed queries with error handling
- **Real-time:** Use `supabase.channel().on('postgres_changes', ...).subscribe()`

### Routing Conventions

- **Auth routes:** `app/(auth)/` — publicly accessible
- **App routes:** `app/(app)/` — protected, requires authentication
- **Hidden screens:** Registered in `_layout.tsx` with `options={{ href: null }}`
- **Navigation:** `router.push('/(app)/screen-name' as any)`
- **Tab bar:** 6 visible tabs (Dashboard, Requests, Clients, Projects, Tasks, Settings)

### Theme & Styling

- **Always** use `useTheme()` hook for colors — never use `Colors.light.*` directly
- Design tokens in `constants/theme.ts`: `Spacing`, `FontSizes`, `BorderRadius`, `Shadows`
- Color palette: Primary navy (#0B3D91 light / #3b82f6 dark), Accent gold (#F5A623)
- 60+ named colors including status colors (new, active, completed, etc.)

## Important Conventions

### Do's
- Always handle loading and error states in UI
- Use `SafeAreaView` for screen containers
- Type all function parameters and return values
- Use real-time subscriptions for live data
- Use skeleton loading states (`LoadingSkeleton`) instead of spinners
- Use `showToast()` for user feedback on actions
- Use `ConfirmDialog` for destructive actions
- Add haptic feedback on important actions (non-web only)
- Use `StatusBadge` for consistent status display
- Test on both iOS and Android

### Don'ts
- Don't store sensitive data in AsyncStorage (use SecureStore)
- Don't use `Colors.light.*` or `Colors.dark.*` directly — use `useTheme()`
- Don't put theme-dependent color maps at module level — use `useMemo` inside components
- Don't ignore TypeScript errors
- Don't make Supabase calls directly in components — use hooks or stores
- Don't hardcode URLs — use `ENV.APP_URL` from `lib/env.ts`
- Don't use `console.log` with sensitive data — use `secureLog`

## Database Schema Context

Main tables (all use `user_id` for RLS):
- `profiles` — User profile, subscription tier
- `clients` — Client records
- `projects` — Project management (linked to clients)
- `tasks` — Task tracking (linked to projects)
- `invoices` — Invoice management (linked to projects/clients)
- `client_requests` — Service request queue
- `bookings` — Scheduled bookings/appointments
- `notifications` — User notifications (real-time)
- `properties` — Property management (linked to clients)

## Environment Setup

1. Copy `lib/env.example.ts` to `lib/env.ts`
2. Add your Supabase credentials:
   ```typescript
   export const ENV = {
     SUPABASE_URL: 'your-project-url',
     SUPABASE_ANON_KEY: 'your-anon-key',
     APP_URL: 'https://your-app-url.com',
   };
   ```

## Current Development Status

**Fully Implemented:**
- Complete authentication flow (login, signup, password reset)
- Tab navigation with 6 main tabs + 9 hidden screens
- Full dark mode support across all screens (light/dark/system)
- Dashboard with stats, critical alerts, quick actions, revenue overview
- CRUD screens for clients, projects, tasks, invoices, requests, bookings
- Detail screens for clients, projects, requests
- Calendar view
- Properties management with CRUD
- Notification center with real-time updates
- Subscription plans screen with Stripe integration
- 20+ reusable UI components with theme support
- i18n system (English + Spanish, 263 keys)
- Haptic feedback on key interactions
- Skeleton loading states
- Toast notification system
- Error boundaries
- Security utilities (secure logging, input sanitization)
- Real-time badge counts on navigation

**Future Enhancements:**
- Push notifications (expo-notifications)
- Offline support with local caching
- File upload for invoices/attachments
- Swipe gestures on list items
- Deep linking
- Biometric authentication

## Debugging Tips

- Use Expo DevTools: Press `j` in terminal to open debugger
- Check Supabase logs in dashboard for API errors
- Run `npx tsc --noEmit` to check for TypeScript errors
- Use `secureLog` from `lib/security.ts` for safe debugging
- React Native Debugger recommended for state inspection

## Additional Notes

- Mobile-first app; web is secondary
- iOS bundle ID: `com.solvrlabs.taskline`
- Android package: `com.solvrlabs.taskline`
- Website source: TaskLine (Next.js) — this mobile app mirrors its functionality
- Minimum supported versions configured in `app.json`
