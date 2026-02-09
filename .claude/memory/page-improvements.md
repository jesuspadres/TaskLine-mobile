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
**Status: [x] DONE**

### Improvements Made — Requests Segment
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Module-level arrays moved inside component with `useMemo` (i18n-safe)
- [x] `console.error` → `secureLog.error()`, `Alert.alert` → `showToast` + `ConfirmDialog`
- [x] `ActivityIndicator` → `ListSkeleton` for loading state
- [x] SearchBar for filtering by title, description, client name, location, budget
- [x] Sort modal (Oldest, Newest, Name A-Z, Name Z-A)
- [x] Request summary stat cards (New, Reviewing, Accepted, Declined) — clickable to filter
- [x] FilterChips component (default: New)
- [x] Default filter: **New**, default sort: **Oldest first** (matches website)
- [x] Quick actions on cards: Review, Create Proposal, Accept, Decline (matches website)
- [x] Accepted requests show "Convert to Project" action
- [x] Description shown on cards (`project_description` or `description`)
- [x] Location shown on cards (`address_formatted`) — tappable, opens Google Maps
- [x] Budget + timeline/deadline shown on cards
- [x] Client name + avatar on cards (from join or `name` field)
- [x] Removed Create Request button/modal (requests come from clients via portal)
- [x] Removed Edit Request modal (edit via request-detail page)
- [x] Share link + QR code buttons in header (replaces + button)
- [x] Empty state shows "Share Portal" CTA instead of "Add"
- [x] Locale-aware date formatting, haptic feedback, count badge

### Improvements Made — Bookings Segment
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Module-level arrays moved inside component with `useMemo` (i18n-safe)
- [x] `console.error` → `secureLog.error()`, `Alert.alert` → `showToast`
- [x] `ActivityIndicator` → `ListSkeleton` for loading state
- [x] SearchBar for filtering by title, description, client name, location, notes
- [x] Sort modal (Oldest, Newest, Soonest, Latest)
- [x] Booking summary stat cards (Pending, Confirmed, Completed, Cancelled) — clickable to filter
- [x] FilterChips component (default: Pending)
- [x] Default filter: **Pending**, default sort: **Oldest first** (matches website)
- [x] Quick Confirm button on pending cards, Quick Complete on past confirmed
- [x] Past confirmed bookings highlighted with warning border
- [x] Description shown on cards
- [x] Location shown on cards (`address_formatted`) — tappable, opens Google Maps
- [x] Client name + avatar on cards (from join or `client_name` field)
- [x] Removed Create Booking button/modal (bookings come from clients via portal)
- [x] Removed Edit Booking modal and View modal (streamlined to tap → detail)
- [x] Share link + QR code buttons in header (replaces + button)
- [x] Empty state shows "Share Portal" CTA instead of "Add"
- [x] Locale-aware date/time formatting, haptic feedback, count badge
- [x] Added ~100 i18n keys to en.json and es.json (`requests` + `bookings` namespaces)

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
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] `DAYS_OF_WEEK` moved inside component with `useMemo` (i18n-safe)
- [x] `console.error` → `secureLog.error()`, `Alert.alert` → `showToast()`
- [x] `ActivityIndicator` → `ListSkeleton` for loading state
- [x] Locale-aware date/time formatting (en-US / es-MX)
- [x] NEW: Project deadlines as third event type (fetches from `projects` table with client join)
- [x] NEW: Month/List view toggle (grid icon + list icon)
- [x] NEW: List view shows upcoming events grouped by date, with FlatList + EmptyState
- [x] NEW: Events are tappable — navigates to task list, booking-detail, or project-detail
- [x] NEW: Client name and project name shown on event cards
- [x] NEW: Booking time range shown (start – end)
- [x] NEW: Event type legend below calendar grid (Task / Booking / Deadline with colored dots)
- [x] NEW: 3 dot colors on calendar days (blue=task, green=booking, gold=deadline)
- [x] NEW: Past dates shown at 50% opacity
- [x] NEW: Overdue tasks/deadlines highlighted with red border
- [x] NEW: Status labels i18n'd (Pending, In Progress, Completed, Confirmed, etc.)
- [x] Status color maps moved inside `useMemo`
- [x] Haptic feedback on navigation, date selection, view toggle
- [x] Fetches all events (not just current month) for list view
- [x] Added ~35 i18n keys to en.json and es.json (`calendar` namespace)

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
**Status: [x] DONE**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Filter chips by property type: All, Residential, Commercial, Other (scrollable, `useMemo`)
- [x] Sort functionality added: Newest, Oldest, Name A-Z, Name Z-A (sort modal)
- [x] Property count badge in header (solid primary bg, white text for contrast)
- [x] Stats cards: Total, Homes, Commercial, Other — descriptive labels, tappable to filter
- [x] Industrial category merged into Other
- [x] `console.error` replaced with `secureLog.error()`
- [x] `Alert.alert` replaced with `showToast` for success/error feedback
- [x] `ActivityIndicator` replaced with `ListSkeleton` for loading state
- [x] Card tap navigates to `property-detail` (instead of opening edit modal)
- [x] Removed edit modal from list page (edit only in property-detail)
- [x] Added `property_type` field to add form (Select dropdown)
- [x] Property type icon on cards (home/business/construct/location based on type)
- [x] Property type badge displayed on cards when available
- [x] Haptic feedback on add, card tap, filter selection, sort
- [x] `keyboardDismissMode="on-drag"` on FlatList
- [x] Empty state differentiates "no properties" vs "no search results"
- [x] Client select options wrapped in `useMemo`
- [x] Added ~45 i18n keys to en.json and es.json (`properties` namespace)

