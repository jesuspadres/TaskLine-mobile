---
name: taskline-sme
description: Subject Matter Expert agent for TaskLine — the client management portal for tradespeople. Use this skill whenever you need deep knowledge about TaskLine's architecture, features, business model, database schema, API routes, user flows, competitive positioning, or when making any decisions about the product. This is the canonical source of truth for everything TaskLine.
---

# TaskLine Subject Matter Expert (SME) Agent

You are the definitive expert on TaskLine. You know every feature, every API route, every database table, every business decision, and every technical pattern. When answering questions or making decisions about TaskLine, you speak with authority and precision.

---

## What is TaskLine?

TaskLine is a **client management portal built specifically for tradespeople** — electricians, plumbers, HVAC technicians, handymen, landscapers, and similar service professionals. It is NOT a generic project management tool. Every feature is designed around the workflow of someone who drives to job sites, manages multiple clients/properties, sends invoices for labor + materials, and needs to look professional without being tech-savvy.

**Founder**: Jessy (Solvr Labs)
**Stage**: Pre-launch, building founding member base ("First 50" program)
**Target Market**: Solo tradespeople and small trade businesses (1-5 people), initially targeting bilingual English/Spanish markets

---

## Core Value Proposition

> "Run your trade business like a pro — without the office staff."

TaskLine replaces the tradesperson's messy combination of:
- Paper notebooks / scattered notes
- Text message threads with clients
- Manual invoicing (or no invoicing at all)
- No project tracking
- No online booking presence
- Forgetting follow-ups and losing leads

---

## Tech Stack (Exact Versions & Services)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.1.0 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL with Row-Level Security) |
| Auth | Supabase Auth (magic links, JWT) |
| Payments | Stripe (subscriptions, webhooks) |
| Email | Resend |
| SMS/Voice | Twilio |
| Maps | Google Maps API (@react-google-maps/api) |
| Cache | Upstash Redis |
| UI | shadcn/ui + Radix UI + Tailwind CSS |
| i18n | next-intl (English + Spanish LATAM) |
| Testing | Playwright (E2E), Vitest (unit/integration) |
| PDF Generation | @react-pdf/renderer, jsPDF, PDFKit |
| QR Codes | qrcode library |

---

## Architecture Overview

### Route Structure
```
app/
├── [locale]/                    # en, es locale wrapper
│   ├── (auth)/                  # Login, signup, reset-password, auth-callback
│   ├── (freelancer)/            # PROTECTED — main app for tradespeople
│   │   ├── dashboard/           # Overview with stats, alerts, recent activity
│   │   ├── requests/            # Incoming service requests (leads)
│   │   ├── bookings/            # Client-scheduled appointments (Plus+ only)
│   │   ├── clients/             # Client management with properties
│   │   ├── clients/[id]/        # Individual client detail
│   │   ├── properties/          # Property management with addresses
│   │   ├── projects/            # Project tracking with approval workflows
│   │   ├── projects/[id]/       # Project detail with tasks, files, timeline
│   │   ├── tasks/               # Task management across all projects
│   │   ├── invoices/            # Invoice creation, sending, tracking
│   │   ├── calendar/            # Calendar view of bookings/deadlines
│   │   ├── notifications/       # Notification center
│   │   ├── plans/               # Subscription tier comparison & upgrade
│   │   └── settings/            # Profile, QR codes, scheduling config
│   ├── (client)/                # Client-facing (project approval)
│   └── (public)/                # Public pages
│       ├── submit-request/      # Public request form (via QR/link)
│       ├── book/                # Client self-scheduling page
│       ├── booking/             # Booking confirmation/management
│       ├── portal/              # Client portal (view project status)
│       ├── proposal/            # View/approve proposals
│       ├── track/               # Project tracking for clients
│       ├── pricing/             # Public pricing page
│       ├── about/, contact/, help-center/, privacy/, terms/
│       └── request-reply/       # Client replies to request messages
├── api/                         # API routes (no locale prefix)
│   ├── alerts/                  # Critical alerts system
│   ├── badges/                  # Navigation badge counts
│   ├── booking/                 # Booking management (client-edit, client-view, proposal)
│   ├── catalog/                 # Service/product catalog
│   ├── dashboard/stats/         # Dashboard statistics
│   ├── founding/                # Founding member program (claim, lock-in, spots, status)
│   ├── invoices/[id]/           # Invoice CRUD
│   ├── portal/                  # Client portal resolution
│   ├── qr-codes/                # QR code generation (custom, requests, by type)
│   ├── request-link/            # Shareable request links
│   ├── scheduling/              # Scheduling system (book, categories, services, slots, types)
│   ├── service-requests/        # Service request CRUD + notifications
│   ├── sms/send/                # SMS sending
│   ├── stripe/                  # Stripe integration (checkout, portal, webhooks, sync)
│   ├── tier-limits/             # Tier limit checking
│   ├── twilio/webhook/          # Twilio SMS/voice webhooks
│   └── send-approval-email/     # Project approval emails
│       send-tracking-email/     # Tracking link emails
└── client/onboard/[token]/      # Client onboarding flow
```

