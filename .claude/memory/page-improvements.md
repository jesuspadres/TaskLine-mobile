# TaskLine Mobile — Page-by-Page Improvement Tracker

Website source: `C:\Users\jezzi\OneDrive\Documents\TaskLine`
Mobile source: `c:\Users\jezzi\OneDrive\Documents\taskline-mobile\taskline-mobile`

## Legend
- [x] = Done
- [ ] = Not started
- [~] = Partially done / needs testing

---

## Settings Page — `app/(app)/settings.tsx`
**Status: [x] DONE**

### Phase 1: Quick Fixes (all in settings.tsx)
- [x] Change Email — modal with password verification (`supabase.auth.updateUser({ email })`)
- [x] Change Password — ConfirmDialog + `supabase.auth.resetPasswordForEmail()`
- [x] Request Link — replaced `Alert.alert()` with `Share.share()`
- [x] Branding — shows "Coming Soon" toast (not built on website either)
- [x] Help Center — opens `ENV.APP_URL/help` via `Linking.openURL()`
- [x] Send Feedback — opens `mailto:support@solvrlabs.com`
- [x] About — shows version alert
- [x] Invoice Settings route — fixed to go to `/(app)/invoice-settings` instead of invoices list
- [x] Storage Usage card — progress bar with used/total, color-coded
- [x] Profile save — replaced `Alert.alert` with `showToast()`
- [x] Added navigation items: Business Profile, QR Codes, Notification Preferences, Booking Settings

### Phase 2: New Settings Screens
- [x] Business Profile — `app/(app)/business-profile.tsx`
  - Fields: business name, type, phone, tax ID, website, address
  - Saves to `user_metadata` via `supabase.auth.updateUser()`
- [x] Invoice/Payment Settings — `app/(app)/invoice-settings.tsx`
  - Fields: payment terms, payment instructions, tax rate, default notes
  - Saves to `user_settings` table via upsert
- [x] Notification Settings — `app/(app)/notification-settings.tsx`
  - 6 in-app toggles + 5 email toggles with auto-save
  - Saves to `notification_preferences` table

### Phase 3: Complex Screens
- [x] QR Codes — `app/(app)/qr-settings.tsx`
  - Request link + custom URL tabs, color pickers, size presets, share
  - Installed `react-native-qrcode-svg` + `react-native-svg`
  - Saves to `qr_codes` table
- [x] Booking Settings — `app/(app)/booking-settings.tsx`
  - Tier-gated (Plus/Business only)
  - Collapsible sections: basic settings, options, weekly availability, time off, services
  - Uses `scheduling_settings`, `availability_rules`, `availability_blocks`, `service_catalog` tables

### Other Fixes
- [x] Subscription hook — `hooks/useSubscription.ts`
  - Was reading `profiles.tier` (wrong)
  - Fixed to use cascading lookup: `subscriptions` → `user_tiers` → free default (matches website)
- [x] Registered 5 new screens in `app/(app)/_layout.tsx`
- [x] Added ~135 i18n keys to `i18n/en.json` and `i18n/es.json`

---

## Auth Screens
- [ ] Login — `app/(auth)/login.tsx` — skipped for now
- [ ] Sign Up — `app/(auth)/signup.tsx` — skipped for now
- [ ] Forgot Password — `app/(auth)/forgot-password.tsx` — skipped for now

## Dashboard — `app/(app)/(tabs)/dashboard.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] Quick Action buttons (+Project, +Task, +Invoice) below header greeting
- [x] Stats grid expanded from 4 to 6 items in 2 rows (Revenue, Clients, Projects, Tasks, Requests, Approvals)
- [x] Coming Up section now merges bookings + project deadlines + upcoming tasks (sorted by date, max 8)
- [x] New "Recent Invoices" section with 5 most recent invoices, status badges, amounts, due dates
- [x] Revenue summary footer in Recent Invoices (Collected vs Outstanding)
- [x] Empty state with CTA for Recent Invoices
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Locale-aware date formatting (weekday, month, relative days)
- [x] Locale-aware currency formatting
- [x] `Alert.alert` replaced with `showToast` for error handling
- [x] Added 2 new Supabase queries (recent invoices with details, upcoming tasks next 7 days)
- [x] Added ~17 new i18n keys to en.json and es.json

## Jobs (Requests + Bookings) — `app/(app)/(tabs)/jobs.tsx`
- [ ] Not started — need to compare with website

## Clients — `app/(app)/(tabs)/clients.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Filter chip labels moved inside component with `useMemo` (i18n-safe)
- [x] Sort functionality added: Newest, Oldest, Name A-Z, Name Z-A (sort chips row)
- [x] Client count badge in header
- [x] Phone number shown on client cards (with call icon)
- [x] Phone included in search filtering
- [x] `Alert.alert` replaced with `showToast` for success/error feedback (kept native dialog for delete confirmation)
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading state
- [x] Form labels, placeholders, error messages all i18n'd
- [x] Modal button labels use `t('common.*')` keys
- [x] Added ~22 new i18n keys to en.json and es.json

