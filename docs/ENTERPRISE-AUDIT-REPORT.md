# Keyman Hotel PMS — Enterprise Audit Report

**Date:** August 23, 2026  
**Auditor:** Buffy (Codebuff AI)  
**Scope:** Full enterprise audit — schema, business logic, reconciliation, security, operations

---

## Executive Summary

| Category | Score | Status |
|----------|-------|--------|
| Database Schema | 7/10 | ⚠️ Duplicate table systems |
| Business Logic | 6/10 | ❌ Double-bookings possible |
| Financial Reconciliation | 5/10 | ❌ No audit trail for payments |
| Security (RLS) | 8/10 | ⚠️ 3 tables with overly permissive policies |
| Operations Flow | 7/10 | ⚠️ No daily reports, no parking data |
| Payment Integrity | 6/10 | ❌ All payments missing receipts |
| Room Management | 8/10 | ✅ Status tracking works |
| Staff & Messaging | 9/10 | ✅ Notifications, channels, real-time |

---

## 🔴 CRITICAL ISSUES (Must Fix)

### 1. Double-Booking Vulnerability
**Severity: CRITICAL** — 11 double-bookings found on Room 101

The `create_booking_safe` function checks for date overlap but only does a SELECT, not a FOR UPDATE lock. Two concurrent requests can both pass the check and book the same room.

**Evidence:**
```
Room 101: Test Guest E2E (2026-08-22 → 2026-08-24) — 11 overlapping reservations
Room 103: Test Guest E2E vs E2E Flow Test Guest — same dates
```

**Fix:** Add `FOR UPDATE` lock on rooms in `create_booking_safe`:
```sql
SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
```

### 2. No Audit Trail for Payments
**Severity: CRITICAL** — 33 payments, 0 audit entries

The `audit_folio_payment` trigger exists but the audit log only shows reservation events. Payments are completely unaudited.

**Evidence:**
```
Audit coverage:
  reservation_status_changed: 47 entries
  reservation_created: 39 entries
  INSERT on guests: 1 entry
  folio_payments: 0 entries ❌
  folio_transactions: 0 entries ❌
```

**Fix:** Verify the `audit_folio_payment()` trigger is firing. If not, recreate it.

### 3. All Payments Missing Receipts
**Severity: HIGH** — 33/33 payments have no receipt

Despite implementing mandatory receipt upload for cash payments, all existing test payments have no receipt. The frontend validation was added but existing data predates it.

**Evidence:**
```
[cash] KES 5,000 | ❌ no receipt
[mpesa] KES 8,000 | ❌ no receipt  
[card] KES 2,500 | ❌ no receipt
```

**Fix:** Data migration not needed (test data). Ensure production flow enforces receipt upload at the DB level via a CHECK constraint or trigger.

### 4. Room Status History Not Recording
**Severity: HIGH** — 0 entries in room_status_history

The `log_room_status_change()` trigger exists on the rooms table but no status changes are being logged.

**Evidence:**
```
Rooms table trigger: on_room_status_change → log_room_status_change()
room_status_history entries: 0
Room status breakdown: available=17, occupied=1, dirty=3
```

**Fix:** Verify trigger function body. It may reference wrong column names or have an exception being swallowed.

---

## 🟡 MODERATE ISSUES (Should Fix)

### 5. Duplicate Table Systems (4 pairs)
**Severity: MODERATE** — Wasted resources, confusion

| Old Table (Empty) | New Table (Active) | Used By |
|---|---|---|
| `orders` (0 rows) | `restaurant_orders` (0 rows) | Frontend uses `restaurant_orders` |
| `order_items` (0 rows) | `restaurant_order_items` (0 rows) | Frontend uses `restaurant_order_items` |
| `payments` (0 rows) | `folio_payments` (33 rows) | Frontend uses both! |
| `folios` (0 rows) | `guest_folios` (18 rows) | Frontend uses `guest_folios` |

**Problem:** `usePayments.ts` and `useReceipts.ts` still reference the `payments` table (empty), while `useFolios.ts` uses `folio_payments` (active). Restaurant payments may be going into the wrong table.

**Fix:** Either:
- Consolidate to single table system (recommended)
- OR update `usePayments.ts` to use `folio_payments`

### 6. Guest Folios Missing Balance Columns
**Severity: MODERATE** — Cannot reconcile

`guest_folios` table has NO `total_charges`, `total_payments`, or `balance` columns. It only has: `id, reservation_id, guest_id, status, created_at, closed_at`.

The frontend hooks (`useFolios.ts`) reference `total_charges` and `total_payments` which don't exist at the DB level. The computed values come from `folio_transactions` and `folio_payments` JOINs.

**Impact:** The folio detail view may show correct data (via hooks) but the reconciliation audit found 0 rows when querying guest_folios with those columns.

**Fix:** Add computed columns or a materialized view:
```sql
ALTER TABLE guest_folios ADD COLUMN total_charges DECIMAL DEFAULT 0;
ALTER TABLE guest_folios ADD COLUMN total_payments DECIMAL DEFAULT 0;
ALTER TABLE guest_folios ADD COLUMN balance DECIMAL GENERATED ALWAYS AS (total_charges - total_payments) STORED;
```

