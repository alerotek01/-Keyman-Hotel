# Cafeteria Workflow — Deep Audit Report

**Date:** August 23, 2026  
**Scope:** Restaurant order lifecycle, waiter PDA, chef kitchen display, messaging, payments

---

## State Machine (DB Level)

The order state machine (`update_order_status_sm`) defines these valid transitions:

```
new → kitchen_accepted, cancelled
kitchen_accepted → preparing, cancelled
preparing → ready, cancelled
ready → delivered, cancelled
delivered → payment_submitted
payment_submitted → payment_verified, payment_rejected
payment_verified → (terminal)
payment_rejected → (terminal)
cancelled → (terminal)
```

**Verdict:** ✅ Well-designed. Enforces valid transitions at DB level.

---

## 🔴 CRITICAL ISSUES

### 1. No Folio Charge for Restaurant Orders
**Severity: CRITICAL** — Revenue is lost

When an order reaches `delivered` → `payment_submitted`, no `folio_transaction` is created. Restaurant revenue is invisible to the accounting system.

**Evidence:**
```
folio_transactions: 34 entries (ALL room_charge, restaurant_charge, service_charge from E2E test data)
restaurant payments via folio_payments: 0
```

**Fix:** Auto-post restaurant charges to guest folios when order status reaches `delivered`.

### 2. Order Events Not Logged
**Severity: HIGH** — No audit trail

The `order_events` table has 0 entries despite 1 existing order. The state machine function does `INSERT INTO order_events` but events aren't being recorded.

**Fix:** Verify RLS on `order_events` allows the function to insert.

### 3. No Payment Recording for Restaurant Orders
**Severity: HIGH** — Cash walks out untracked

The "Payment Received" button in the waiter PDA only changes status to `payment_submitted`. No actual payment record is created in `folio_payments`. A waiter can mark "Payment Received" and the money vanishes with no record.

**Fix:** When status changes to `payment_submitted`, auto-create a `folio_payments` entry.

### 4. Guest Name Not Required
**Severity: MODERATE** — Unknown orders

The existing order has `guest_name: null`. The `create_order_safe` function doesn't require a guest name, making orders untraceable.

**Fix:** Make `guest_name` required for waiter/walk_in sources.

---

## 🟡 MODERATE ISSUES

### 5. No Real-Time Kitchen Updates
**Severity: MODERATE** — Stale kitchen display

Kitchen orders use `refetchInterval: 5000` (5-second polling) instead of Supabase real-time subscriptions. The chef sees stale data for up to 5 seconds.

**Fix:** Add real-time subscription to kitchen orders.

### 6. No Kitchen Notification
**Severity: MODERATE** — Chef doesn't know about new orders

When a waiter creates an order, the chef doesn't get a notification. The chef has to manually refresh the kitchen display.

**Fix:** Send a notification to all chef-role users when a new order is created.

### 7. No Guest Notification
**Severity: MODERATE** — Guest doesn't know order is ready

When the chef marks an order as `ready`, the guest (if they have a reservation) doesn't get notified.

**Fix:** Send notification to guest's room when order is ready.

### 8. Chef Can't Mark "Delivered"
**Severity: MODERATE** — Workflow gap

The user wants the chef to confirm delivery when the order leaves the kitchen. Currently:
- Chef: new → kitchen_accepted → preparing → ready
- Waiter: ready → delivered

The chef marks "ready" (done cooking), the waiter marks "delivered" (taken to table). This is correct in standard hospitality, but the user wants the chef to also confirm "delivered" (order left kitchen).

**Fix:** Add a `left_kitchen` status between `ready` and `delivered`, or have the chef mark `ready` as "ready for pickup" and the waiter confirms pickup.

---

## 🟢 WORKING WELL

- ✅ State machine enforces valid transitions
- ✅ Rate limiting (10 orders/min per source)
- ✅ Menu item availability validation
- ✅ Price validation from DB (not frontend)
- ✅ Kitchen display with 3-column layout
- ✅ Kitchen channel exists with 5 members
- ✅ RLS: waiters create, chefs update, both view
- ✅ SECURITY DEFINER functions bypass RLS correctly

---

## Recommended Fix Priority

### Phase 1 — Revenue Integrity (Immediate)
1. Auto-post restaurant charges to folio on `delivered`
2. Auto-create payment record on `payment_submitted`
3. Make guest_name required for waiter orders

### Phase 2 — Notifications (This Week)
4. Notify chef on new order
5. Notify guest when order is ready
6. Add real-time kitchen updates

### Phase 3 — Enhanced Workflow (Next Sprint)
7. Add `left_kitchen` status or chef delivery confirmation
8. Add order ETA tracking
9. Add table management to waiter PDA