## Notifications — `app/(app)/notifications.tsx`
**Status: [~] Partially improved**

### Improvements Made
- [x] All hardcoded English strings replaced with `t()` i18n calls
- [x] Filter chip labels moved inside component with `useMemo` (i18n-safe)
- [x] Relative time formatting uses i18n keys
- [x] Fixed navigation: uses `entity_type`/`entity_id` → mobile route mapping instead of broken `link_url`
- [x] Route mapping: request→request-detail, booking→booking-detail, project→project-detail, client→client-detail, invoice→invoices, task→tasks
- [x] Fallback toast when no route available
- [x] Empty state differentiates "all" vs "unread" filters

### Still TODO
- [ ] Compare full feature set with website notifications page

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
**Status: [x] DONE (v3)**

### Round 1 — Initial Implementation
- [x] Dedicated property detail page (read-only view)
- [x] Property name, primary badge, client link, date added
- [x] Full address display, sq ft / year built stat cards
- [x] Access codes, pets, hazards, notes sections
- [x] Edit modal, delete with confirmation, registered in `_layout.tsx`

### Round 2 — Full Overhaul
- [x] Property type icon in name card (home/business/construct/location)
- [x] Property type badge displayed alongside primary badge
- [x] Pets badge shown in name card badges row
- [x] "Navigate" button on address card — opens Google Maps
- [x] Linked Projects section — shows client's projects with status badges, budget, tap to detail
- [x] Safety Information card — combined pets + hazards with colored icons
- [x] Property type Select dropdown in edit form
- [x] Client Select dropdown in edit form (can reassign property)
- [x] Address fields split into line1/line2/city/state/zip in edit form
- [x] Haptic feedback on edit, delete, navigate, project tap
- [x] All i18n keys moved to `propertyDetail.*` namespace (no more borrowing from `clientDetail.*`)
- [x] Added ~20 new i18n keys (navigate, accessCodes, editProperty, deleteProperty, linkedProjects, etc.)
- [x] `console.error` → `secureLog.error()`, `Alert.alert` kept only for destructive delete
- [x] Address display reads `address_formatted` first (website/Google Places), falls back to component fields
- [x] Map preview with `react-native-maps` MapView when lat/lng available (non-interactive, tap to open Maps)
- [x] Address fix also applied to properties list page card addresses

