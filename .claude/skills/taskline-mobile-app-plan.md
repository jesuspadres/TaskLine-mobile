# TaskLine Mobile App — Plan to Perfection

## Executive Summary

This plan transforms TaskLine from a responsive web app into a best-in-class native mobile experience that rivals Jobber, Square, and Housecall Pro — while staying true to TaskLine's core differentiator: **simplicity for solo tradespeople who aren't tech-savvy.**

The strategy is phased over 4 releases, each one shippable and valuable on its own.

---

## Competitive Audit: What "Great" Looks Like

### Jobber Mobile (4.8★, 20K+ reviews)
**Strengths:** One-tap job creation, client communication hub, GPS routing, offline quotes
**Weaknesses:** Overwhelming for solo operators, expensive, English-only
**Steal:** Job creation flow, "today's route" map view

### Housecall Pro (4.7★, 10K+ reviews)
**Strengths:** Dispatch board, payment processing in-field, review requests
**Weaknesses:** Expensive ($49+), US-centric, complex onboarding
**Steal:** In-field payment capture, post-job review request flow

### Square Invoices (4.7★, 50K+ reviews)
**Strengths:** Beautiful invoice creation, instant payment links, clean UI
**Weaknesses:** No project management, no scheduling, no client portal
**Steal:** Invoice creation UX (3-tap invoicing), payment confirmation animations

### Todoist (4.8★, 500K+ reviews)
**Strengths:** Quick add anywhere, natural language input, swipe gestures, offline
**Weaknesses:** Not field-service-specific
**Steal:** Quick capture pattern, gesture system, offline architecture

### Key Takeaway
No competitor does ALL of these well: bilingual, affordable, simple, all-in-one.
TaskLine can win by being the **simplest all-in-one tool** that doesn't make tradespeople feel stupid.

---

## Phase 1: Core Loop MVP (Weeks 1-6)

**Goal:** A tradesperson can manage their day entirely from the mobile app.

### Screens to Build

#### 1.1 Authentication
- Magic link login (same as web — Supabase Auth)
- Biometric unlock (Face ID / fingerprint) for returning users
- "Remember me" with secure token storage

#### 1.2 Home Dashboard
The single most important screen. Answers: "What do I need to do right now?"

```
┌──────────────────────────────────┐
│ ☀️ Good morning, Mike            │
│ 3 things need your attention     │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🔴 2 overdue invoices ($840) │ │  ← Tappable alert cards
│ │    Tap to review →           │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 📬 1 new request             │ │
│ │    Sarah M. — Kitchen wiring │ │
│ └──────────────────────────────┘ │
│                                  │
│ 📅 TODAY                         │
│ ──────────────────────────────── │
│ 9:00  ⚡ Panel upgrade           │
│       John D. • 123 Oak St      │
│       [Navigate] [Start Job]    │
│ ──────────────────────────────── │
│ 11:30 🔧 Outlet installation    │
│       Maria G. • 456 Pine Ave   │
│ ──────────────────────────────── │
│ 2:00  Free                      │
│                                  │
│ 💰 THIS WEEK                    │
│ ┌────────┬────────┬────────────┐ │
│ │$2,450  │ 5 jobs │ 2 pending  │ │
│ │earned  │ done   │ invoices   │ │
│ └────────┴────────┴────────────┘ │
└──────────────────────────────────┘
```

**Why this is better than the web dashboard:**
- Prioritized: urgent items FIRST, schedule SECOND, stats THIRD
- Actionable: every section has a clear next action
- Scannable: answers "what do I do next?" in 3 seconds

#### 1.3 Jobs Inbox (Requests + Bookings)
Combined inbox — all incoming work in one place.

- **Segmented tabs**: All | Requests | Bookings
- **Each card shows**: Client name, service type, date, status badge
- **Swipe right**: Accept/Approve
- **Swipe left**: Decline/Archive
- **Pull to refresh**
- **Empty state**: "No new jobs — share your QR code to get leads!"

#### 1.4 Client List + Detail
- **Search bar** at top (always visible)
- **Recent clients** section (last 5 interacted)
- **Alphabetical list** with section headers (A, B, C...)
- **Client detail**: Contact info, properties, projects, invoices — tabbed layout
- **Quick actions**: Call, Text, Email, Navigate (to property)

