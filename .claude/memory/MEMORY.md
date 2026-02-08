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
- Toast: `showToast()` global function, `ToastProvider` wraps root
- ErrorBoundary is a class component - can't use hooks directly

### i18n
- ~470 keys in en.json and es.json, structured by screen namespace
- `useTranslations()` returns `{ t, locale, setLocale }`
- Language persisted to SecureStore

### Subscription System
- Uses cascading lookup: `subscriptions` table → `user_tiers` table → free default
- Tables: `subscriptions` (Stripe), `user_tiers` (lifetime/founding), `tiers` (definitions)
- Do NOT read tier from `profiles` table — that was the old incorrect approach

## Page Improvement Tracker
- See `.claude/memory/page-improvements.md` for full status of every page
- Settings page: COMPLETE (5 new screens, subscription fix, ~135 i18n keys)
- Website source: `C:\Users\jezzi\OneDrive\Documents\TaskLine`

## Common Issues
- `Colors.light.*` references cause dark mode breakage - always use `useTheme()`
- Class components (ErrorBoundary) can't use hooks - known limitation
- Platform check required for haptics (`Platform.OS !== 'web'`)
- OneDrive path has spaces in directory names on Windows
- SecureStore has 2048-byte limit per key — chunking adapter in `lib/supabase.ts` handles this
- Module-level arrays with display labels can't use `t()` — store i18n keys, resolve inside component
- ALWAYS use `t()` for user-visible strings in new screens — don't hardcode English