### Round 3 — Schema Fix + Category Cleanup
- [x] Update/insert payloads use website column names (`address_street`, `address_city`, `pet_details`, `property_notes`, etc.)
- [x] Read logic prefers website columns with fallback to old names
- [x] Industrial category removed — merged into Other
- [x] Pets display reads `pet_details` || `pets`, notes reads `property_notes` || `notes`
- [x] Coordinates read `address_lat`/`address_lng` with fallback to `latitude`/`longitude`
- [x] Stats cards: Total, Homes, Commercial, Other (more descriptive labels)

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
**Status: [x] DONE**

### Improvements Made
- [x] Full rewrite with all website fields
- [x] Extended type interface: `address_formatted`, `project_description`, `budget_range`, `timeline`, `name`, `email`, `phone`
- [x] Status badge with `useMemo` color map
- [x] Client info card: avatar, name, email (tappable mailto), phone (tappable tel), "View Client" button
- [x] Details card: budget, deadline/timeline, received date
- [x] Location card: address + "Navigate" button (opens Google Maps)
- [x] Project description card
- [x] Action buttons: Review, Create Proposal, Accept, Decline (for active requests)
- [x] Action buttons: Create Proposal, Archive (for accepted requests)
- [x] Status updates via ConfirmDialog
- [x] Messages card with count badge → taps to dedicated `request-messages.tsx` chat screen
- [x] Message input with send button (in `request-messages.tsx`)
- [x] Metadata footer with request ID
- [x] All strings i18n'd with `requestDetail.*` namespace (~50 keys)
- [x] `console.error` → `secureLog.error()`, `Alert.alert` → `showToast` + `ConfirmDialog`
- [x] `ActivityIndicator` → `ListSkeleton`
- [x] Locale-aware date formatting

## Booking Detail — `app/(app)/booking-detail.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] New page created from scratch (no previous booking detail page existed)
- [x] Registered in `_layout.tsx`, booking cards in jobs.tsx navigate here
- [x] Extended type interface: `client_name`, `client_email`, `client_phone`, `address_formatted`, `address_lat`, `address_lng`, `booking_date`, `invoice_id`
- [x] Status badge with `useMemo` color map (pending, confirmed, completed, cancelled, no_show)
- [x] Past due warning banner for confirmed bookings past their end time
- [x] Client info card: avatar, name, email (tappable mailto), phone (tappable tel), "View Client" button
- [x] Appointment details card: service date, start time, end time, received date
- [x] Location card: address + "Navigate" button (opens Google Maps)
- [x] Description card, Notes card
- [x] Action buttons for pending: Confirm, Cancel
- [x] Action buttons for confirmed: Mark Complete (with 2-option modal: Complete & Invoice vs Just Complete), Cancel
- [x] Action button for completed (no invoice): Create Invoice
- [x] Status updates via ConfirmDialog
- [x] All strings i18n'd with `bookingDetail.*` namespace (~40 keys)
- [x] `secureLog.error()` for error logging, `showToast()` for user feedback
- [x] `ListSkeleton` for loading state
- [x] Locale-aware date/time formatting
- [x] TypeScript clean (passes `npx tsc --noEmit`)

## Request Messages — `app/(app)/request-messages.tsx`
**Status: [x] DONE**

### Improvements Made
- [x] New dedicated chat screen (extracted from request-detail.tsx)
- [x] FlatList-based message rendering (better perf than ScrollView.map)
- [x] Real-time Supabase subscription for new messages
- [x] Chat bubbles: freelancer=right/primary, client=left/gray
- [x] Message input bar with send button + disabled state
- [x] Auto-scroll to bottom on load and new messages
- [x] KeyboardAvoidingView wrapping input
- [x] Header with back button, client name, message count
- [x] Empty state with icon
- [x] i18n'd relative timestamps (just now, Xm ago, Xh ago, Xd ago)
- [x] Sends via website API with Bearer token auth
- [x] Registered in `_layout.tsx`
