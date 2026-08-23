# Guest Experience Platform — Design Spec

**Date:** August 23, 2026  
**Status:** Draft — Awaiting Review  
**Scope:** Guest signup, dashboard, room billing, food ordering, chat, ETA tracking

---

## Overview

Build a guest-facing experience that connects guests to the hotel's operations:
- **Signup:** Email OTP (no password)
- **Dashboard:** View folio, order food, chat with staff
- **Room Billing:** "Add to my bill" for cafeteria and room service
- **Checkout:** Receptionist confirms all charges before checkout
- **Chat:** Three channels — reception, cafeteria, housekeeping
- **ETA Tracking:** Live order status with time estimates

---

## 1. Guest Signup (Email OTP)

### Flow
1. Guest enters email on booking confirmation page or app
2. Supabase Auth sends OTP code to email
3. Guest enters code → verified → session created
4. Guest profile auto-created from reservation data

### Database Changes
```sql
-- Add guest auth link to users table
ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN otp_verified_at TIMESTAMPTZ;

-- Link guests to user accounts
ALTER TABLE guests ADD COLUMN user_id UUID REFERENCES users(id);
```

### RLS Policies
- Guest can only view their own profile
- Guest can only view their own reservations
- Guest can only view their own folio
- Guest can only post to their room's chat channels

---

## 2. Guest Dashboard

### Pages
| Page | Description |
|---|---|
| `/guest` | Dashboard — folio summary, quick actions |
| `/guest/folio` | Full folio with line items |
| `/guest/order` | Menu browser + "Add to Room" |
| `/guest/orders` | Active orders with ETA tracking |
| `/guest/chat` | Chat with reception, cafeteria, housekeeping |
| `/guest/profile` | Guest profile + booking history |

### Dashboard Layout
```
┌─────────────────────────────────────────┐
│  Hi [Name] 👋                           │
│  Room [X] · [Check-in date] to [out]    │
├─────────────────────────────────────────┤
│  Folio Balance    Active Orders  Chat   │
│  KES [balance]    [count]        💬     │
├─────────────────────────────────────────┤
│  📋 Recent Charges                       │
│  [item] [amount] [status]               │
├─────────────────────────────────────────┤
│  🍽️ Quick Order                          │
│  [Menu] [My Orders] [Room Service]      │
└─────────────────────────────────────────┘
```

---

## 3. "Add to My Bill" Flow

### Scenario A: Guest Orders via App
1. Guest opens `/guest/order`
2. Browses menu, adds items to cart
3. Taps "Add to Room [X]" (auto-detected from reservation)
4. Order created: `source='guest_app'`, `room_number=X`
5. Charge appears on folio as `pending_approval`
6. Chef sees order on kitchen display
7. Receptionist confirms at checkout

### Scenario B: Guest Tells Waiter
1. Guest tells waiter "charge to my room"
2. Waiter opens order form → selects room from dropdown
3. Waiter confirms guest identity (name + room number)
4. Order created: `source='waiter'`, `room_number=X`
5. Same flow as above

### Scenario C: Room Service
1. Guest calls room service or chats in #cafeteria
2. Waiter takes order → "Add to Room [X]"
3. Chef receives order → prepares → marks ready
4. Waiter delivers → marks delivered
5. Charge appears on folio

### Database Changes
```sql
-- Add approval tracking to restaurant_orders
ALTER TABLE restaurant_orders ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE restaurant_orders ADD COLUMN approved_at TIMESTAMPTZ;

-- Add pending_approval to folio_transactions
ALTER TABLE folio_transactions ADD COLUMN requires_approval BOOLEAN DEFAULT false;
ALTER TABLE folio_transactions ADD COLUMN approved_by UUID REFERENCES users(id);
```

---

## 4. Receptionist Checkout Confirmation

### Flow
1. Receptionist opens checkout for Room [X]
2. System shows ALL charges: room, breakfast, restaurant, room service
3. Unapproved charges highlighted in yellow
4. Receptionist reviews each charge:
   - ✅ Approve → charge confirmed
   - ❌ Reject → charge removed (with reason)