### 7. RLS Overly Permissive on 3 Tables
**Severity: MODERATE** — Security gap

| Table | Policy | Risk |
|---|---|---|
| `folios` | `ALL` (no condition) | Any authenticated user can read/write all folios |
| `order_items` | `ALL` (no condition) | Any authenticated user can modify order items |
| `orders` | `ALL` (no condition) | Any authenticated user can modify orders |

**Fix:** Replace with role-specific policies:
```sql
-- folios: only staff+ can access
CREATE POLICY "Staff access folios" ON folios FOR ALL 
  USING (is_staff() OR is_admin());
```

### 8. Overpayment/Refund Without Audit
**Severity: MODERATE** — Financial risk

3 cancelled reservations with payments still recorded:
```
Test Guest E2E: KES 15,500 — NEEDS REFUND
Test Guest E2E: KES 15,500 — NEEDS REFUND  
Folio Test Guest: KES 12,500 — NEEDS REFUND
```

No refund mechanism exists in the system. Cancellation does not automatically trigger refund processing.

**Fix:** Add refund workflow:
1. Cancelled reservation with payments → flag for review
2. Manager approves refund → create negative folio_transaction (type='refund')
3. Process refund → record in audit log

### 9. Daily Reports Not Generated
**Severity: MODERATE** — No management visibility

`daily_reports` table exists but has 0 rows. No automated report generation.

**Fix:** Create a scheduled function or trigger on reservation checkout that generates daily summaries.

### 10. No Parking Data
**Severity: LOW** — Feature unused

`parking` table exists with columns for plate_number, vehicle_type, vehicle_color, spot_number, etc. But 0 records. The receptionist PDA doesn't have a parking check-in flow.

**Fix:** Add parking check-in to receptionist walk-in flow.

---

## 🟢 WORKING WELL

### Room Management ✅
- 21 rooms across 3 types (Single: 17, Twin: 2, Studio: 2)
- Status tracking: available=17, occupied=1, dirty=3
- No ghost rooms (all occupied rooms have active reservations)
- Double-booking prevention exists (but needs FOR UPDATE lock)

### Staff & Messaging ✅
- 8 users with correct roles
- All non-admin users have staff records
- 5 message channels with 26 member assignments
- 50 notifications sent
- Real-time messaging working

### Folio System ✅
- 18 guest_folios created
- 34 folio_transactions (charges recorded)
- 33 folio_payments (payments recorded)
- Audit triggers exist on folio_payments and folio_transactions
- CHECK constraints enforce positive amounts

### RLS Coverage ✅
- 90+ policies across 43 tables
- Role-based access for admin, manager, receptionist, chef, waiter, housekeeper
- Notification preferences per-user
- Channel membership controls

### Database Functions ✅
- 33 functions available
- Key flows: create_booking_safe, check_in_guest_atomic, check_out_guest_safe, walk_in_guest, create_order_rate_limited
- Rate limiting on order creation
- Idempotency keys table exists

### CHECK Constraints ✅
- 19 CHECK constraints
- Role enum enforced: admin, manager, receptionist, waiter, chef, housekeeper, storekeeper, maintenance, accountant
- Positive amounts enforced on payments, charges, orders
- Reservation dates validated: check_out > check_in

---

## 📊 Data Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 8 | All roles represented |
| Staff | 8 | 1:1 with users |
| Room Types | 3 | Single (5K), Twin (8K), Studio (10K) |
| Rooms | 21 | 17 single, 2 twin, 2 studio |
| Guests | 24 | Created through bookings/walk-ins |
| Reservations | 38 | 1 confirmed, 1 checked-in, 11 checked-out, 25 cancelled |
| Guest Folios | 18 | All closed |
| Folio Transactions | 34 | Room + restaurant + service charges |
| Folio Payments | 33 | Cash + M-Pesa + card |
| Menu Items | 26 | 0 without images |
| Orders | 0 | No restaurant orders yet |
| Housekeeping Tasks | 7 | All pending |
| Notifications | 50 | Booking + system |
| Messages | 11 | Across 5 channels |
| Audit Logs | 87 | Reservations only (no payments) |
| Parking | 0 | Feature not used |
| Daily Reports | 0 | Not generated |
| Staff Shifts | 0 | Not used |

---

## 🏗️ Recommended Fix Priority

### Phase 1 — Data Integrity (Immediate)
1. ✅ Add `FOR UPDATE` lock to `create_booking_safe` to prevent double-bookings
2. ✅ Verify and fix `audit_folio_payment` trigger
3. ✅ Verify and fix `log_room_status_change` trigger
4. ✅ Add RLS policies for `folios`, `orders`, `order_items`

### Phase 2 — Financial Controls (This Week)
5. ✅ Add `total_charges`, `total_payments`, `balance` columns to `guest_folios`
6. ✅ Add refund workflow for cancelled reservations with payments
7. ✅ Add DB-level receipt requirement for cash payments
8. ✅ Consolidate `payments` vs `folio_payments` tables

### Phase 3 — Operations (Next Sprint)
9. ✅ Create daily report generation function
10. ✅ Add parking check-in to receptionist flow
11. ✅ Clean up duplicate empty tables
12. ✅ Add staff shift clock-in/out flow

---

*Report generated by automated enterprise audit. All findings verified against live database.*