## Calendar — `app/(app)/(tabs)/calendar.tsx`
- [ ] Not started — need to compare with website

## More Menu — `app/(app)/(tabs)/more.tsx`
- [ ] Not started — need to compare with website

## Projects — `app/(app)/projects.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Filter chip labels moved inside component with `useMemo` (i18n-safe)
- [x] Sort functionality added: Newest, Oldest, Name A-Z, Name Z-A, Deadline (sort chips row)
- [x] Project count badge in header
- [x] Client name included in search filtering
- [x] Card tap navigates to project-detail (instead of opening edit modal)
- [x] Long-press on card for delete action
- [x] `project_stage` badge shown on cards when available
- [x] `Alert.alert` replaced with `showToast` for success/error (kept for delete confirmation)
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading state
- [x] `console.error` replaced with `secureLog.error()`
- [x] Locale-aware date formatting (en-US / es-MX)
- [x] Locale-aware currency formatting
- [x] Removed edit modal from list page (edit only in detail page)
- [x] Form labels, placeholders, validation errors all i18n'd
- [x] Modal button labels use `t()` keys
- [x] Added ~35 new i18n keys to en.json and es.json (`projects` namespace)

## Tasks — `app/(app)/tasks.tsx`
**Status: [x] DONE (v2)**

### Round 1 — Initial Improvements
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Filter/sort/status option arrays inside component with `useMemo` (i18n-safe)
- [x] Fixed `order_index` bug — column doesn't exist, now sorts by `created_at`
- [x] `console.error` → `secureLog.error()`, `Alert.alert` → `showToast` + `ConfirmDialog`
- [x] `ActivityIndicator` → `ListSkeleton`, haptic feedback
- [x] Search, filter chips, sort chips, task count badge, stats bar
- [x] Status-grouped list view, overdue highlighting, locale-aware dates

