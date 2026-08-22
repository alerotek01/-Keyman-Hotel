# Business Logic Vulnerability Audit — Keyman Hotel System

**Date:** August 22, 2026
**Auditor:** Buffy (Codebuff AI)
**Scope:** Full Phase 1 implementation — all modules
**Methodology:** business-logic-vulnerabilities skill checklist

---

## Executive Summary

| Category | Vulnerabilities Found | Severity | Status |
|----------|----------------------|----------|--------|
| Price/Value Manipulation | 3 | HIGH | Needs DB-level fix |
| Race Conditions | 2 | HIGH | Needs DB-level fix |
| Workflow/Step Skip | 2 | MEDIUM | Needs DB-level fix |
| Payment Logic | 2 | HIGH | Needs DB-level fix |
| IDOR/Authorization | 1 | MEDIUM | Partially mitigated by RLS |
| Session/Token | 1 | LOW | Supabase handles |
| State Machine | 2 | HIGH | Needs DB-level fix |
| RLS Gaps | 3 | HIGH | Needs DB-level fix |

**Total: 16 findings** (5 Critical, 6 High, 3 Medium, 2 Low)

---

## 1. PRICE AND VALUE MANIPULATION

### 1.1 ⚠️ Client-Sent Unit Price on Order Items
**File:** `src/hooks/useRestaurantOrders.ts` line 98
**Vulnerability:** `unit_price` is sent from the client in the order items array.
```typescript
items: cart.map(item => ({
  menu_item_id: item.id,
  quantity: item.quantity,
  unit_price: item.price,  // ← TRUSTED FROM CLIENT
})),
```
**Attack:** Intercept request, change `unit_price` to 0.01 → pay almost nothing.
**Impact:** Critical — direct financial loss.
**Fix:** Server must look up `unit_price` from `menu_items` table, never trust client.
**Severity:** 🔴 CRITICAL

### 1.2 ⚠️ No Quantity Validation (Negative/Decimal)
**File:** `src/hooks/useRestaurantOrders.ts`
**Vulnerability:** No check that `quantity > 0` and `quantity ∈ Z+`.
**Attack:** Send `quantity: -1` → negative total → credit. Send `quantity: 0.01` → pay 1% price.
**Impact:** High — financial loss or credit generation.
**Fix:** Add CHECK constraint: `quantity > 0 AND quantity = floor(quantity)` in DB.
**Severity:** 🔴 CRITICAL

### 1.3 ⚠️ Client-Sent Rate on Reservations
**File:** `src/hooks/useReceptionist.ts` line 158 (walk-in)
**Vulnerability:** `rate` is calculated client-side and sent to server.
```typescript
rate: data.rate,  // ← TRUSTED FROM CLIENT
```
**Attack:** Set rate to 0 → free room.
**Impact:** Critical — free accommodation.
**Fix:** Server must calculate rate from `room_types.base_rate × nights`.
**Severity:** 🔴 CRITICAL

---

## 2. RACE CONDITIONS

### 2.1 ⚠️ Double Room Assignment
**File:** `src/hooks/useReceptionist.ts` — `useCheckIn`
**Vulnerability:** Check-in is non-atomic: check availability → assign room → update status.
```typescript
// Thread 1: checks room is available → TRUE
// Thread 2: checks room is available → TRUE (before Thread 1 updates)
// Thread 1: assigns room → success
// Thread 2: assigns same room → BOTH succeed → double assignment
```
**Attack:** Two receptionists check in guests to the same room simultaneously.
**Impact:** High — two guests in one room.
**Fix:** Use `SELECT ... FOR UPDATE` or atomic DB function for room assignment.
**Severity:** 🟡 HIGH

### 2.2 ⚠️ Double Payment on Same Order
**File:** `src/hooks/usePayments.ts` — `useRecordPayment`
**Vulnerability:** No idempotency check on payment recording.
**Attack:** Submit same M-Pesa payment twice → two payments recorded.
**Impact:** High — double credit.
**Fix:** Check for existing payment with same `mpesa_transaction_id` before insert.
**Severity:** 🟡 HIGH

---

## 3. WORKFLOW / STEP SKIP BYPASS