#### 1.5 Quick Add (➕ FAB)
Center bottom tab opens a bottom sheet:
- New Client (3 fields: name, phone, email)
- New Request (select client → describe work)
- New Invoice (select client → add items → send)
- Quick Note (text + optional photo)

#### 1.6 Push Notifications
- New service request received
- Booking confirmed/cancelled
- Invoice paid
- Approval needed

### Phase 1 Technical Requirements
- Expo Router setup with bottom tabs
- Supabase auth integration
- API client consuming existing Next.js routes
- TanStack Query for data fetching + caching
- Basic push notification setup (expo-notifications)
- i18n setup mirroring web translations

---

## Phase 2: Full Workflow (Weeks 7-12)

**Goal:** Every feature from the web app is accessible on mobile, optimized for touch.

### 2.1 Project Management
- Project list with status filters (active, on hold, completed)
- Project detail: tasks, files, timeline, approval status
- Create project from request (pre-fill client + description)
- Approval workflow: send for approval, track status

### 2.2 Task Management
- Task list grouped by project OR flat view with filters
- Kanban-style horizontal swipe: Todo → In Progress → Complete
- Due date badges (overdue = red, due today = yellow)
- Quick complete: checkbox tap with haptic + confetti animation

### 2.3 Invoice System
**This is the money feature — must be FLAWLESS.**

Mobile invoice creation (3-step wizard):
```
Step 1: Who?
  → Recent clients (big tappable cards)
  → Search bar

Step 2: What?
  → Add line items
  → Quick items from service catalog
  → Custom item (description + amount)
  → Swipe to delete item
  → Running total at bottom

Step 3: Send
  → Preview PDF (scrollable)
  → Send via Email / SMS / Both
  → Mark as Sent
```

- Invoice status tracking with color-coded cards
- "Payment received" one-tap button
- Overdue invoice reminders (push notification + in-app)

### 2.4 Calendar View
- Month view with dots indicating booked days
- Day view with timeline (like iOS Calendar)
- Tap slot to create booking/block time
- Color-coded by type (booking, deadline, blocked)

### 2.5 Settings
- Profile editing
- Scheduling configuration
- Notification preferences
- Subscription management (link to Stripe portal)
- Language toggle (EN/ES)
- QR code generation + sharing

---

## Phase 3: Mobile-Only Superpowers (Weeks 13-18)

**Goal:** Features that are ONLY possible on mobile, making the app indispensable.

### 3.1 GPS Job Check-In
```
When GPS detects arrival at a property address:

┌──────────────────────────────────┐
│                                  │
│  📍 You've arrived at            │
│  123 Oak Street                  │
│                                  │
│  John's Kitchen Rewire           │
│  Estimate: 3 hours               │
│                                  │
│  ┌──────────────────────────────┐│
│  │     ▶️  START JOB            ││
│  └──────────────────────────────┘│
│                                  │
│  [View Details]  [Call Client]   │
└──────────────────────────────────┘
```

- Starts time tracker
- On "Complete Job": capture photo, add notes, suggest invoice amount based on time × rate

### 3.2 Camera Integration
- Take photos from any context (project, request, property)
- Auto-compress and upload (respect storage limits)
- Annotate photos (draw arrows, circles, text — for showing client the problem)
- Before/after photo sets per project

### 3.3 "My Day" Route Map
- Map showing all today's job locations
- Optimized driving route suggestion
- One-tap navigation to each stop
- Time estimates between jobs
- Re-order stops by dragging pins

### 3.4 Offline Mode
- Full offline access to today's data
- Create clients, update statuses, add notes offline
- Sync queue with conflict resolution
- Clear indicator: "📶 Offline — changes will sync when connected"

### 3.5 Voice Input
- "Hey, add a note to John's project: found water damage behind the wall"
- Voice-to-text for description fields
- Reduces typing with dirty/gloved hands

### 3.6 Smart Suggestions
- After completing a job: "Create invoice for this job?"
- After a client pays: "Send thank you message?"
- After 7 days with no activity from a lead: "Follow up with Sarah?"
- After completing all tasks in a project: "Mark project as complete?"

---