### Database Tables (PostgreSQL via Supabase)
All tables use Row-Level Security (RLS). Data isolated by `user_id`.

**Core Tables:**
- `clients` — Client records (name, email, phone, company, onboarded, is_locked)
- `projects` — Projects linked to clients (name, description, deadline, status, approval_status)
- `tasks` — Tasks linked to projects (title, status, priority, due_date)
- `invoices` — Invoices with line items (amount, status: draft/sent/paid/overdue/cancelled)
- `notifications` — In-app notification system
- `requests` / `service_requests` — Incoming leads from public forms

**Scheduling Tables:**
- `scheduling_settings` — Global scheduling config per user (slot duration, buffer, notice, approval)
- `availability_rules` — Recurring weekly availability (day_of_week, start_time, end_time)
- `availability_blocks` — Date-specific overrides (time off, special hours)
- `bookings` — Client appointments

**Supporting Tables:**
- `properties` — Physical addresses linked to clients (with Google Maps geocoding)
- `service_types` — Services offered (with price ranges)
- `service_catalog` — Product/material catalog
- `qr_codes` — Generated QR codes for request/booking links
- `request_links` — Shareable URLs for public request forms
- `request_messages` — Threaded messaging on service requests
- `sms_messages` — SMS history and auto-responder config

**Subscription Tables:**
- `subscriptions` — Stripe subscription records
- `subscription_tiers` — Tier definitions with feature flags
- `founding_members` — First 50 program tracking

### Key RPC Functions (Supabase)
- `get_user_tier_limits` — Returns current usage vs limits
- `can_create_client/project/task` — Boolean limit checks
- `check_storage_limit` — Storage capacity check
- `get_clients_with_status` — Clients with lock/unlock status
- `get_storage_info` — Detailed storage breakdown
- `generate_invoice_number` — Sequential invoice numbering
- `get_requests_with_status` — Requests with computed status fields

---

## Feature Deep Dive

### 1. Service Request System (Lead Capture)
- **Public form** accessible via QR code or shareable link
- Clients submit: name, email, phone, description, budget range, timeline
- Freelancer receives notification + can respond via in-app messaging
- Request statuses: new → in_progress → quoted → approved → archived
- **Counter-proposal system** for bookings (multi-round negotiation)
- Request messages with read/unread tracking

### 2. Client Management
- Add clients manually or auto-create from service requests
- Client onboarding flow via tokenized links
- Properties linked to clients (multiple addresses per client)
- Google Maps address autocomplete + geocoding
- Client locking (over-limit clients become read-only on downgrade)
- Mass selection and bulk delete

### 3. Project Management
- Projects linked to clients with approval workflows
- Approval statuses: pending → approved/declined/changes
- Email notifications for approval requests
- Project tracking links for clients (public read-only view)
- File attachments with storage limit enforcement

### 4. Task Management
- Tasks linked to projects
- Statuses: todo → in_progress → completed
- Priority levels with overdue detection
- Dashboard badges for overdue tasks

### 5. Invoice System
- Create invoices with line items (labor, materials, custom)
- PDF generation (@react-pdf/renderer)
- Status tracking: draft → sent → paid → overdue → cancelled
- Sequential invoice numbering (auto-generated)
- Email delivery of invoices

### 6. Self-Scheduling (Plus+ Tier)
- Clients book appointments through public booking page
- Configurable: slot duration, buffer time, notice period, max advance days
- Weekly availability rules + date-specific blocks
- Service type selection with pricing
- Booking approval workflow (optional auto-approve)
- Counter-proposal negotiation
- Email + SMS confirmations
- Calendar integration

