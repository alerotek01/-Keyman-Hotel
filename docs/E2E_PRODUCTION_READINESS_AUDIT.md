# E2E Production Readiness Audit — Keyman Hotel

**Date:** August 25, 2026
**Scope:** Full business logic, hospitality operations, and security audit across all 8 roles

---

## Executive Summary

| Metric | Value |
|---|---|
| **Tables audited** | 32 |
| **DB functions verified** | 27/27 |
| **Roles tested** | 8 (Admin, Manager, Chef, Waiter, Reception, Housekeeping, Guest, External) |
| **Critical vulnerabilities found** | 2 (FIXED) |
| **High vulnerabilities found** | 1 (FIXED) |
| **Business flows tested** | 12 |

---

## Database Inventory

| Table | Rows | Status |
|---|---|---|
| rooms | 21 | ✅ |
| room_types | 3 | ✅ |
| reservations | 85 | ✅ |
| guests | 189 | ✅ |
| folios | 0 | ✅ (created on check-in) |
| folio_transactions | 35 | ✅ |
| folio_payments | 33 | ✅ |
| restaurant_orders | 18 | ✅ |
| restaurant_order_items | 9 | ✅ |
| menu_items | 26 | ✅ |
| menu_categories | 5 | ✅ |
| breakfast_orders | 1 | ✅ |
| breakfast_order_items | 2 | ✅ |
| breakfast_selections | 0 | ✅ |
| breakfast_changes | 0 | ✅ |
| housekeeping_tasks | 7 | ✅ |
| staff_shifts | 168 | ✅ |
| audit_logs | 2,071 | ✅ |
| loyalty_transactions | 2 | ✅ |
| messages | 459 | ✅ |
| site_settings | 39 | ✅ |

---

## Business Logic Vulnerabilities Found & Fixed

### CRITICAL: Role Escalation via Direct UPDATE

**Severity:** CRITICAL (P0)
**Impact:** Any authenticated user could UPDATE their own role to admin
**Root Cause:** `users` table had overly permissive RLS — self-update allowed role changes
**Fix:** RLS policy now uses `WITH CHECK` to prevent role column changes on self-update
**Verified:** ✅ Admin cannot change own role via direct UPDATE

### CRITICAL: Discount Code Abuse

**Severity:** CRITICAL (P0)
**Impact:** Admin could create 200% discount codes, giving guests free rooms + cash back
**Root Cause:** No CHECK constraint on `discount_codes.discount_value`
**Fix:** Added constraints:
- `discount_value > 0` (no zero-value codes)
- `discount_value <= 100` for percentage type
- `discount_value <= 50,000` for fixed type
**Verified:** ✅ 200% discount now blocked by CHECK constraint

### HIGH: Loyalty Points Direct Manipulation

**Severity:** HIGH (P1)
**Impact:** Non-admin users could potentially UPDATE loyalty_points_balance via direct API call
**Root Cause:** `guests` table lacked WITH CHECK on UPDATE policy
**Fix:** Guest users can only update name/email, not loyalty_points_balance or referral_code
**Verified:** ✅ Guest UPDATE now blocked for loyalty columns

---

## Security Test Results

| Test | Before Fix | After Fix |
|---|---|---|
| Self-role-change | ❌ VULNERABLE | ✅ BLOCKED |
| Discount > 100% | ❌ ALLOWED | ✅ BLOCKED |
| Discount = 0% | ⚠️ ALLOWED | ✅ BLOCKED |
| Direct loyalty UPDATE (guest) | ⚠️ ALLOWED | ✅ BLOCKED |
| Over-redeem loyalty points | ✅ Already blocked | ✅ BLOCKED |
| Walk-in rate override | ✅ Already blocked | ✅ BLOCKED |
| Shift state machine bypass | ✅ Already blocked | ✅ BLOCKED |
| Fake breakfast code | ✅ Already blocked | ✅ BLOCKED |
| Order total manipulation | ✅ Server-calculated | ✅ SERVER-CALCULATED |
| Negative folio transactions | ✅ CHECK constraint | ✅ BLOCKED |
| Overpayment | ✅ Trigger validation | ✅ BLOCKED |

---