5. Only approved charges go to final folio
6. Receptionist records payment → checkout complete

### Block Checkout Rule
```sql
-- Checkout blocked if unapproved charges exist
CREATE OR REPLACE FUNCTION public.check_out_guest_safe(p_reservation_id UUID)
RETURNS JSON AS $$
BEGIN
  -- Check for unapproved charges
  IF EXISTS (
    SELECT 1 FROM folio_transactions ft
    JOIN guest_folios gf ON ft.folio_id = gf.id
    WHERE gf.reservation_id = p_reservation_id
    AND ft.requires_approval = true
    AND ft.approved_by IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot checkout: unapproved charges exist. Please review folio.';
  END IF;
  -- ... rest of checkout logic
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Guest Chat (3 Channels)

### Channel Setup
| Channel | Members | Purpose |
|---|---|---|
| `#guest-room-{N}` | Guest + Receptionist + Manager | Room issues, check-in/out, billing |
| `#guest-cafeteria-{N}` | Guest + Waiter + Chef | Food orders, menu, dietary |
| `#guest-housekeeping-{N}` | Guest + Housekeeper + Manager | Towels, cleaning, maintenance |

### Auto-Create on Check-In
```sql
-- When guest checks in, create their personal channels
CREATE OR REPLACE FUNCTION public.create_guest_channels()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'checked_in' AND NEW.status = 'checked_in' THEN
    -- Create reception channel
    INSERT INTO message_channels (name, type, description)
    VALUES ('guest-room-' || NEW.room_number, 'direct', 'Room ' || NEW.room_number || ' guest chat')
    RETURNING id INTO v_channel_id;
    
    -- Add guest + receptionists
    INSERT INTO channel_members (channel_id, user_id, role) VALUES
      (v_channel_id, NEW.guest_user_id, 'member'),
      (v_channel_id, (SELECT id FROM users WHERE role = 'receptionist' LIMIT 1), 'admin');
    
    -- Similar for #cafeteria and #housekeeping
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Guest RLS
```sql
-- Guest can only see their own channels
CREATE POLICY "Guest sees own channels" ON message_channels
FOR SELECT USING (
  id IN (
    SELECT cm.channel_id FROM channel_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- Guest can only post to channels they're members of
CREATE POLICY "Guest posts to own channels" ON messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND channel_id IN (
    SELECT cm.channel_id FROM channel_members cm
    WHERE cm.user_id = auth.uid()
  )
);
```

---

## 6. Order ETA Tracking

### Status Flow with Time Estimates
```
new (0 min) → kitchen_accepted (2 min) → preparing (15 min) → ready (1 min) → delivered
```

### ETA Calculation
```sql
-- Add estimated_ready_at to restaurant_orders
ALTER TABLE restaurant_orders ADD COLUMN estimated_ready_at TIMESTAMPTZ;

-- When chef accepts, set ETA based on order size
CREATE OR REPLACE FUNCTION public.set_order_eta()
RETURNS TRIGGER AS $$
DECLARE
  v_item_count INT;
BEGIN
  IF NEW.status = 'kitchen_accepted' AND OLD.status = 'new' THEN
    SELECT count(*) INTO v_item_count
    FROM restaurant_order_items WHERE order_id = NEW.id;
    
    -- Base 10 min + 5 min per item
    NEW.estimated_ready_at := now() + ((10 + (v_item_count * 5)) || ' minutes')::interval;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Guest Order View
```
┌─────────────────────────────────────────┐
│  Order #101 — Room 101                  │
│  Status: 🔵 Preparing                   │
│  ETA: ~12 minutes                       │
│  ─────────────────────────────────────  │
│  1× Full English Breakfast    KES 550   │
│  1× Fresh Juice               KES 150   │
│  ─────────────────────────────────────  │
│  Total: KES 700                         │
│  Charged to: Room 101                   │
│  ─────────────────────────────────────  │
│  Timeline:                              │
│  ✅ 10:30 Order received                │
│  ✅ 10:32 Kitchen accepted              │
│  🔵 10:35 Preparing...                  │
│  ⏳ ~10:50 Ready (estimated)            │
└─────────────────────────────────────────┘
```

---

## 7. Reconciliation View (Updated)

```sql
CREATE OR REPLACE VIEW v_guest_folio_detail AS
SELECT
  gf.id as folio_id,
  r.room_number,
  g.name as guest_name,
  res.check_in,
  res.check_out,
  -- Room charges
  COALESCE(SUM(CASE WHEN ft.type = 'room_charge' THEN ft.amount END), 0) as room_charges,
  -- Breakfast charges
  COALESCE(SUM(CASE WHEN ft.type = 'restaurant_charge' AND ft.description LIKE '%B&B%' THEN ft.amount END), 0) as breakfast_charges,
  -- Restaurant charges
  COALESCE(SUM(CASE WHEN ft.type = 'restaurant_charge' AND ft.description NOT LIKE '%B&B%' THEN ft.amount END), 0) as restaurant_charges,
  -- Service charges
  COALESCE(SUM(CASE WHEN ft.type = 'service_charge' THEN ft.amount END), 0) as service_charges,
  -- Total charges
  COALESCE(SUM(CASE WHEN ft.type != 'refund' THEN ft.amount END), 0) as total_charges,
  -- Payments
  COALESCE((SELECT SUM(fp.amount) FROM folio_payments fp WHERE fp.folio_id = gf.id), 0) as total_payments,
  -- Balance
  COALESCE(SUM(CASE WHEN ft.type != 'refund' THEN ft.amount END), 0) 
    - COALESCE((SELECT SUM(fp.amount) FROM folio_payments fp WHERE fp.folio_id = gf.id), 0) as balance,
  -- Unapproved charges
  COALESCE(SUM(CASE WHEN ft.requires_approval = true AND ft.approved_by IS NULL THEN ft.amount END), 0) as pending_approval
FROM guest_folios gf
JOIN reservations res ON gf.reservation_id = res.id
JOIN guests g ON gf.guest_id = g.id
JOIN rooms r ON res.room_id = r.id
LEFT JOIN folio_transactions ft ON ft.folio_id = gf.id
GROUP BY gf.id, r.room_number, g.name, res.check_in, res.check_out;
```

---

## 8. Implementation Phases

### Phase 1 — Guest Signup + Dashboard (Week 1)
- [ ] Email OTP auth via Supabase
- [ ] Guest profile creation from reservation
- [ ] Guest dashboard page
- [ ] Folio view (read-only)

### Phase 2 — Room Billing (Week 2)
- [ ] "Add to My Bill" in guest app
- [ ] Waiter "charge to room" flow
- [ ] `requires_approval` flag on charges
- [ ] Receptionist checkout confirmation UI

### Phase 3 — Guest Chat (Week 3)
- [ ] Auto-create guest channels on check-in
- [ ] Guest chat UI (3 channels)
- [ ] Staff chat with guest
- [ ] Real-time messaging

### Phase 4 — ETA Tracking (Week 3)
- [ ] `estimated_ready_at` on orders
- [ ] Guest order status view
- [ ] Live timeline updates
- [ ] Push notification when ready

---

## 9. Security Summary

| Action | Guest | Waiter | Chef | Receptionist | Manager |
|---|---|---|---|---|---|
| View own folio | ✅ | — | — | ✅ | ✅ |
| Order food | ✅ | ✅ | — | — | — |
| Add to room bill | ✅ (own) | ✅ | — | — | — |
| Approve charges | — | — | — | ✅ | ✅ |
| Checkout | — | — | — | ✅ | ✅ |
| Chat: reception | ✅ (own) | — | — | ✅ | ✅ |
| Chat: cafeteria | ✅ (own) | ✅ | ✅ | — | — |
| Chat: housekeeping | ✅ (own) | — | — | — | ✅ |
| View order ETA | ✅ (own) | ✅ | ✅ | ✅ | ✅ |

---

*Spec written. Please review and let me know if you want any changes before we start implementation.*
