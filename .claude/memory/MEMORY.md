# TaskLine Mobile - Project Memory

## Project Context
- Expo SDK 54 + React Native 0.76 + TypeScript 5.9
- Supabase backend with auto-generated types in `lib/database.types.ts`
- File-based routing via Expo Router 5

## Key Patterns

### Dark Mode
- Use `useTheme()` hook from `@/hooks/useTheme` - returns `{ colors, isDark, mode, setMode, toggleTheme }`
- Static styles in `StyleSheet.create()`, color-dependent styles inline
- Module-level color maps MUST be moved inside components as `useMemo` values
- 3 modes: light/dark/system, stored in Zustand + SecureStore

### TypeScript & Supabase
- Auto-generated types may not include all columns (e.g. `tier`, `subscription_status` on profiles)
- Use `as any` or `as Record<string, any>` for columns not in generated types
- RPC calls may need `(supabase.rpc as any)('fn_name', ...)` if not in types
- `.update()` on tables may reject unknown columns - use `as any` on the update object

### Components
- All components exported via barrel file `components/index.tsx`
- Every component uses `useTheme()` internally for dark mode
- Toast: `showToast(type, message)` — type FIRST ('success'|'error'|'warning'|'info'), message SECOND
- `ToastProvider` wraps root
- ErrorBoundary is a class component - can't use hooks directly

### Haptics
- `useHaptics()` hook already handles `Platform.OS !== 'web'` check internally
- Use enum values: `Haptics.ImpactFeedbackStyle.Light`, `Haptics.NotificationFeedbackType.Success`
- Import `* as Haptics from 'expo-haptics'` for the enum types

### StatCard Component
- Props: `label` (not `title`), `value`, `icon`, `iconColor`, `tintColor`, `subtitle`, `onPress`, `style`

### i18n
- ~515 keys in en.json and es.json, structured by screen namespace
- `useTranslations()` returns `{ t, locale, setLocale }`
- Language persisted to SecureStore

### Subscription System
- Uses cascading lookup: `subscriptions` table → `user_tiers` table → free default
- Tables: `subscriptions` (Stripe), `user_tiers` (lifetime/founding), `tiers` (definitions)
- Do NOT read tier from `profiles` table — that was the old incorrect approach

## Page Improvement Tracker
- See `.claude/memory/page-improvements.md` for full status of every page
- Settings page: COMPLETE (5 new screens, subscription fix, ~135 i18n keys)
- Website source (Mac): `/Users/jessy/TaskLine/`
- Website source (Windows): `C:\Users\jezzi\OneDrive\Documents\TaskLine`

### API Integration
- request_messages table requires: `user_id`, `request_type`, `sender_type`, `sender_name`, `message` (RLS checks user_id)
- Email sending is done by website API, NOT database triggers — must call API, not direct insert
- Website API at `${ENV.APP_URL}/api/...` uses cookie auth — added Bearer token fallback for mobile
- Mobile passes `Authorization: Bearer ${session.access_token}` to website API endpoints
- Website API route modified: `/Users/jessy/TaskLine/app/api/service-requests/[id]/messages/route.ts`

### Properties Schema (CRITICAL)
- **Generated types are OUTDATED** — do NOT trust column names in `database.types.ts` for properties
- Website uses: `address_street`, `address_unit`, `address_city`, `address_state`, `address_zip`, `address_formatted`, `address_lat`, `address_lng`, `address_place_id`
- Website uses: `has_pets` (boolean) + `pet_details` (text), `property_notes`, `property_type`
- Mobile generated types have WRONG names: `address_line1`, `city`, `state`, `zip_code`, `pets`, `notes`
- **For WRITES**: Always use website column names (`address_street`, `pet_details`, `property_notes`, etc.)
- **For READS**: Prefer website columns with fallback to old: `p.address_street || property.address_line1`
- Address display: check `address_formatted` first, then assemble from `address_street`/`address_city`/etc.
- Coordinates: prefer `address_lat`/`address_lng`, fallback to `latitude`/`longitude`
- Property categories: Residential, Commercial, Other (no Industrial — lumped into Other)

### Bookings → Properties (No FK)
- `bookings` table has `property_id` column but **NO foreign key constraint** to `properties`
- Supabase join `property:properties(...)` will fail with PGRST200 error
- Must fetch properties separately after fetching bookings, using `.in('id', propertyIds)`

## Common Issues
- `Colors.light.*` references cause dark mode breakage - always use `useTheme()`
- Class components (ErrorBoundary) can't use hooks - known limitation
- Platform check required for haptics (`Platform.OS !== 'web'`)
- OneDrive path has spaces in directory names on Windows
- SecureStore has 2048-byte limit per key — chunking adapter in `lib/supabase.ts` handles this
- Module-level arrays with display labels can't use `t()` — store i18n keys, resolve inside component
- ALWAYS use `t()` for user-visible strings in new screens — don't hardcode English
