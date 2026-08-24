# Staff-Guest Boundary & Duplicate Signup Prevention

**Date:** 2026-08-24  
**Status:** Pending Review  
**Scope:** Prevent staff from using guest features, prevent duplicate guest accounts

---

## Problem

1. **Staff can access guest features**: A housekeeper can navigate to `/guest`, create guest records, book rooms, order food — all under a false identity with no link to their staff account.

2. **No duplicate prevention**: The `guests` table has NO unique constraint on email or phone. Anyone can create unlimited fake guest records.

3. **No route guards**: Staff dashboards and guest dashboards share no boundary — any logged-in user can access any route.

---

## Design

### Part 1: Route Guards — Staff Cannot Access Guest Features

**Implementation**: Add role-based route guards in `ResponsiveLayout.tsx` and the guest layout.

| Route | Allowed Roles | Blocked Roles |
|---|---|---|
| `/guest/*` | guest, external_customer | staff, waiter, chef, housekeeper, receptionist, manager, admin |
| `/external/*` | external_customer, guest | staff roles |
| `/staff/*` | waiter, chef, housekeeper, receptionist | guest, external_customer |
| `/admin/*` | admin | all others |
| `/manager/*` | manager, admin | all others |

**Behavior when blocked:**
- Staff navigating to `/guest` → toast error "Staff accounts cannot access guest features" → redirect to `/staff`
- Guest navigating to `/staff` → redirect to `/guest`
- Any user navigating to unauthorized route → redirect to their role's dashboard

### Part 2: Guest Record Uniqueness

**Database changes:**
1. Add UNIQUE constraint on `guests.email`
2. Add UNIQUE constraint on `guests.phone`
3. Add CHECK constraint on `guests.email` (valid email format)
4. Add CHECK constraint on `guests.phone` (valid Kenyan format: +254XXXXXXXXX or 07XXXXXXXX)

**On duplicate attempt:**
- INSERT fails with unique constraint violation
- Frontend catches error → shows "An account with this email/phone already exists"
- Links to login page if they already have an account

### Part 3: Staff Guest Record Prevention

**RLS Policy Change:**
- `guests` INSERT: Currently "Anyone create" → Change to `NOT is_staff()`
- Staff should NOT be able to create guest records at all

**Exception:** Receptionist creates guest records for walk-in guests (this is their job). The policy becomes:
```sql
CREATE POLICY "Reception creates guests"
  ON guests FOR INSERT
  WITH CHECK (is_receptionist() OR is_admin());
```

### Part 4: Auth Signup Flow

**Current flow:**
1. Anyone signs up → gets `role = null` → redirected to guest dashboard

**New flow:**
1. Guest signup → creates auth user + guest record → role = 'guest' → guest dashboard
2. Staff signup → only possible via admin/manager creating user → assigned role → staff dashboard
3. If a staff email tries to sign up as guest → blocked at auth level (email already exists in users table)

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/ResponsiveLayout.tsx` | Add role-based route guards |
| `src/pages/guest/GuestLayout.tsx` | Add staff block check |
| `supabase/migrations/` | Add unique constraints on guests.email and guests.phone |
| `src/hooks/useAuth.ts` | Add `isStaff()` helper |
| `src/pages/Login.tsx` | Block staff from guest signup flow |

---

## Testing

1. E2E test: Staff navigates to `/guest` → redirected to `/staff`
2. E2E test: Guest navigates to `/staff` → redirected to `/guest`
3. E2E test: Create guest with duplicate email → error shown
4. E2E test: Create guest with duplicate phone → error shown
5. E2E test: Staff tries to create guest record via API → blocked by RLS
6. Existing E2E tests still pass (73/73)
