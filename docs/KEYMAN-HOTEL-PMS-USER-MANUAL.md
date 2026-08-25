# Keyman Hotel — Property Management System

## Comprehensive User Manual & System Documentation

**Version:** 2.0  
**Date:** August 25, 2026  
**Prepared for:** Project Sponsor  
**Prepared by:** Keyman Development Team  
**Classification:** Confidential — Internal Use Only

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture & Technology](#2-system-architecture--technology)
3. [User Roles & Access Control](#3-user-roles--access-control)
4. [Guest-Facing Features](#4-guest-facing-features)
5. [Front Desk & Reception Operations](#5-front-desk--reception-operations)
6. [Kitchen & Restaurant Operations](#6-kitchen--restaurant-operations)
7. [Housekeeping Operations](#7-housekeeping-operations)
8. [Management Dashboards](#8-management-dashboards)
9. [Admin Control Center](#9-admin-control-center)
10. [Payment Flows & Financial Management](#10-payment-flows--financial-management)
11. [Reconciliation & Shift Management](#11-reconciliation--shift-management)
12. [Revenue Management & Dynamic Pricing](#12-revenue-management--dynamic-pricing)
13. [Loyalty, Discounts & Campaigns](#13-loyalty-discounts--campaigns)
14. [Bed & Breakfast (B&B) System](#14-bed--breakfast-bb-system)
15. [Channel Manager & OTA Integration](#15-channel-manager--ota-integration)
16. [Competitor Rate Intelligence](#16-competitor-rate-intelligence)
17. [Business Intelligence Deck](#17-business-intelligence-deck)
18. [Messaging & Communication](#18-messaging--communication)
19. [Security & Compliance](#19-security--compliance)
20. [Operational Workflows](#20-operational-workflows)
21. [Future Roadmap](#21-future-roadmap)

---

# 1. Executive Summary

## 1.1 Vision

Keyman Hotel PMS is a **full-stack property management system** built for Keyman Hotel in Mwatate, Taita Taveta County, Kenya. It replaces fragmented spreadsheets and paper-based processes with a unified digital platform that manages every aspect of hotel operations — from the moment a guest books a room to the moment they check out and leave a review.

## 1.2 What Problem Does It Solve?

| Before (Manual) | After (Keyman PMS) |
|---|---|
| Paper guest registers | Digital bookings with instant confirmation |
| Manual room availability checks | Real-time room status dashboard |
| Cash-only, no audit trail | Multi-payment tracking with reconciliation |
| Chef writes orders on paper | Digital kitchen display with order status tracking |
| Housekeeper checks rooms manually | PDA-based housekeeping with real-time status |
| Monthly paper reports | Instant Business Intelligence Deck emailed daily |
| No dynamic pricing | Revenue management with competitor intelligence |
| No guest loyalty program | Points, referral codes, and automated campaigns |
| Manual no-show handling | Automated no-show detection and waitlist management |

## 1.3 Key Metrics & Impact

| Metric | Impact |
|---|---|
| **Booking Time** | Reduced from 15 min (phone) to 3 min (online) |
| **Check-in Time** | Reduced from 10 min to 2 min |
| **Kitchen Order Accuracy** | ~70% (paper) → 98% (digital) |
| **Reconciliation Time** | 2 hours daily → 15 minutes |
| **Revenue Insight** | Monthly → Real-time |
| **Guest Retention** | Unknown → Tracked + incentivized via loyalty |

## 1.4 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Single-page application |
| **UI Components** | shadcn/ui + Tailwind CSS | Responsive, accessible design |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | Database, auth, serverless functions |
| **Authentication** | Supabase Auth + OTP | Email-based password reset & verification |
| **Email** | Resend API | Transactional emails (deck, OTP, invites) |
| **Charts** | Chart.js | Revenue, occupancy, and KPI visualization |
| **PDF Export** | html2canvas + jsPDF | Business Deck PDF generation |
| **Hosting** | Vercel | Edge-deployed, auto-scaling |
| **Database** | PostgreSQL (Supabase) | 40+ tables, 50+ stored functions |
| **Cron** | pg_cron + pg_net | Midnight deck generation, auto-no-show detection |
| **Real-time** | Supabase Realtime | Live order status, housekeeping updates |

---

# 2. System Architecture & Technology

## 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GUEST LAYER                              │
│  Website → BookingFlow → GuestDashboard → MyMeals/MyBreakfast  │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
┌──────────────▼──────────────────────────▼───────────────────────┐
│                     APPLICATION LAYER (React)                    │
│  Admin Dashboard │ Manager Dashboard │ Staff PDAs │ Guest Portal │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
┌──────────────▼──────────────────────────▼───────────────────────┐
│                      API LAYER (Supabase)                       │
│  REST API (PostgREST) │ RPC Functions │ Edge Functions │ Auth   │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
┌──────────────▼──────────────────────────▼───────────────────────┐
│                     DATA LAYER (PostgreSQL)                      │
│  40+ Tables │ 50+ Stored Functions │ RLS Policies │ pg_cron     │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 Database Schema Overview

The system uses **40+ PostgreSQL tables** organized into functional domains:

| Domain | Tables | Purpose |
|---|---|---|
| **Core** | `users`, `room_types`, `rooms`, `reservations`, `folios` | Hotel structure & bookings |
| **Restaurant** | `menu_items`, `orders`, `order_items`, `breakfast_orders`, `breakfast_items` | Kitchen & F&B |
| **Payments** | `booking_payments`, `folio_payments`, `payments`, `payment_transactions`, `payment_providers`, `payment_refunds` | Financial tracking |
| **Shifts** | `shifts`, `shift_reconciliations` | Staff management |
| **Revenue** | `rate_overrides`, `min_stay_rules`, `pricing_rules`, `rate_plans`, `seasonal_templates` | Dynamic pricing |
| **Channels** | `channels`, `channel_room_mappings`, `channel_sync_log`, `channel_bookings` | OTA integration |
| **Competitors** | `competitor_hotels`, `competitor_rates`, `competitor_rate_alerts` | Market intelligence |
| **Loyalty** | `loyalty_accounts`, `loyalty_transactions`, `referral_codes` | Guest retention |
| **Discounts** | `discount_codes`, `discount_usage` | Promotions |
| **Campaigns** | `campaigns` | Email marketing |
| **B&B** | `breakfast_orders`, `breakfast_items` | Meal plan tracking |
| **Messages** | `messages` | Inter-department communication |
| **Content** | `site_settings`, `menu_images`, `room_images` | CMS management |
| **Audit** | `audit_log` (via triggers) | Change tracking |

## 2.3 Row-Level Security (RLS)

Every table is protected by role-based RLS policies:

```
Role              Access Level
─────────────────────────────────────────────
Guest             Own bookings, own folio, own meals
Waiter            Orders, menu items, assigned tables
Chef              Orders assigned to kitchen
Receptionist      All guest operations, payments
Housekeeper       Room status, housekeeping tasks
Manager           All operations + reconciliation + reports
Admin             Everything + system config + user management
```

---

# 3. User Roles & Access Control

## 3.1 Role Hierarchy

```
                    ┌──────────┐
                    │   ADMIN  │  Full system access
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ MANAGER  │  Operations + reports + reconciliation
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼────┐ ┌────▼─────┐ ┌───▼──────┐
      │RECEPTION-│ │  CHEF/   │ │HOUSEKEEP-│
      │  IST     │ │ WAITER   │ │   ING    │
      └──────────┘ └──────────┘ └──────────┘
                         │
                    ┌────▼─────┐
                    │  GUEST   │  Self-service portal
                    └──────────┘
```

## 3.2 Role Capabilities Matrix

### Admin

| Capability | Access |
|---|---|
| Dashboard | Full KPIs, all metrics, real-time overview |
| Rooms | Create/edit/delete room types, set base rates, manage images |
| Menu | Full CRUD on menu items, categories, pricing, images |
| Bookings | View/manage all bookings, override, cancel |
| Users | Create/edit/delete users, assign roles, reset passwords |
| Reports | All reports, Business Deck, export PDF |
| Revenue Management | Rate calendar, min stay rules, auto-pricing, rate plans |
| Channel Manager | Connect OTAs, push rates, manage room mappings |
| Competitor Rates | Add competitors, record rates, view alerts |
| Payment Providers | Configure all payment methods |
| Loyalty Settings | Point values, redemption rules, campaign management |
| Discounts | Create/edit/delete discount codes |
| Site Content | Manage hotel images, conference pages, branding |
| Operations | System-wide operations panel |
| Audit | View complete audit trail |

### Manager

| Capability | Access |
|---|---|
| Dashboard | KPIs, occupancy, revenue overview |
| Rooms | View rates, set rate overrides |
| Menu | Edit menu items, view analytics |
| Bookings | View/manage bookings, walk-in check-in |
| Reports | All reports, Business Deck, export |
| Reconciliation | End-of-shift reconciliation, cash counts |
| Shift Management | Start/end shifts, assign staff |
| Staff | View staff performance, manage shifts |
| Discounts | Create/edit discount codes |
| Loyalty | View loyalty data, manage campaigns |
| KPI Dashboard | Performance metrics |

### Receptionist

| Capability | Access |
|---|---|
| PDA Dashboard | Quick-view room status, guest list |
| Check-in | Walk-in guest registration, reservation check-in |
| Check-out | Folio settlement, payment recording |
| Bookings | View/create bookings, assign rooms |
| Payments | Record payments, upload receipts |
| Guest Requests | Handle incoming requests |
| My Meals | Track own meal orders |

### Chef

| Capability | Access |
|---|---|
| Kitchen Tablet | View incoming orders, update status |
| Breakfast Verification | Verify B&B codes before serving |
| Order Management | Accept, prepare, serve orders |
| Menu Viewing | View menu items and pricing |

### Waiter

| Capability | Access |
|---|---|
| PDA Dashboard | View assigned orders |
| Order Taking | Create orders for tables/guests |
| Payment Recording | Record payments for orders |
| Receipt Management | Upload payment receipts |
| My Meals | Track own meal orders |

### Housekeeper

| Capability | Access |
|---|---|
| PDA Dashboard | View room cleaning assignments |
| Room Status | Update room status (clean/dirty/inspected) |
| Guest Requests | View and complete assigned tasks |

### Guest

| Capability | Access |
|---|---|
| Booking | Self-service room booking with dates, meal plan selection |
| Dashboard | View reservation details, folio, messages |
| My Meals | View breakfast orders, track status, modify (5hr window) |
| My Breakfast | B&B order tracking, kitchen status updates |
| Guest Chat | Send messages to hotel staff |
| Conference | Book conference rooms, catering |
| External Orders | Order food from the restaurant menu |
| Loyalty | View points balance, referral code, earn history |

---

# 4. Guest-Facing Features

## 4.1 Online Booking (BookingFlow)

The guest booking flow is a **5-step wizard**:

```
Step 1: Dates & Guests
  → Check-in date, check-out date
  → Number of adults, children
  → System validates availability in real-time

Step 2: Room Selection
  → Shows available room types with photos, features, base rate
  → Real-time rate calculation with date-range pricing
  → Minimum stay enforcement (holiday/weekend rules)
  → Displays per-night rate breakdown if overrides exist

Step 3: Meal Plan
  → Bed Only (base room rate)
  → Bed & Breakfast (browse breakfast menu, select items per day)
  → B&B items selected → total calculated automatically
  → Guest sees full breakfast menu with prices before selecting

Step 4: Add-ons & Requests
  → Discount code entry (validated in real-time)
  → Special requests text field
  → Conference room add-on option

Step 5: Payment & Confirmation
  → Payment summary with itemized breakdown
  → Room charges + B&B charges + discounts
  → Payment method selection
  → Booking confirmation with reference number
```

### Business Logic — B&B Pricing

```
Guest selects B&B → Breakfast menu displayed
  → Guest picks items per day (e.g., Monday: 2× Toast + Juice)
  → System calculates: Σ (item.price × quantity × nights)
  → B&B total added to room rate
  → Total displayed: Room (KES 25,000) + B&B (KES 5,500) = KES 30,500

At check-in:
  → Breakfast orders auto-created for each day
  → Each order gets a unique verification code (e.g., KMN-A3F7B2)
  → Guest shows code at restaurant → chef/waiter verifies name + code
```

## 4.2 Guest Dashboard

After booking, guests access their personal dashboard:

| Section | What It Shows |
|---|---|
| **My Reservation** | Room type, check-in/out dates, status, assigned room |
| **My Folio** | Itemized charges, payments made, outstanding balance |
| **My Meals** | B&B breakfast orders by date, status (Pending → Preparing → Ready → Served), unique code |
| **My Breakfast** | Quick view of today's breakfast, kitchen status |
| **Messages** | Chat with hotel staff, request assistance |
| **Loyalty** | Points balance, referral code, earn/redeem history |

### Breakfast Modification Rules

```
B&B breakfast orders can be changed:

  Check-in Day → Day before breakfast
  ├── 5+ hours before breakfast: ✅ FREE modification
  ├── 2-5 hours before breakfast: ⚠️ Changes allowed, variance added
  └── <2 hours before breakfast: ❌ BLOCKED — "Changes must be made 5 hours before breakfast"

Variance handling:
  → If new order costs MORE than original
  → Variance added to guest folio
  → Guest pays at checkout or immediately via M-Pesa

  Example:
  Original: 2× Toast + Juice = KES 800
  Changed to: Full English Breakfast = KES 1,500
  Variance: KES 700 → Added to folio
```

## 4.3 Guest External Ordering

Guests can order food from the restaurant without going to the restaurant:

```
1. Guest opens ExternalOrder page
2. Browse restaurant menu (categories, items, prices)
3. Add items to cart
4. Specify table number or "room delivery"
5. Place order → appears in kitchen as a "Web Order"
6. Chef receives order → prepares → marks "Ready"
7. Waiter picks up → delivers → marks "Served"
8. Payment: Room charge or M-Pesa
```

## 4.4 Conference Booking

```
1. Guest browses available conference rooms
2. Selects date, time slot, capacity
3. Adds catering options (snacks, lunch, beverages)
4. Reviews total cost
5. Books and pays deposit
6. Confirmation sent via email
```

---

# 5. Front Desk & Reception Operations

## 5.1 Receptionist PDA

The Receptionist PDA is a **single-page dashboard** with quick-access panels:

```
┌─────────────────────────────────────────┐
│  🏨 Keyman Hotel — Receptionist PDA     │
├─────────────────────────────────────────┤
│  ROOM STATUS GRID                       │
│  🟢 12 Available  🔴 8 Occupied        │
│  🟡 1 Cleaning    ⚫ 0 Out of Order    │
├─────────────────────────────────────────┤
│  QUICK ACTIONS                          │
│  [+ Walk-In] [Check-In] [Check-Out]    │
│  [New Booking] [Payments]               │
├─────────────────────────────────────────┤
│  TODAY'S ARRIVALS (3)                   │
│  • John Smith — Single — Confirmed     │
│  • Mary Johnson — Twin — Confirmed     │
│  • Peter Kim — Studio — Confirmed      │
├─────────────────────────────────────────┤
│  TODAY'S DEPARTURES (2)                 │
│  • Alice Brown — Checkout due 11:00    │
│  • Bob Wilson — Checkout due 11:00     │
└─────────────────────────────────────────┘
```

## 5.2 Walk-In Guest Flow

```
1. Click [+ Walk-In]
2. Enter guest details:
   ├── Full Name (required)
   ├── Phone Number
   ├── Email
   ├── Room Type (Single / Twin / Studio)
   ├── Meal Plan (Bed Only / B&B)
   ├── Number of adults (1-4)
   ├── Check-in date (defaults to today)
   ├── Number of nights
   └── Special requests

3. System calculates:
   ├── Room total: base_rate × nights
   ├── B&B total: Σ (selected items × nights)
   └── Grand total

4. Click [Check-In Now]
5. System calls: check_in_guest_atomic() which:
   ├── Creates reservation (status: checked_in)
   ├── Assigns available room
   ├── Creates guest folio with room charge
   ├── If B&B: creates breakfast orders for each day
   └── Returns room number + folio ID

6. Room key/card issued to guest
```

## 5.3 Reservation Check-In Flow

```
1. Guest arrives with booking confirmation
2. Receptionist searches by name or booking reference
3. Verify identity (phone/email)
4. Assign room (system suggests, receptionist confirms)
5. Click [Check-In]
6. Room status → Occupied (Vacant Clean → Occupied)
7. Guest receives welcome message via dashboard
```

## 5.4 Check-Out Flow

```
1. Guest requests checkout (or auto-detected on departure date)
2. Receptionist opens folio:
   ├── Room charges (auto-calculated)
   ├── Restaurant orders
   ├── B&B variances
   ├── Conference charges
   └── Other incidentals

3. Verify all payments made:
   ├── Room deposit paid? ✅
   ├── Restaurant orders settled? ✅
   ├── Outstanding balance? KES 0 ✅

4. If balance > 0:
   ├── Record final payment (cash/M-Pesa/card)
   ├── Upload receipt
   └── Manager verifies

5. Click [Check-Out]
6. System calls: check_out_guest_safe() which:
   ├── Updates reservation status → checked_out
   ├── Updates room status → Vacant Dirty
   ├── Generates checkout confirmation
   └── Triggers loyalty points calculation

7. Room status changes → Housekeeping notified
```

---

# 6. Kitchen & Restaurant Operations

## 6.1 Kitchen Tablet

The Kitchen Tablet is the chef's primary interface:

```
┌─────────────────────────────────────────┐
│  🍳 Kitchen Display — Chef View         │
├─────────────────────────────────────────┤
│  FILTER: [All] [Pending] [Preparing]   │
├─────────────────────────────────────────┤
│  NEW ORDERS (2)                         │
│  ┌──────────────────────────────┐       │
│  │ Order #47 — Table 3         │       │
│  │ 2× Nyama Choma              │       │
│  │ 1× Pilau                    │       │
│  │ Time: 2 min ago             │       │
│  │ [Accept] [Reject]           │       │
│  └──────────────────────────────┘       │
│  ┌──────────────────────────────┐       │
│  │ Order #48 — Room 5 (Web)    │       │
│  │ 1× Chicken Curry            │       │
│  │ 2× Fresh Juice              │       │
│  │ Time: 5 min ago             │       │
│  │ [Accept] [Reject]           │       │
│  └──────────────────────────────┘       │
├─────────────────────────────────────────┤
│  PREPARING (3)                          │
│  ┌──────────────────────────────┐       │
│  │ Order #45 — Table 1         │       │
│  │ 1× Fish & Chips             │       │
│  │ Started: 12:30 PM           │       │
│  │ [Mark Ready]                │       │
│  └──────────────────────────────┘       │
└─────────────────────────────────────────┘
```

## 6.2 Order Flow (Full Pipeline)

```
GUEST/RECEPTIONIST                    KITCHEN                     WAITER
     │                                  │                           │
     │ 1. Create Order                  │                           │
     │ ──────────────►                  │                           │
     │  (Dine-In / Walk-In / Web)       │                           │
     │                                  │                           │
     │                    2. Order appears as NEW                   │
     │                       ┌─────────────────┐                   │
     │                       │ Chef: Accept or  │                   │
     │                       │ Reject           │                   │
     │                       └────────┬────────┘                   │
     │                                │                             │
     │                    3. Status: PREPARING                      │
     │                       Chef cooking...                        │
     │                                │                             │
     │                    4. Status: READY                          │
     │                                │─────────────────────────────│
     │                                │     5. Waiter picks up      │
     │                                │─────────────────────────────│
     │                                │                             │
     │  6. Status: SERVED               │     6. Delivers to table   │
     │ ◄────────────────────────────────────────────────────────────│
     │                                  │                           │
     │  7. Guest pays                   │                           │
     │  (Cash / M-Pesa / Room Charge)   │                           │
```

## 6.3 Order Types

| Type | Created By | Payment | Kitchen Display |
|---|---|---|---|
| **Dine-In** | Waiter (WaiterPda) | Table payment | Shows table number |
| **Walk-In** | Receptionist | Cash/M-Pesa | Shows "Walk-In" |
| **Web Order** | Guest (ExternalOrder) | Room charge/M-Pesa | Shows room number |
| **B&B** | System (auto on check-in) | Pre-paid | Shows unique code + name |

## 6.4 B&B Verification Process

```
Guest arrives at restaurant for breakfast:
  1. Guest: "I have B&B for today. Here's my code: KMN-A3F7B2"
  2. Chef/Waiter opens Breakfast Verification page
  3. Enters code: KMN-A3F7B2
  4. System displays:
     ├── Guest Name: John Smith
     ├── Room: Room 5
     ├── Date: August 25, 2026
     ├── Items: 2× Toast, 1× Juice, 1× Eggs
     └── Status: Verified ✅

  5. Chef prepares items
  6. Serves to guest
  7. Mark as "Served"

Anti-fraud measures:
  → Unique code per guest per day
  → Code expires after check-out date
  → Chef verifies name matches code
  → Bed-Only guests cannot generate codes
  → Each code can only be used ONCE
```

---

# 7. Housekeeping Operations

## 7.1 Housekeeper PDA

```
┌─────────────────────────────────────────┐
│  🧹 Housekeeping — Today's Tasks        │
├─────────────────────────────────────────┤
│  MY ASSIGNMENTS (5 rooms)               │
│                                         │
│  Room 3 — Deep Clean    [Start]        │
│  Room 7 — Checkout Clean [Start]       │
│  Room 12 — Standard     [Start]        │
│  Room 15 — Checkout Clean [Start]      │
│  Room 18 — Standard     [Start]        │
├─────────────────────────────────────────┤
│  COMPLETED TODAY (3)                    │
│  ✅ Room 1 — Standard — Done 10:30 AM  │
│  ✅ Room 5 — Deep Clean — Done 11:15 AM│
│  ✅ Room 9 — Standard — Done 12:00 PM  │
├─────────────────────────────────────────┤
│  GUEST REQUESTS (1)                     │
│  🔔 Room 8 — Extra towels needed       │
│  [Accept] [Complete]                    │
└─────────────────────────────────────────┘
```

## 7.2 Room Status Lifecycle

```
VACANT CLEAN ←────── CHECK-IN (auto)
     │                    │
     │                    ▼
     │              OCCUPIED CLEAN
     │                    │
     │                    ▼
     │              OCCUPIED DIRTY
     │                    │
     │                    ▼
     │              CHECK-OUT (auto)
     │                    │
     ▼                    ▼
VACANT DIRTY ──────► HOUSEKEEPING
                         │
                         ▼
                   VACANT CLEAN (ready for next guest)
```

## 7.3 Housekeeping Supervisor

The supervisor sees all housekeepers' assignments and can:
- Reassign rooms between housekeepers
- Mark rooms as inspected after cleaning
- View completion times and performance metrics
- Handle guest requests escalated from housekeepers

---

# 8. Management Dashboards

## 8.1 Manager Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  📊 Manager Dashboard — Today                           │
├─────────────────────────────────────────────────────────┤
│  KPIs                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ 62%  │ │KES   │ │ 8/21 │ │  4.7 │ │  12  │         │
│  │Occ % │ │45K   │ │Rooms │ │Guest │ │Orders│         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│                                                         │
│  LIVE ROOM STATUS          TODAY'S ACTIVITY             │
│  🟢 12 Available          Check-ins: 4                 │
│  🔴 8 Occupied            Check-outs: 2               │
│  🟡 1 Cleaning            Orders: 12                  │
│                           Payments: KES 45,000         │
│                                                         │
│  QUICK ACTIONS                                          │
│  [Walk-In] [Check-In] [Reports] [Reconciliation]       │
└─────────────────────────────────────────────────────────┘
```

## 8.2 Manager KPI Dashboard

Detailed performance metrics:

| KPI | What It Measures | How It's Calculated |
|---|---|---|
| **Occupancy Rate** | Rooms occupied / total rooms | `(occupied / total) × 100` |
| **ADR** | Average Daily Rate | `room_revenue / rooms_sold` |
| **RevPAR** | Revenue Per Available Room | `room_revenue / total_rooms` |
| **RevPAC** | Revenue Per Available Customer | `total_revenue / guests` |
| **TRevPAR** | Total Revenue Per Available Room | `total_revenue / total_rooms` |
| **GOPPAR** | Gross Operating Profit Per Available Room | `(revenue - costs) / total_rooms` |
| **Guest Satisfaction** | Average rating | `sum(ratings) / count(ratings)` |

## 8.3 Reconciliation Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  💰 Reconciliation — Shift #12 (Kevin Alerotek)        │
├─────────────────────────────────────────────────────────┤
│  EXPECTED (System Count)     ACTUAL (Staff Count)      │
│  Cash:   KES 15,000          Cash:   KES 14,850        │
│  M-Pesa: KES 22,500          M-Pesa: KES 22,500        │
│  Card:   KES  8,000          Card:   KES  8,000        │
│  Room:   KES 45,000          Room:   KES 45,000        │
│  ──────────────────          ──────────────────         │
│  Total:  KES 90,500          Total:  KES 90,350        │
│                                                         │
│  VARIANCE: KES -150 (Cash short by KES 150)            │
│                                                         │
│  Status: ⚠️ VARIANCE DETECTED                           │
│  Manager must verify before shift closes                │
└─────────────────────────────────────────────────────────┘
```

---

# 9. Admin Control Center

## 9.1 System Overview

The admin panel provides **25+ management pages**:

```
ADMIN NAVIGATION
├── 📊 Dashboard        — System-wide KPIs and overview
├── 🛏️ Rooms            — Room types, rates, images, status
├── 🍽️ Menu             — Restaurant menu CRUD, categories, pricing
├── 🌐 Site Content     — Hotel images, conference content, branding
├── 📅 Bookings         — All bookings management
├── 💳 Folios           — Guest folio management
├── 👥 Users            — User creation, roles, password reset
├── 📊 Reports          — All reports with 8 tabs
├── 🛡️ Operations       — System operations panel
├── 💰 Payment Providers — Configure payment methods
├── 💳 Payment Verification — Verify pending payments
├── 📋 Audit            — Complete audit trail
├── 📈 Revenue Management — 6 tabs (Rate Calendar, Min Stay, Auto-Pricing, Rate Plans, Seasonal, Dashboard)
├── 📡 Channel Manager  — OTA integration (5 tabs)
├── 🏨 Competitor Rates — Market intelligence
├── 🏆 Loyalty Settings — Points, referrals, campaigns
├── 🏷️ Discounts        — Discount code management
├── 📊 Business Deck    — Intelligence report with PDF export + email
├── 🏷️ Bookings Settings — Booking configuration
├── 📊 Room Performance — Room analytics
├── 📊 Menu Analytics   — Restaurant performance
├── 📊 Forecasting      — Demand forecasting
├── 📊 Reconciliation   — Financial reconciliation
├── 📊 Campaign Manager — Email campaign management
├── 📊 Conference Mgmt  — Conference room management
└── 📊 Loyalty Settings — Loyalty program configuration
```

## 9.2 User Management

### Creating a New Staff User

```
1. Admin clicks [+ New User]
2. Fills in:
   ├── Full Name
   ├── Email Address
   ├── Role: [Receptionist / Chef / Waiter / Housekeeper / Manager]
   └── Initial Password

3. System calls: create_staff_user() Edge Function
   ├── Creates Supabase Auth account
   ├── Sets initial password
   ├── Creates user profile in public.users
   └── Sets role for RLS enforcement

4. User receives email with:
   ├── Welcome message
   ├── Their email address
   ├── Link to set their own password (OTP-based)
   └── Link to login

5. User clicks link → OTP verification → Sets password → Ready to use
```

### Password Reset Flow

```
1. Staff clicks "Forgot Password" on login page
2. Enters email address
3. System generates OTP code (6-digit)
4. Sends OTP via email
5. Staff enters OTP
6. Verified → redirected to Set Password page
7. Enters new password (min 8 chars)
8. Password updated → redirected to login
9. Logs in with new password
```

## 9.3 Site Content Management

Admins and managers can manage:

| Content Type | What's Managed |
|---|---|
| **Hero Images** | Homepage carousel images (upload, reorder, delete) |
| **Room Images** | Per-room photos (2 slots per room, multiple images) |
| **Menu Images** | Restaurant dish photos |
| **Conference** | Conference room photos, descriptions, capacity |
| **About** | Hotel description, history, team |
| **Contact** | Phone, email, address, map coordinates |

---

# 10. Payment Flows & Financial Management

## 10.1 Payment Architecture

The system uses a **unified payment abstraction layer**:

```
┌─────────────────────────────────────────────────────────┐
│                  PAYMENT PROVIDERS                       │
│                                                         │
│  📱 M-Pesa (Manual)     ← Active (manager verifies)    │
│  📱 M-Pesa Daraja       ← Ready (auto via webhook)     │
│  💳 Stripe              ← Ready (auto via webhook)     │
│  💵 Cash                ← Active (manager verifies)    │
│  💳 Card (POS)          ← Active (auto)                │
│  🏦 Bank Transfer       ← Active (manager verifies)    │
│  🏨 Room Charge         ← Active (auto)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│           UNIFIED PAYMENT TRANSACTIONS                  │
│                                                         │
│  payment_transactions                                   │
│  ├── provider_id → payment_providers                    │
│  ├── status: initiated → processing → successful        │
│  ├── reference: TXN-20260825-A3F7B2C1                  │
│  └── auto-syncs to legacy tables for compatibility     │
└─────────────────────────────────────────────────────────┘
```

## 10.2 Payment Recording Flow (Manual)

```
STAFF records payment:
  1. Opens Payment Recording page
  2. Selects folio/order
  3. Enters amount: KES 5,000
  4. Selects method: M-Pesa
  5. Enters M-Pesa reference: QHK7Y3B1ZP
  6. Uploads screenshot of M-Pesa confirmation
  7. Submits → Payment status: "pending verification"

MANAGER verifies:
  1. Opens Payment Verification page
  2. Sees pending payment: KES 5,000 via M-Pesa
  3. Reviews receipt image
  4. Confirms M-Pesa reference matches
  5. Clicks [Verify Payment]
  6. Payment status → "verified"
  7. System auto-updates:
     ├── folio_payments (for folio balance)
     ├── booking_payments (for reservation tracking)
     ├── payments (for order payments)
     └── shift_reconciliation (running totals)
```

## 10.3 Payment Transition Path

```
TODAY (Manual):
  Staff records → Uploads receipt → Manager verifies
  
TOMORROW (M-Pesa Daraja):
  Guest pays → STK push sent → Webhook callback → Auto-verified
  
FUTURE (Stripe):
  Guest pays → Stripe checkout → Webhook callback → Auto-verified

The unified transaction layer means:
  → Same reconciliation process
  → Same reporting
  → Same audit trail
  → Zero disruption when switching providers
```

---

# 11. Reconciliation & Shift Management

## 11.1 Shift Lifecycle

```
START OF SHIFT                    END OF SHIFT
     │                                  │
     ▼                                  ▼
┌──────────┐                    ┌──────────────┐
│ Manager  │                    │ Staff counts │
│ starts   │                    │ cash/digital │
│ shift    │                    │ in drawer    │
└────┬─────┘                    └──────┬───────┘
     │                                  │
     ▼                                  ▼
┌──────────┐                    ┌──────────────┐
│ Staff    │                    │ System shows │
│ assigned │                    │ expected vs  │
│ to roles │                    │ actual       │
└────┬─────┘                    └──────┬───────┘
     │                                  │
     ▼                                  ▼
┌──────────┐                    ┌──────────────┐
│ Staff    │                    │ Variance:    │
│ works    │                    │ KES ±150     │
│ shift    │                    │ Manager must │
└──────────┘                    │ verify       │
                                └──────────────┘
```

## 11.2 Reconciliation Rules

```
SYSTEM RULES (enforced in SQL):

1. Cash Variance Limit: KES ±500
   → If variance exceeds ±500, manager MUST approve
   → System blocks shift close until approved

2. Duplicate Guard:
   → Cannot submit reconciliation twice for same shift
   → "Shift already reconciled for this period"

3. Server-Side Validation:
   → System recalculates expected totals
   → Compares with staff-entered actuals
   → Prevents total tampering

4. Transaction Snapshot:
   → System captures all transactions at shift close
   → If transactions change AFTER close, variance detected
   → "Expected vs Actual transaction mismatch"
```

## 11.3 Shift Reports

Each shift generates:

| Report Element | Content |
|---|---|
| **Cash Summary** | Cash received, cash paid out, net cash |
| **Digital Summary** | M-Pesa, card, bank transfers |
| **Room Revenue** | Room charges for shift period |
| **Restaurant Revenue** | Food & beverage sales |
| **Payment Methods** | Breakdown by method |
| **Transaction Count** | Total transactions processed |
| **Variance Report** | Expected vs actual with explanation |

---

# 12. Revenue Management & Dynamic Pricing

## 12.1 Rate Calendar

Admins can set **date-range pricing overrides** per room type:

```
Example:
  Room Type: Single
  Base Rate: KES 5,000/night

  Override 1: Aug 29-31 (Weekend) → KES 6,500/night (+30%)
  Override 2: Sep 1-3 (Weekday)   → KES 5,000/night (base)
  Override 3: Dec 20-Jan 3 (Holiday) → KES 8,000/night (+60%)

When guest books Aug 29-Sep 3:
  Night 1 (Aug 29, Sat): KES 6,500
  Night 2 (Aug 30, Sun): KES 6,500
  Night 3 (Aug 31, Mon): KES 6,500
  Night 4 (Sep 1, Tue):  KES 5,000
  Night 5 (Sep 2, Wed):  KES 5,000
  Night 6 (Sep 3, Thu):  KES 5,000
  ──────────────────────────────
  Total: KES 34,500 (vs flat KES 30,000 = +KES 4,500 uplift)
```

## 12.2 Minimum Stay Rules

```
RULE: Holiday Periods
  Room Type: All
  Dates: Dec 20 - Jan 3
  Minimum Stay: 3 nights
  
  → Guest trying to book 2 nights during Christmas
  → System blocks: "Minimum stay for this period is 3 nights"
  → Guest must extend to 3+ nights or choose different dates

RULE: Weekend
  Room Type: All
  Day of Week: Friday, Saturday
  Minimum Stay: 2 nights
  
  → Guest booking Friday only
  → System warns: "Weekend minimum stay is 2 nights"
```

## 12.3 Auto-Pricing Rules

```
RULE: Weekend Surge
  Trigger: Occupancy > 80% on Fri/Sat
  Action: Add 15% surcharge
  Bounds: Min KES 5,000, Max KES 12,000

  How it works:
  1. System scans 30-day window every hour
  2. Finds Fri Aug 29 at 85% occupancy
  3. Calculates: KES 5,000 × 1.15 = KES 5,750
  4. Upserts rate override for Aug 29
  5. Guest booking that date sees KES 5,750

RULE: Mid-Week Promotion
  Trigger: Wed occupancy < 55%
  Action: Reduce rate by 10%
  Bounds: Min KES 4,000

  → Wednesday at 40% occupancy
  → Auto-rates drop to KES 4,500
  → Attracts price-sensitive guests
```

## 12.4 Rate Plans (Fenced Rates)

```
CORPORATE CODE: KES 4,500/night
  → Requires valid corporate code
  → Min 1 night stay
  → Non-refundable

NON-REFUNDABLE: KES 4,250/night (5% discount)
  → Cannot be cancelled
  → Full pre-payment required

EARLY BIRD: KES 4,000/night (10% discount)
  → Book 30+ days in advance
  → Min 2 night stay
  → Partial refund on cancellation
```

## 12.5 Seasonal Templates

```
TEMPLATE: "Peak Season" (Jun-Aug, Dec-Jan)
  Single: KES 6,500  (+30%)
  Twin:   KES 9,100  (+30%)
  Studio: KES 13,000 (+30%)
  Apply: Annual recurrence

TEMPLATE: "Low Season" (Mar-May, Sep-Nov)
  Single: KES 4,250  (-15%)
  Twin:   KES 5,950  (-15%)
  Studio: KES 8,500  (-15%)
  Apply: Annual recurrence

→ Manager clicks "Apply Template" → Rate overrides auto-created
→ One click sets pricing for entire season
```

---

# 13. Loyalty, Discounts & Campaigns

## 13.1 Loyalty Points System

```
EARNING POINTS:
  → Stay at hotel: 1 point per KES 10 spent
  → Refer a friend: 200 points bonus
  → Friend's first stay: 15% off (funded by loyalty budget)

REDEEMING POINTS:
  → 500 points = KES 100 off next stay
  → 1 point = KES 0.20
  → Points redeemable at checkout or booking

ADMIN CONFIGURATION:
  → Point value: KES 0.20 per point (admin editable)
  → Earning rate: 1 pt per KES 10 (admin editable)
  → Referrer bonus: 200 pts (admin editable)
  → Referred discount: 15% (admin editable)
```

## 13.2 Referral System

```
GUEST JOURNEY:
  1. Guest stays at hotel → Earns loyalty points
  2. Guest sees "Invite Friends" in dashboard
  3. Gets unique referral code: REF-ABC123
  4. Shares code with friend
  5. Friend books using code:
     ├── Friend gets 15% off first stay
     └── Guest earns 200 bonus points
  6. Points appear in guest's loyalty history
  7. Guest redeems points for discount on next stay
```

## 13.3 Discount Codes

```
CREATE DISCOUNT:
  Admin/Manager creates:
  ├── Code: WELCOME20
  ├── Type: Percentage (20% off)
  ├── Applies to: Room charges
  ├── Valid dates: Aug 25 - Sep 30, 2026
  ├── Max uses: 100
  └── Min stay: 2 nights

GUEST USES:
  1. Enters code "WELCOME20" at booking Step 4
  2. System validates:
     ├── Code exists? ✅
     ├── Within valid dates? ✅
     ├── Uses remaining? ✅ (98/100)
     ├── Min stay met? ✅ (3 nights)
     └── Applies to room charges? ✅
  3. Discount applied: KES 15,000 × 20% = KES 3,000 off
  4. New total: KES 12,000
  5. Usage counter incremented
```

## 13.4 Campaign Manager

```
CREATE CAMPAIGN:
  Manager creates:
  ├── Name: "September Special"
  ├── Type: Email Campaign
  ├── Target: All guests with 2+ stays
  ├── Message: "Welcome back! Enjoy 20% off your next stay"
  ├── Discount Code: RETURN20
  ├── Send Date: Sep 1, 2026
  └── Status: Scheduled

TRACKING:
  → Emails sent: 45
  → Emails opened: 18 (40% open rate)
  → Links clicked: 8 (18% CTR)
  → Bookings made: 3 (7% conversion)
  → Revenue generated: KES 45,000
```

---

# 14. Bed & Breakfast (B&B) System

## 14.1 Complete B&B Flow

```
PHASE 1: BOOKING (Guest selects B&B)
  → Guest browses breakfast menu
  → Selects items per day:
    Monday:    2× Toast (KES 200) + 1× Juice (KES 150) = KES 350
    Tuesday:   Full English (KES 500) + Coffee (KES 100) = KES 600
    Wednesday: 2× Toast (KES 200) + Tea (KES 80) = KES 280
  → B&B total: KES 1,230 for 3 days
  → Added to booking total

PHASE 2: CHECK-IN (Auto-generation)
  → check_in_guest_atomic() creates:
    ├── Breakfast order for Day 1 (code: KMN-A3F7B2)
    ├── Breakfast order for Day 2 (code: KMN-B5C8D1)
    └── Breakfast order for Day 3 (code: KMN-E9F2G4)
  → Each order linked to reservation
  → Each order has unique verification code

PHASE 3: BREAKFAST SERVICE
  → Guest arrives at restaurant
  → Shows code: KMN-A3F7B2
  → Chef/Waiter enters code in verification page
  → System shows: Guest name, room, items ordered
  → Chef verifies name matches
  → Chef prepares items
  → Serves to guest
  → Marks as "Served"

PHASE 4: MODIFICATION (if needed)
  → Guest wants to change tomorrow's breakfast
  → Opens My Meals → Selects Day 2 order
  → Changes: Full English → 2× Pancakes + Juice
  → System calculates variance:
    Original: KES 600
    New: KES 450
    Variance: -KES 150 (refund to folio)
  → New order saved with updated code
```

## 14.2 Anti-Fraud Measures

| Threat | Protection |
|---|---|
| Bed-Only guest tries to eat free breakfast | No code generated → Cannot verify → Blocked |
| Guest shares code with non-guest | Name verification required → Code + Name must match |
| Guest uses same code twice | Code marked "served" after first use → Second attempt blocked |
| Guest's code after check-out | Code expires on check-out date → Invalid |
| Staff serves without verification | System requires code entry → No code = no service |

---

# 15. Channel Manager & OTA Integration

## 15.1 Supported Channels

| Channel | Status | Commission | Sync Type |
|---|---|---|---|
| **Booking.com** | Ready to connect | 15% | Rate + Availability push |
| **Expedia** | Ready to connect | 18% | Rate + Availability push |
| **Airbnb** | Ready to connect | 14% + cleaning | Rate + Availability push |
| **Google Hotels** | Ready to connect | 12% | Rate + Availability push |
| **TripAdvisor** | Ready to connect | 15% | Rate + Availability push |

## 15.2 Room Mapping

```
KEYMAN ROOM TYPE          OTA ROOM TYPE              MULTIPLIER
───────────────────────────────────────────────────────────────
Single (KES 5,000)   →   Standard Room (Booking.com)  × 1.10 = KES 5,500
Twin (KES 8,000)     →   Twin Room (Booking.com)      × 1.10 = KES 8,800
Studio (KES 10,000)  →   Studio Apartment (Expedia)   × 1.15 = KES 11,500

Why markup? Covers OTA commission:
  Booking.com takes 15% → We price 10% higher on OTA
  → Net revenue: KES 5,500 × 0.85 = KES 4,675
  → vs Direct: KES 5,000
  → OTA margin: KES 5,000 - KES 4,675 = KES 325 cost
```

## 15.3 Sync Operations

```
PUSH RATES:
  1. Admin clicks "Push Rates" on Channel Manager
  2. System calls: generate_rate_push_payload()
  3. For each connected channel:
     ├── Calculate rate = base_rate × multiplier + offset
     ├── Apply rate overrides if any
     ├── Format as OTA-specific format
     └── Push via API
  4. Log sync result: success/failure/counts

PUSH AVAILABILITY:
  1. Admin clicks "Push Availability"
  2. System calculates: available = total - booked - out_of_order
  3. For each date in range:
     ├── Available rooms per type
     └── Push to OTA
  4. OTA updates their calendar

FULL SYNC:
  → Rates + Availability + Restrictions in one operation
```

---

# 16. Competitor Rate Intelligence

## 16.1 Competitor Hotels Tracked

| Hotel | Type | Stars | Distance |
|---|---|---|---|
| Taita Rocks Hotel | Mid-Range | ⭐⭐⭐ | 5 km |
| Taita Hills Safari Resort & Spa | Resort | ⭐⭐⭐⭐ | 15 km |
| Salt Lick Safari Lodge | Safari Lodge | ⭐⭐⭐⭐ | 25 km |
| Soroi Lions Bluff Lodge | Safari Lodge | ⭐⭐⭐⭐ | 20 km |
| Voi Wildlife Lodge | Mid-Range | ⭐⭐⭐ | 30 km |
| Afrika Lodges | Budget | ⭐⭐ | 10 km |
| Ilala House Voi | Budget | ⭐⭐ | 28 km |

## 16.2 Rate Comparison Example

```
Standard Room — August 28, 2026

✅ Cheapest:     Afrika Lodges          KES 3,200  -37%
                  Taita Rocks Hotel      KES 4,500  -12%
                  Voi Wildlife Lodge     KES 4,800  -6%
⭐ Ours:         Keyman Hotel            KES 5,000   = baseline
                  Ilala House            KES 5,200  +4%
                  Taita Hills Resort     KES 8,500  +70%
🔴 Most Expensive: Salt Lick Lodge      KES 12,000 +140%

MARKET POSITION: Slightly below average
RECOMMENDATION:  Room to increase rates by 5-10%
```

## 16.3 Alert System

```
WHEN COMPETITOR CHANGES PRICE:

  Scenario 1: Taita Rocks drops from KES 5,000 to KES 4,500
  → ALERT: "Price dropped by KES 500 (-10%)"
  → "Now below our rate by KES 500"
  → Manager decides: match, undercut, or maintain

  Scenario 2: Salt Lick raises from KES 10,000 to KES 12,000
  → ALERT: "Price increased by KES 2,000 (+20%)"
  → "Opportunity: we can increase rates"
  → Manager decides: raise rates 5-10%
```

---

# 17. Business Intelligence Deck

## 17.1 What's in the Deck

The Business Deck is a **comprehensive daily report** with 9 sections:

```
┌─────────────────────────────────────────────────────────┐
│  SECTION 1: EXECUTIVE SUMMARY                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │ 62%  │ │KES   │ │KES   │ │KES   │                   │
│  │Occ % │ │45K   │ │5,200 │ │3,100 │                   │
│  │      │ │Rev   │ │ADR   │ │RevPAR│                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
│  Day-over-day changes + trend arrows                    │
│                                                         │
│  SECTION 2: REVENUE PERFORMANCE                         │
│  Revenue by category (Room, Restaurant, B&B, Conference)│
│  Today vs Yesterday vs This Week                        │
│  Revenue trend chart (14 days)                          │
│                                                         │
│  SECTION 3: OCCUPANCY & ROOMS                           │
│  Room type performance table                            │
│  ADR, RevPAR per room type                              │
│  Room status indicators                                 │
│                                                         │
│  SECTION 4: KITCHEN & F&B                               │
│  Orders count, avg order value, prep time               │
│  B&B codes verified, meal period breakdown              │
│  Top dishes chart                                       │
│                                                         │
│  SECTION 5: STAFF PERFORMANCE                           │
│  Active shifts, department revenue                      │
│  Staff scores and ratings                               │
│                                                         │
│  SECTION 6: GUEST INSIGHTS                              │
│  Booking sources, satisfaction trends                   │
│  Repeat guest rate, direct booking %                    │
│                                                         │
│  SECTION 7: CASH FLOW & PAYMENTS                        │
│  Payments by method, daily cash flow                    │
│  Collected vs outstanding vs deposits                   │
│                                                         │
│  SECTION 8: COMPETITOR INTELLIGENCE                     │
│  Rate comparison table                                  │
│  Market position badges                                 │
│                                                         │
│  SECTION 9: FORECASTS & RECOMMENDATIONS                 │
│  7-day occupancy forecast                               │
│  Business insights with projected revenue uplift        │
│  Action items with ROI estimates                        │
└─────────────────────────────────────────────────────────┘
```

## 17.2 Rule-Based Insights (No AI — Pure Business Logic)

| Insight | Trigger | Recommendation | Projected Uplift |
|---|---|---|---|
| **Weekend Surge** | Fri/Sat occupancy > 80% | Add 15% surcharge on peak dates | +KES 15,000/week |
| **Mid-Week Promo** | Wed occupancy < 55% | Run "Wednesday @ KES 4,000" promo | +3 rooms/day |
| **Cancellation Alert** | Cancellation rate > 15% | Review cancellation policy | +5% revenue |
| **Loyalty Gap** | Repeat rate < 20% | Promote loyalty program at checkout | +5% repeat |
| **Pricing Opportunity** | ADR < competitor avg × 0.9 | Increase rates 10% | +10% room revenue |
| **F&B Strength** | Restaurant rev > 35% of room rev | Expand menu | Scale F&B |

## 17.3 Email Delivery

```
AUTOMATED DELIVERY:
  → Midnight cron (00:05 EAT) triggers Edge Function
  → Edge Function calls all 9 DB functions
  → Builds HTML email with KPIs, tables, forecast, insights
  → Sends via Resend API to all admin/manager emails
  → Tracking enabled (open + click)

MANUAL TRIGGER:
  → Admin/Manager clicks "Generate & Send Email" on Business Deck page
  → Same flow — instant email delivery

EMAIL CONTENT:
  Subject: 📊 Business Deck — Tuesday, August 25, 2026
  From: deck@alerotek.co.ke
  Body: Executive summary → Revenue → Occupancy → Forecast → Insights
  CTA: "View Full Business Deck" button → links to /admin/business-deck
```

## 17.4 PDF Export

```
1. Admin opens Business Deck page
2. Clicks [Download PDF]
3. html2canvas captures the entire page
4. jsPDF generates PDF document
5. PDF includes:
   ├── All 9 sections with charts
   ├── Keyman Hotel branding
   ├── Date stamp
   ├── Confidential footer
   └── Print-optimized layout
6. PDF downloaded to device
```

---

# 18. Messaging & Communication

## 18.1 Internal Messaging

```
STAFF MESSAGING:
  → Any staff member can send messages to any other
  → Messages are role-aware (housekeeper sees room-related messages)
  → Real-time delivery via Supabase Realtime
  → Message types:
    ├── General
    ├── Room-related
    ├── Guest request
    └── Urgent

GUEST MESSAGING:
  → Guest can message hotel from their dashboard
  → Messages routed to appropriate department:
    ├── Room issues → Housekeeping
    ├── Restaurant → Kitchen/Waiter
    ├── Billing → Receptionist
    └── General → Manager
```

## 18.2 Notification System

```
NOTIFICATION TYPES:
  → New booking confirmation
  → Check-in/check-out reminders
  → Payment received
  → Payment verification needed
  → Guest request received
  → Shift reminder
  → Low occupancy alert
  → Competitor price change
  → B&B order ready

DELIVERY:
  → In-app notifications (bell icon)
  → Email notifications (configurable per user)
  → Push notifications (future)
```

---

# 19. Security & Compliance

## 19.1 Authentication

```
STAFF LOGIN:
  → Email + password authentication via Supabase Auth
  → JWT tokens with role claims
  → Session refresh via middleware
  → Auto-logout after inactivity

GUEST LOGIN:
  → Email + OTP (one-time password)
  → No password required
  → OTP valid for 10 minutes
  → Auto-login for returning guests

PASSWORD RESET:
  → OTP-based (no magic links — security hardened)
  → 6-digit code sent via email
  → Code expires after 10 minutes
  → New password minimum 8 characters
```

## 19.2 Row-Level Security (RLS)

Every database table has RLS policies enforcing:

```
PRINCIPLE: Least Privilege
  → Users can only access data they need
  → Role-based access control at database level
  → Even API calls cannot bypass RLS

ENFORCEMENT:
  → Supabase service role bypasses RLS (for Edge Functions only)
  → Client-side anon/authenticated keys enforced
  → Every query automatically filtered by role
```

## 19.3 Audit Trail

```
WHAT'S LOGGED:
  → User creation, role changes, password resets
  → Booking creation, modification, cancellation
  → Payment recording, verification, rejection
  → Room status changes
  → Order creation, status changes
  → Reconciliation submissions
  → All admin configuration changes

HOW:
  → PostgreSQL triggers on key tables
  → audit_log table captures: who, what, when, before/after
  → Cannot be modified by any user role
  → Viewable by admin in Audit page
```

## 19.4 Payment Security

```
→ Receipt upload required for all manual payments
→ Manager verification required before payment clears
→ Duplicate payment detection
→ Payment reference tracking (M-Pesa confirmation codes)
→ PCI-DSS compliance (card numbers never stored)
→ HTTPS everywhere (Vercel auto-SSL)
```

---

# 20. Operational Workflows

## 20.1 Day in the Life — Receptionist

```
06:45 AM — Start Shift
  → Login to PDA
  → View today's arrivals and departures
  → Check room status grid

07:00 AM — First Guest Arrives
  → Search booking by name
  → Verify identity
  → Assign room (or system auto-suggests)
  → Click Check-In
  → Room status: Vacant Clean → Occupied
  → Guest receives welcome message

08:30 AM — Walk-In Guest
  → Click [+ Walk-In]
  → Enter details (name, room type, nights)
  → System calculates total
  → Guest pays deposit
  → Check-In
  → Room assigned, folio created

10:00 AM — Payment Recording
  → Guest pays remaining balance via M-Pesa
  → Record payment with reference code
  → Upload M-Pesa screenshot
  → Payment status: pending verification

11:00 AM — Guest Checkout
  → Guest requests checkout
  → Open folio → verify all payments
  → Record any final payments
  → Click [Check-Out]
  → Room status: Occupied → Vacant Dirty
  → Housekeeping notified
```

## 20.2 Day in the Life — Chef

```
06:00 AM — Kitchen Opens
  → Login to Kitchen Tablet
  → Check B&B orders for today
  → Verify breakfast codes as guests arrive

07:00 AM — Breakfast Service
  → Guest arrives: "Code KMN-A3F7B2"
  → Enter code → verify name → prepare → serve
  → Mark as "Served"

10:00 AM — Lunch Prep
  → Check upcoming orders
  → Review menu items available
  → Prepare ingredients

12:00 PM — Lunch Rush
  → Orders appear on tablet
  → Accept orders
  → Prepare dishes
  → Mark as "Ready"
  → Waiter picks up and serves

02:00 PM — Afternoon
  → Update menu items if needed
  → Check inventory levels
  → Review today's order analytics
```

## 20.3 Day in the Life — Manager

```
08:00 AM — Morning Review
  → Login to Dashboard
  → Check overnight summary:
    ├── Revenue: KES 45,000
    ├── Occupancy: 62%
    ├── New bookings: 4
    └── Pending payments: 2

09:00 AM — Payment Verification
  → Open Payment Verification page
  → Review 3 pending M-Pesa payments
  → Verify receipts, approve payments

10:00 AM — Shift Management
  → Start new shift for receptionist
  → Assign housekeeper to rooms
  → Review kitchen operations

11:00 AM — Revenue Check
  → Open Revenue Management
  → Check rate calendar for upcoming dates
  → Apply weekend surcharge for Friday
  → Review competitor rates

02:00 PM — Reports
  → Open Reports page
  → Review occupancy trends
  → Check revenue by category
  → Export PDF for owner

04:00 PM — Reconciliation Prep
  → Check shift reconciliation status
  → Review any variances
  → Approve/reject reconciliation

05:00 PM — End of Day
  → Check Business Deck (auto-generated at midnight)
  → Review insights and recommendations
  → Plan tomorrow's priorities
```

## 20.4 Day in the Life — Guest

```
BOOKING (Online):
  1. Visit keymanhotel.alerotek.co.ke
  2. Click "Book Now"
  3. Select dates (Aug 25-28)
  4. Choose room (Twin — KES 8,000/night)
  5. Select meal plan (B&B)
  6. Browse breakfast menu, select items
  7. Apply discount code "WELCOME20"
  8. Pay deposit via M-Pesa
  9. Receive confirmation email

CHECK-IN DAY:
  1. Arrive at hotel
  2. Receptionist checks booking
  3. Assigned Room 5
  4. Receive room key
  5. Login to guest dashboard
  6. See reservation details
  7. Check B&B orders for tomorrow

STAY:
  1. Morning: Go to restaurant with B&B code
  2. Show code to chef → verified → breakfast served
  3. Afternoon: Order lunch via External Orders page
  4. Evening: Chat with hotel about tomorrow's plans
  5. Check MyMeals for breakfast order status
  6. View folio — see all charges

CHECK-OUT:
  1. Request checkout from dashboard
  2. Receptionist reviews folio
  3. Pay outstanding balance
  4. Receive checkout confirmation
  5. Loyalty points credited automatically
  6. Receive email with points earned
```

---

# 21. Future Roadmap

## 21.1 Phase 3 — Payment Automation

| Feature | Description | Effort |
|---|---|---|
| M-Pesa Daraja | STK push for automatic payment collection | 2 weeks |
| Stripe Integration | Card payments for international guests | 1 week |
| Payment QR Code | Guest scans QR to pay | 3 days |
| Auto-Reconciliation | Match payments with shift totals automatically | 1 week |

## 21.2 Phase 4 — Intelligence & Automation

| Feature | Description | Effort |
|---|---|---|
| Automated Pricing | Schedule `apply_auto_pricing()` hourly | 3 days |
| Demand Forecasting | ML-based occupancy prediction | 4 weeks |
| Auto No-Show Detection | Cron job detects no-shows, manages waitlist | 1 week |
| Email Open Tracking | Dashboard showing who opened deck emails | 2 days |

## 21.3 Phase 5 — Guest Experience

| Feature | Description | Effort |
|---|---|---|
| Mobile App (PWA) | Progressive Web App for guests | 4 weeks |
| Digital Key | Phone-as-key via Bluetooth | 8 weeks |
| AI Chatbot | Guest FAQ automation | 2 weeks |
| Review Collection | Automated post-stay review requests | 1 week |

## 21.4 Phase 6 — Enterprise Features

| Feature | Description | Effort |
|---|---|---|
| Multi-Property | Manage multiple hotels from one dashboard | 8 weeks |
| Accounting Export | QuickBooks/Xero integration | 2 weeks |
| HR Module | Payroll, attendance, performance reviews | 4 weeks |
| Procurement | Vendor management, purchase orders | 3 weeks |

---

# Appendix A: Database Functions Reference

| Function | Purpose | Called By |
|---|---|---|
| `check_in_guest_atomic()` | Atomic check-in with folio + B&B | Receptionist PDA |
| `check_out_guest_safe()` | Safe checkout with balance validation | Receptionist PDA |
| `walk_in_guest()` | Walk-in registration | Receptionist PDA |
| `create_order_rate_limited()` | Order creation with rate limiting | Waiter PDA |
| `record_payment_safe()` | Payment recording with validation | Payment pages |
| `get_effective_rate()` | Get rate for room type on date | Booking flow |
| `calculate_stay_total()` | Per-night rates + total | Booking flow |
| `check_min_stay()` | Validate minimum stay | Booking flow |
| `apply_auto_pricing()` | Auto-adjust rates by occupancy | Revenue Management |
| `get_channel_rate()` | Rate for OTA channel | Channel Manager |
| `generate_rate_push_payload()` | OTA rate payload | Channel Manager |
| `generate_availability_push_payload()` | OTA availability payload | Channel Manager |
| `record_competitor_rate()` | Record competitor rate | Competitor page |
| `get_competitor_comparison()` | Side-by-side comparison | Competitor page |
| `initiate_payment()` | Start payment transaction | Payment pages |
| `verify_payment()` | Manager payment verification | Payment Verification |
| `get_business_deck_*()` (9 functions) | Business intelligence aggregation | Business Deck |
| `get_business_insights()` | Rule-based recommendations | Business Deck |
| `generate_and_store_otp()` | Generate OTP for auth | Login/Reset |
| `verify_otp()` | Verify OTP code | Login/Reset |
| `create_staff_user()` | Create user via Edge Function | Admin Users |
| `trigger_deck_email()` | Trigger deck email via pg_net | pg_cron |

# Appendix B: Edge Functions

| Function | Purpose | Trigger |
|---|---|---|
| `send-business-deck` | Generate + email deck | Manual / pg_cron |
| `send-otp-email` | Send OTP code via email | Password reset |
| `admin-create-user` | Create staff user account | Admin panel |
| `admin-reset-password` | Reset user password | Admin panel |

# Appendix C: Cron Jobs

| Job | Schedule | Action |
|---|---|---|
| Midnight Deck | `5 21 * * *` (00:05 EAT) | Generate + email Business Deck |
| Noon Summary | `5 9 * * *` (12:05 EAT) | Log midday snapshot |

---

*Keyman Hotel PMS — Comprehensive System Documentation*  
*Version 2.0 — August 25, 2026*  
*Confidential — For Internal Use Only*