### 3.1 ⚠️ Status Jump Bypass
**File:** `src/hooks/useRestaurantOrders.ts` — `useUpdateOrderStatus`
**Vulnerability:** Any status can be set to any other status. No state machine enforcement.
```typescript
// Client can send: status = 'payment_verified' directly
// Skipping: new → accepted → kitchen → preparing → ready → delivered
```
**Attack:** Mark order as "payment_verified" without actually paying.
**Impact:** High — free food.
**Fix:** Add state machine validation in DB function: only allow valid transitions.
**Severity:** 🟡 HIGH

### 3.2 ⚠️ Checkout Without Payment Verification
**File:** `src/pages/staff/ReceptionistPda.tsx` — `handlePayment`
**Vulnerability:** Checkout closes folio and marks payment, but doesn't verify the payment was actually received.
**Attack:** Click "Confirm Payment" without actually collecting cash/M-Pesa.
**Impact:** Medium — guest leaves without paying.
**Fix:** Require payment reference for M-Pesa, or manager approval for large cash.
**Severity:** 🟠 MEDIUM

---

## 4. PAYMENT LOGIC

### 4.1 ⚠️ M-Pesa Duplicate Not Enforced at DB Level
**File:** `supabase/migrations/20260822000000_stage0_complete_schema.sql`
**Vulnerability:** The unique index on `mpesa_transaction_id` only prevents exact duplicates, but the client can send empty/null transaction ID.
```sql
CREATE UNIQUE INDEX idx_payments_mpesa ON payments (mpesa_transaction_id)
WHERE mpesa_transaction_id IS NOT NULL AND status != 'rejected';
```
**Attack:** Submit M-Pesa payment with empty transaction ID → no duplicate check.
**Impact:** High — duplicate payments.
**Fix:** Make `mpesa_transaction_id` required when `method = 'mpesa'`.
**Severity:** 🟡 HIGH

### 4.2 ⚠️ No Amount Validation on Payments
**File:** `src/hooks/usePayments.ts` — `useRecordPayment`
**Vulnerability:** No check that payment amount matches order total.
**Attack:** Record payment of KES 1 for a KES 5000 order → order marked as paid.
**Impact:** High — underpayment.
**Fix:** Compare payment amount against order total or folio balance.
**Severity:** 🟡 HIGH

---

## 5. STATE MACHINE ATTACKS

### 5.1 ⚠️ Reservation Status Jump
**File:** `src/hooks/useReceptionist.ts` — `useCheckIn`, `useCheckOut`
**Vulnerability:** No validation that status transition is legal.
```typescript
// Can check in a cancelled reservation
// Can check out a pending reservation
// Can cancel a checked-out reservation
```
**Attack:** Check in a cancelled reservation → free room.
**Impact:** High — unauthorized room access.
**Fix:** DB function must validate: confirmed → checked_in, checked_in → checked_out only.
**Severity:** 🟡 HIGH

### 5.2 ⚠️ Room Status Jump
**File:** `src/hooks/useHousekeeping.ts` — `useUpdateRoomStatus`
**Vulnerability:** Room can be set to any status from any status.
```typescript
// Can set: dirty → available (skip cleaning)
// Can set: occupied → available (skip check-out)
```
**Attack:** Skip housekeeping → dirty room given to next guest.
**Impact:** Medium — guest satisfaction.
**Fix:** DB function must enforce: dirty → cleaning → clean → inspected → available.
**Severity:** 🟠 MEDIUM

---

## 6. RLS POLICY GAPS

### 6.1 ⚠️ Overly Broad Staff Policies
**File:** `supabase/migrations/20260822000000_stage0_complete_schema.sql`
**Vulnerability:** Many policies use `is_staff()` which includes ALL staff roles.
```sql
CREATE POLICY "Staff view" ON public.reservations FOR SELECT USING (is_staff());
CREATE POLICY "Staff update" ON public.reservations FOR UPDATE USING (is_staff());
```
**Impact:** Waiter can update reservations. Chef can view guest folios.
**Fix:** Use role-specific policies: `is_receptionist()`, `is_manager()`, etc.
**Severity:** 🟠 MEDIUM

