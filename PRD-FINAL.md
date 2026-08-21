# PRD - Keyman Hotel Management & Operations System (FINAL)

**Version:** 2.0
**Date:** August 2026
**Property:** Keyman Hotel - Single Property, Mwatate, Taita Taveta

---

# DECISIONS MADE (Phase 1 Scope)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Phase 1 Priority | Restaurant + Payments | Daily revenue engine, most complexity |
| M-Pesa Integration | Manual entry + photo evidence | No API costs, works offline |
| Reconciliation Depth | Staff then Manager then Done | Simple two-step, cross-dept deferred |
| Order Sources | Web + Waiter PDA only | WhatsApp/phone deferred |
| Kitchen Interface | Shared tablet view | One tablet, no per-chef tracking |
| Shift Reports | In-app view only | PDF deferred to Phase 2 |
| Database | Single public schema + RLS | Simpler, works with Supabase client |
| Real-time | Supabase Realtime | Built-in, free tier |
| Night Audit | pg_cron at midnight | No external service |
| Staff PDA | Route group /staff/* | Same app, different UI |
| Amendments | Append-only with reason | Simple, no approval workflow |

---

# 1. SYSTEM ARCHITECTURE

## 1.1 Three-Layer Model

GUEST INTERFACE (Website) - Rooms, Booking, Menu, Online Ordering
OPERATIONS LAYER (Staff PDA) - Orders, Payments, Shifts, Reconciliation
CONTROL LAYER (Manager/Admin) - Dashboards, Exceptions, Night Audit

## 1.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Real-time | Supabase Realtime (Postgres changes) |
| Cron | pg_cron extension (night audit) |
| Hosting | Vercel (frontend) |
| Database | Supabase PostgreSQL |

---

# 2. PHASE 1 FLOW DESIGNS

## 2.1 Restaurant Order Flow

GUEST (website) -> WAITER (PDA) -> KITCHEN (tablet)
  Place order        Accept order     Start prep
                    Send to kitchen   Mark ready
                    Deliver           Notify waiter
                    Collect payment   Done
                    Record payment
                    End shift
                    Manager approve

## 2.2 Order Status State Machine

NEW -> ACCEPTED -> KITCHEN_ACCEPTED -> PREPARING -> READY
  -> DELIVERED -> PAYMENT_SUBMITTED -> PAYMENT_VERIFIED -> RECONCILED

Exception states: REJECTED, CANCELLED, PAYMENT_REJECTED, FLAGGED

Rules:
- Only NEW orders can be ACCEPTED or REJECTED
- Kitchen moves: KITCHEN_ACCEPTED -> PREPARING -> READY
- Waiter moves: READY -> DELIVERED -> PAYMENT_SUBMITTED
- PAYMENT_SUBMITTED -> PAYMENT_VERIFIED requires M-Pesa ID or cash
- No backward transitions (except via amendment)

## 2.3 M-Pesa Payment Flow

Waiter collects payment
  CASH: Record amount
  M-PESA: Enter transaction ID + take photo
    Duplicate check - BLOCK if duplicate
    Record payment - PENDING_VERIFICATION
    Manager verifies - APPROVE or REJECT

## 2.4 Staff Shift Flow

START SHIFT -> Opening checklist -> Record stock/float
ACTIVE SHIFT -> Accept orders -> Record payments
END SHIFT -> Summary -> Submit
WAITING MANAGER -> Approve/Flag -> RECONCILED

## 2.5 Night Audit (pg_cron at 00:00)

Gather data -> Generate report -> Status: CLEAN or FLAGGED
  Never fabricates clean status
  Notify manager

---

# 3. BUSINESS LOGIC SECURITY

## 3.1 Race Conditions

| Scenario | Defense |
|----------|---------|
| Double M-Pesa payment | Unique constraint on mpesa_transaction_id |
| Double order acceptance | SELECT FOR UPDATE on order status |
| Negative quantity | CHECK constraint: quantity > 0 |
| Decimal quantity fraud | CHECK constraint: quantity must be integer |
| Race on shift closure | SELECT FOR UPDATE on shift status |

## 3.2 Financial Integrity

- Payments: amount must be positive
- M-Pesa ID: unique per payment
- Cash variance: calculated server-side
- Room charges: only for checked-in guests
- No DELETE on financial tables
- UPDATE on reconciled records creates amendment

---

# 4. FINANCIAL MODEL

## 4.1 Revenue Recognition

RESTAURANT SALE: Debit Receivable, Credit Revenue
ROOM CHARGE: Debit Folio, Credit Revenue
PAYMENT: Debit Bank, Credit Receivable
SHIFT CLOSURE: Expected vs Actual cash = Variance = Exception

---

# 5. UI DESIGN

## 5.1 Staff PDA
- Large buttons (min 48px)
- One task per screen
- Minimal typing
- Status colors: green=done, blue=active, yellow=waiting, red=exception

## 5.2 Dashboard
- Answers ONE question per screen
- Real numbers only
- Exception list is primary view

---

# 6. IMPLEMENTATION STAGES

## Stage 1: Foundation (Week 1-2)
- Database schema with constraints + RLS
- Authentication and roles
- Core layouts (admin, staff PDA, kitchen)

## Stage 2: Menu & Orders (Week 2-3)
- Menu management (admin)
- Guest web ordering
- Waiter PDA ordering
- Kitchen tablet display

## Stage 3: Payments (Week 3-4)
- Cash and M-Pesa recording
- Duplicate M-Pesa detection
- Payment verification (manager)
- Order completion flow

## Stage 4: Staff Shifts (Week 4-5)
- Shift lifecycle (start, active, end)
- Opening stock checklists
- Shift reconciliation
- Manager approval

## Stage 5: Dashboard & Reports (Week 5-6)
- Manager dashboard with exceptions
- Night audit (pg_cron)
- Department reports

## Stage 6: Integration & Polish (Week 6-7)
- Guest folio integration
- In-app notifications
- Testing and hardening

---

# 7. DEFERRED TO PHASE 2

- WhatsApp/phone order sources
- Full inventory management
- Recipe tracking
- Housekeeping module
- Maintenance module
- Cross-department reconciliation
- PDF shift reports
- M-Pesa API integration
- Procurement and suppliers
- Multi-property support

---

# 8. SUCCESS CRITERIA

1. Guest can book a room and order food from website
2. Waiter can accept orders, record payment, reconcile shift
3. Kitchen staff can see and process orders on tablet
4. Manager can see exceptions and approve/reject shifts
5. M-Pesa payments tracked with transaction IDs and photos
6. Night audit runs automatically
7. No financial record silently overwritten
8. All actions logged in audit trail