### Round 2 — Bug Fixes & UX Overhaul
- [x] **Fixed status values**: DB uses `pending` not `todo`, and `backlog` exists — changed all status logic
- [x] **Fixed errors moving backward from completed**: Was trying to set `todo` (doesn't exist), now uses `pending`
- [x] **View modal**: Tap task opens read-only view (status/priority badges, description, project, dates, "Move to" buttons). Edit button transitions to edit form.
- [x] **Separate edit modal**: Only reachable via Edit button in view modal
- [x] **Larger status action buttons**: Pill-shaped with icon + text labels (Start, Done, Reopen, To Do, Backlog)
- [x] **Reduced filter crowding**: Collapsed priority + sort behind a filter icon button with badge count. Only status chips shown inline.
- [x] **4 statuses**: backlog, pending (To Do), in_progress, completed — matches website
- [x] **Move to buttons in view modal**: Can move task to any status from the detail view
- [x] Added `as string` casts for status comparisons (generated types outdated, don't include `pending`/`backlog`)
- [x] Added ~12 more i18n keys (backlog, start, done, reopen, viewTask, created, noDescription, filterSort, sortBy)

### Round 3 — Backlog Drawer
- [x] **Backlog drawer** in board view: collapsible panel at bottom with chevron toggle
- [x] Shows backlog task count in handle bar
- [x] When expanded, horizontally scrollable cards (200px wide) with priority, title, project, due date
- [x] Each backlog card has "Add to Board" button that moves task to `pending`
- [x] Tapping a backlog card opens the view modal
- [x] Empty state when no backlog tasks
- [x] Drawer hidden entirely when no backlog tasks and collapsed
- [x] Added 3 more i18n keys (backlogDrawer, backlogEmpty, addToBoard)

## Invoices — `app/(app)/invoices.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] `console.error` replaced with `secureLog.error()`
- [x] `Alert.alert` replaced with `showToast` + `ConfirmDialog` for all feedback
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading state
- [x] Haptic feedback on key actions (mark sent/paid, create, update)
- [x] Locale-aware date formatting (en-US / es-MX)
- [x] Locale-aware currency formatting
- [x] NEW: SearchBar for filtering by invoice number, client name, project name
- [x] NEW: Sort functionality (Newest, Oldest, Amount High/Low, Due Earliest/Latest) in modal
- [x] NEW: FilterChips component (All, Draft, Sent, Paid, Overdue) — replaces manual chips
- [x] NEW: View modal (read-only) — shows invoice number, status, bill-to, dates, payment terms, line items, totals, notes
- [x] NEW: Edit via view modal — Edit button in view transitions to edit form
- [x] NEW: invoice_items CRUD — line items now saved to/loaded from `invoice_items` table
- [x] NEW: Tax rate field — with auto-calculated subtotal, tax amount, total
- [x] NEW: Payment terms field in form
- [x] NEW: Auto-overdue detection — invoices with status 'sent' and past due_date display as overdue
- [x] NEW: Invoice number generation via `generate_invoice_number` RPC (with client-side fallback)
- [x] NEW: Optimistic status updates — mark sent/paid updates local state immediately
- [x] NEW: Sort badge on filter button showing active sort count
- [x] NEW: Empty state differentiates between no invoices vs no search results
- [x] Summary cards retained (Total, Paid, Outstanding) with improved overdue color
- [x] Quick action buttons on cards (Mark Sent for drafts, Mark Paid for sent/overdue)
- [x] Added ~50 new i18n keys to en.json and es.json (`invoices` namespace)

## Properties — `app/(app)/properties.tsx`
- [ ] Not started — need to compare with website

## Notifications — `app/(app)/notifications.tsx`
- [ ] Not started — need to compare with website

## Plans — `app/(app)/plans.tsx`
- [ ] Not started — need to compare with website

## Bookings — `app/(app)/bookings.tsx`
- [ ] Not started — need to compare with website

## Requests — `app/(app)/requests.tsx`
- [ ] Not started — need to compare with website

## Client Detail — `app/(app)/client-detail.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] Full rewrite with comprehensive client profile view
- [x] Quick contact actions: Call, Text, Email (one-tap via `Linking.openURL`)
- [x] Contact info card showing all fields (email, phone, company)
- [x] "Customer since" date with locale-aware formatting
- [x] Notes section displayed when available
- [x] Edit client modal with full form (name, email, phone, company, notes, onboarded toggle)
- [x] Delete client with native confirmation dialog
- [x] Stats row: Projects count (clickable), Invoiced total, Properties count
- [x] Projects section: recent 5 with status badges, clickable to project detail
- [x] Invoices section: recent 5 with amount, due date, status badges
- [x] Requests section: recent 5 with status badges, clickable to request detail
- [x] Bookings section: recent 5 with status badges
- [x] Properties section: full CRUD (add/edit/delete) with all fields i18n'd
- [x] All hardcoded strings replaced with `t()` i18n calls
- [x] `Alert.alert` replaced with `showToast` for feedback (kept for delete confirmations)
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading
- [x] `keyboardDismissMode="on-drag"` on ScrollView
- [x] Locale-aware date and currency formatting
- [x] Added ~34 new i18n keys to en.json and es.json (`clientDetail` namespace)
- [x] Header with edit (pencil) and delete (trash) action buttons

## Property Detail — `app/(app)/property-detail.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] New dedicated property detail page (read-only view)
- [x] Property name, primary badge, client link, date added
- [x] Full address display
- [x] Square footage and year built stat cards
- [x] Access codes section: gate code, lockbox code, alarm code (not masked)
- [x] Pets, hazards, notes sections
- [x] Edit button → full edit modal with all fields (incl. address line 2, sq ft, year built)
- [x] Delete button with confirmation dialog
- [x] Navigate to client detail from property page
- [x] Registered in `_layout.tsx`
- [x] Client detail property cards now navigate to property detail (instead of opening edit modal)
- [x] All strings use `t()` i18n calls
- [x] Added `propertyDetail` namespace (~14 i18n keys) to en.json and es.json
- [x] Dark mode support via `useTheme()`
- [x] Pull-to-refresh, keyboard dismiss on drag

## Project Detail — `app/(app)/project-detail.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Select option arrays moved inside component with `useMemo` (i18n-safe)
- [x] `Alert.alert` replaced with `showToast` for success/error (kept for destructive confirmations)
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading state
- [x] `console.error` replaced with `secureLog.error()`
- [x] Locale-aware date formatting (en-US / es-MX)
- [x] Locale-aware currency formatting
- [x] NEW: Budget Breakdown section — full CRUD for `project_line_items` (add/edit/delete)
  - Line item cards with description, quantity x unit price formula, total
  - Running budget total at bottom
  - Add/edit modal with description, quantity, unit price, live total preview
  - Long-press to delete with confirmation
- [x] NEW: Approval Workflow section
  - Send/Resend Approval button (generates token, opens approval URL)
  - Shows only when client exists and approval not yet approved
- [x] Edit modal: deadline and start date now use `DatePicker` (was text input)
- [x] Edit modal: added start date and estimated duration fields
- [x] Tasks: added delete button on each task card
- [x] Tasks: due date uses `DatePicker` in add task modal (was text input)
- [x] `keyboardDismissMode="on-drag"` on ScrollView
- [x] Added ~55 new i18n keys to en.json and es.json (`projectDetail` namespace)
- [x] Start date and estimated duration shown in details grid when available

## Request Detail — `app/(app)/request-detail.tsx`
- [ ] Not started — need to compare with website