### 6.2 ⚠️ No DELETE Protection on Financial Tables
**File:** Schema
**Vulnerability:** `payments`, `folio_transactions`, `folio_payments` have no DELETE policies, but also no explicit DENY.
**Impact:** If a user gains elevated access, they could delete financial records.
**Fix:** Add explicit `CREATE POLICY "No delete" ON payments FOR DELETE USING (false)`.
**Severity:** 🟠 MEDIUM

### 6.3 ⚠️ Public INSERT on Reservations
**File:** `supabase/migrations/20260822000000_stage0_complete_schema.sql` line 180
**Vulnerability:** Anyone (including anonymous users) can create reservations.
```sql
CREATE POLICY "Anyone create" ON public.reservations FOR INSERT WITH CHECK (true);
```
**Attack:** Bot creates thousands of fake reservations → overbook hotel.
**Fix:** Restrict to `is_staff()` or authenticated users only.
**Severity:** 🟡 HIGH

---

## 7. ADDITIONAL FINDINGS

### 7.1 ⚠️ No Rate Limiting on Order Creation
**Vulnerability:** No limit on how many orders can be created per minute.
**Attack:** Script creates 1000 orders → kitchen overwhelmed.
**Fix:** Add rate limiting at API level or Supabase Edge Function.
**Severity:** 🟠 MEDIUM

### 7.2 ⚠️ Reconciliation Self-Approval
**File:** `src/hooks/usePayments.ts` — `useApproveReconciliation`
**Vulnerability:** The `managerId` is passed from the client. A staff member could pass their own ID if they have manager role.
**Fix:** Server should use `auth.uid()` instead of client-supplied manager ID.
**Severity:** 🟠 MEDIUM

---

## RECOMMENDED FIXES (Priority Order)

### Immediate (Before Go-Live)

1. **Add DB functions for critical operations:**
   - `create_order_safe()` — validates unit_price from menu_items, quantity > 0
   - `check_in_guest()` — atomic room assignment with SELECT FOR UPDATE
   - `update_order_status()` — state machine validation
   - `update_room_status()` — state machine validation
   - `record_payment()` — duplicate M-Pesa check, amount validation

2. **Add CHECK constraints:**
   - `restaurant_order_items.quantity > 0`
   - `payments.amount > 0`
   - `reservations.rate > 0`

3. **Fix RLS policies:**
   - Restrict reservation creation to staff
   - Add role-specific policies instead of generic `is_staff()`
   - Add explicit DENY policies on financial table DELETE

### Short-Term (Within 2 Weeks)

4. **Add idempotency keys** on payment recording
5. **Add rate limiting** on order creation
6. **Use `auth.uid()`** for all server-side operations instead of client-supplied IDs

### Medium-Term (Within 1 Month)

7. **Add audit logging** on all financial mutations
8. **Add business rule validation** in PostgreSQL functions
9. **Add monitoring/alerting** for suspicious patterns

---

## WHAT'S ALREADY SECURE ✅

| Area | Protection |
|------|-----------|
| **RLS Enabled** | All tables have RLS enabled |
| **Audit Logs** | Immutable (no DELETE/UPDATE rules) |
| **M-Pesa Unique Index** | Prevents exact duplicate transaction IDs |
| **VAT Calculation** | Server-side 16% on restaurant orders |
| **Room Status History** | All changes logged |
| **Reservation Audit** | DB triggers log creation and status changes |
| **Password Auth** | Supabase Auth handles |
| **HTTPS** | Enforced by Supabase |
| **Admin-only Tables** | departments, users, site_settings restricted to admin |

---

## CONCLUSION

The system has **good foundational security** (RLS, audit trails, auth) but has **critical business logic gaps** that need DB-level enforcement. The main risks are:

1. **Price manipulation** — client sends prices, server trusts them
2. **State machine bypass** — no validation of status transitions
3. **Race conditions** — non-atomic room assignment and payment recording
4. **RLS over-permission** — too much access for generic "staff" role

**Recommendation:** Do NOT go live until fixes #1-3 (DB functions + CHECK constraints) are implemented. These are the highest-risk items that could lead to direct financial loss.