## Phase 4: Polish & Premium (Weeks 19-24)

**Goal:** Match the polish level of top 100 App Store apps.

### 4.1 Dark Mode
- Full dark mode with OLED-true blacks
- Automatic (follow system) or manual toggle
- All status colors adjusted for dark backgrounds

### 4.2 Animations & Micro-interactions
- Spring physics on bottom sheet open/close
- Confetti animation when invoice is paid
- Smooth card transitions (shared element transitions)
- Skeleton loading states for every screen
- Pull-to-refresh with custom TaskLine animation

### 4.3 Widgets
**iOS Widgets:**
- Small: Next appointment (name, time, address)
- Medium: Today's schedule (3 upcoming)
- Large: Dashboard (alerts + schedule + stats)

**Android Widgets:**
- At-a-glance: Next appointment + pending count
- Quick actions: New client, New invoice shortcuts

### 4.4 Apple Watch / WearOS
- Today's schedule on wrist
- "Start Job" / "Complete Job" from watch
- Incoming request notification with Accept/Decline

### 4.5 Haptic Feedback System
```
Light tap:      Button press, navigation
Medium impact:  Swipe action completed, status change
Heavy impact:   Error, destructive action
Success:        Invoice paid, project completed
Warning:        Overdue alert, limit reached
```

### 4.6 Accessibility
- Full VoiceOver / TalkBack support
- Dynamic Type (respect system font size)
- Reduced Motion support
- High contrast mode
- Minimum 4.5:1 contrast ratios

---

## Key Metrics to Track

### Engagement
- **DAU/MAU ratio** — Target: >40% (indicates daily habit)
- **Session length** — Target: 30-90 seconds (glance-and-go)
- **Sessions per day** — Target: 3-5 (check between jobs)
- **Quick Add usage** — Target: >50% of creations via FAB

### Conversion
- **Free → Pro conversion** — Target: 15% within 30 days
- **Mobile-first signups** — Track % who sign up on mobile
- **Invoice send rate** — % of completed jobs that get invoiced
- **Founding member mobile activation** — % who use mobile in first week

### Quality
- **App Store rating** — Target: 4.7+ stars
- **Crash-free rate** — Target: 99.5%+
- **Cold start time** — Target: <2 seconds
- **API response time** — Target: <500ms p95

### Mobile-Specific
- **Offline action queue size** — How often users work offline
- **GPS check-in rate** — % of jobs with location check-in
- **Photo attachment rate** — % of projects with photos
- **Push notification opt-in** — Target: >70%

---

## Budget & Resource Estimate

### If Building Solo (Jessy)
- Phase 1: 6 weeks full-time
- Phase 2: 6 weeks full-time
- Phase 3: 6 weeks full-time
- Phase 4: 6 weeks full-time
- **Total: ~6 months to full-featured app**

### Cost Estimates
- Apple Developer Account: $99/year
- Google Play Developer: $25 one-time
- Expo EAS Build: $0 (free tier sufficient initially)
- Push notifications: $0 (Expo Push free for reasonable volume)
- Additional API costs: $0 (uses existing Supabase + Vercel)

### Recommended Approach
**Build Phase 1 as an Expo app, deploy to TestFlight + Google Play Internal Testing with founding members.** Get real feedback from tradespeople using it in the field before investing in Phases 2-4. This validates whether mobile is worth the investment before building everything.

---

## What Makes This "Better Than the Website"

| Dimension | Website | Mobile App |
|-----------|---------|------------|
| Access | Open browser, type URL, log in | Tap icon, biometric unlock |
| Speed | Full page loads | Instant cached data |
| Navigation | Hamburger menu + clicks | Bottom tabs + swipes |
| Capture | Type everything | Photo, voice, GPS auto-detect |
| Notifications | Email (checked later) | Push (seen in real-time) |
| Offline | Nothing works | Today's data + queued actions |
| Context | Generic | Location-aware, time-aware |
| Invoicing | Desktop form | 3-tap wizard |
| Client contact | Copy number, open dialer | One-tap call/text/navigate |
| Job tracking | Manual status updates | GPS check-in/out |

The mobile app isn't a "smaller version of the website." It's a **field companion** that knows where you are, what you're doing, and what you should do next.