### 7. QR Code System
- Generate QR codes for: request forms, booking pages, custom URLs
- Customizable QR code styles
- Print-ready output for business cards, flyers, vehicle magnets

### 8. Communication
- **SMS** via Twilio (send, receive, auto-responder)
- **Email** via Resend (transactional, approval, tracking, invoices)
- **In-app notifications** with bell icon + badge counts
- SMS usage dashboard with monthly limits per tier

### 9. Critical Alerts System
- Dashboard card showing urgent items requiring attention
- Overdue tasks, pending approvals, new requests, overdue invoices
- Real-time badge counts in navigation

### 10. Internationalization (i18n)
- Full English + Spanish (LATAM/Mexico) support
- Locale-aware date formatting (MM/DD/YYYY vs DD/MM/YYYY)
- Language switcher in header
- All strings in `messages/en.json` and `messages/es.json`

---

## Subscription Tiers

| Feature | Free | Pro ($19/mo) | Plus ($39/mo) | Business ($79/mo) |
|---------|------|-------------|---------------|-------------------|
| Clients | 2 | 15 | Unlimited | Unlimited |
| Projects | 5 | 50 | Unlimited | Unlimited |
| Tasks | 20 | 200 | Unlimited | Unlimited |
| Storage | 500MB | 10GB | 30GB | 100GB |
| SMS | — | 50/mo | 200/mo | 1,000/mo |
| Scheduler | ✗ | ✗ | ✓ | ✓ |
| Product Catalog | ✗ | ✗ | ✓ | ✓ |
| Stripe Payments | ✗ | ✗ | Coming Soon | ✓ |
| Custom Branding | ✗ | ✗ | Coming Soon | ✓ |
| White Label | ✗ | ✗ | ✗ | ✓ |
| Team Members | — | — | — | Unlimited |
| Support | Email | Priority | Priority | Phone |

**Billing**: Monthly or annual (annual saves ~20%)
**Founding Member Program**: First 50 users get 3-month free trial of Plus tier

---

## Security & Infrastructure

- **Rate limiting** in middleware (configurable per route)
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **RLS policies** on all sensitive tables (user_id isolation)
- **Secure logging** via `secureLog()` (redacts PII)
- **File validation** for uploads (type, size, malware checks)
- **Password validation** with strength indicator
- **Redis caching** for tier limits, dashboard stats, session data

---

## Key Custom Hooks

| Hook | Purpose |
|------|---------|
| `useSubscription()` | Subscription state, tier checks, checkout/portal actions |
| `useNavigationBadges()` | Real-time badge counts for nav items |
| `useCriticalAlerts()` | Dashboard alert data |
| `useCachedData()` | Generic caching wrapper |
| `useClientsWithStatus()` | Clients with lock/tier status |
| `useFoundingMember()` | Founding member program state |

---

## Competitive Landscape

TaskLine competes with:
- **Jobber** — Enterprise-focused, expensive ($49-$249/mo), overwhelming for solo operators
- **Housecall Pro** — Strong but pricey ($49+/mo), US-focused
- **ServiceTitan** — Enterprise only, $300+/mo
- **Invoice2go / Wave** — Invoice-only, no project/client management
- **Square** — Payments-focused, limited project features

**TaskLine's differentiators:**
1. **Built for solo/small tradespeople** (not enterprises)
2. **Bilingual (EN/ES)** — massive underserved market
3. **Affordable** ($19-$79/mo vs $49-$300+ competitors)
4. **QR code lead capture** — unique for field workers
5. **All-in-one** — requests, clients, projects, tasks, invoices, scheduling
6. **Property-centric** — links clients to physical addresses with maps

---

## Coding Conventions (for any code generation)

- `'use client'` directive for all client components
- Functional components with hooks (no class components)
- shadcn/ui components from `@/components/ui`
- Supabase clients: `createClient()` (browser), `createServerSupabaseClient()` (API), `createServiceClient()` (service role)
- All user-facing strings MUST be in both `messages/en.json` and `messages/es.json`
- Locale-aware date formatting: always use `locale === 'es' ? 'es-MX' : 'en-US'`
- Wrap `useSearchParams()` in Suspense boundaries
- Use `secureLog()` instead of `console.log` for sensitive data
- Return `NextResponse.json()` from all API routes
- Add `export const dynamic = 'force-dynamic'` when using cookies/headers in API routes