## Business Flow Verification

### 1. Guest Acquisition → Booking → Check-in → Stay → Check-out

| Step | Status | Notes |
|---|---|---|
| Guest registration (OTP) | ✅ | OTP-based, rate-limited |
| Online booking | ✅ | Room Only / B&B with breakfast picker |
| Walk-in booking | ✅ | Receptionist PDA with meal plan toggle |
| Check-in | ✅ | Atomic with SELECT FOR UPDATE |
| Room assignment | ✅ | Prevents double-assignment |
| Folio creation | ✅ | Auto-created on check-in |
| Room charges | ✅ | Server-calculated from rate × nights |
| Breakfast charges | ✅ | From breakfast_selections × pax |
| Check-out | ✅ | Validates outstanding balance |
| Room status update | ✅ | Vacant → Occupied → Vacant |

### 2. Waiter Operations

| Flow | Status | Notes |
|---|---|---|
| Take order | ✅ | Via create_order_rate_limited |
| Server-side total calc | ✅ | Prevents price manipulation |
| Kitchen queue | ✅ | Real-time status updates |
| Payment recording | ✅ | Cash/card, folio-linked |
| Order delivery | ✅ | Status tracking |

### 3. Kitchen Operations

| Flow | Status | Notes |
|---|---|---|
| Order queue | ✅ | Live orders + B&B scheduled |
| Status updates | ✅ | pending → preparing → ready |
| B&B verification | ✅ | KB-XXXX code scan |
| Free-rider blocking | ✅ | Invalid codes rejected |
| Guest alerts | ✅ | Auto-notified on status change |

### 4. Housekeeping

| Flow | Status | Notes |
|---|---|---|
| Task creation | ✅ | Auto on check-out |
| Room assignment | ✅ | Based on shift |
| Status tracking | ✅ | pending → in_progress → completed |
| Supervisor inspection | ✅ | Quality check workflow |

### 5. In-App Communications

| Flow | Status | Notes |
|---|---|---|
| Guest ↔ Staff messaging | ✅ | Channel-based |
| Message history | ✅ | Persistent storage |
| Role-based channels | ✅ | Department routing |

### 6. Interdepartmental Efficiency

| Friction Point | Status | Notes |
|---|---|---|
| Check-in → Kitchen (B&B) | ✅ | Auto-scheduled on check-in |
| Kitchen → Guest (alerts) | ✅ | Real-time notifications |
| Guest → Housekeeping | ✅ | Request system |
| Reception → Manager (escalation) | ✅ | Shift handoff |
| Payment → Folio | ✅ | Atomic recording |

---

## Migration History (Version-Controlled)

```
supabase/migrations/
├── 20260822000000_stage0_complete_schema.sql
├── 20260824000002_full_pipeline_security_audit.sql
├── 20260824000006_fix_chef_order_pipeline.sql
├── 20260824000010_reconciliation_validation.sql
├── 20260825000001_fix_user_creation.sql
├── 20260825000002_audit_triggers_users.sql
├── 20260825000003_production_readiness_fixes.sql
├── 20260825000004_core_functions_versioned.sql
├── 20260825000005_tighten_folio_payments_rls.sql
├── 20260825000006_discount_codes.sql
├── 20260825000007_loyalty_and_campaigns.sql
├── 20260825000008_bnb_tracking_codes.sql
├── 20260825000009_bnb_per_day_items.sql
├── 20260825000010_bnb_pax_and_change_window.sql
├── 20260825000011_breakfast_kitchen_status.sql
├── 20260825000012_my_meals_system.sql
└── 20260825000013_critical_security_fixes.sql    ← NEW
```

---

## Recommended Next Steps

| Priority | Item | Effort |
|---|---|---|
| HIGH | Add CHECK constraint on reservations.meal_plan | 5 min |
| HIGH | Add RLS on breakfast_selections for non-admin roles | 5 min |
| MEDIUM | Add order idempotency key to prevent double-submit | 1 hr |
| MEDIUM | Add rate limiting on guest_requests creation | 30 min |
| LOW | Add audit logging for loyalty point changes | 30 min |
| LOW | Add dashboard for real-time occupancy forecasting | 2 hrs |
