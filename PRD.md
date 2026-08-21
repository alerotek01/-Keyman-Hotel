# PRD — Keyman Hotel Cafeteria System

## Overview
Online ordering system for the Keyman Hotel cafeteria. Guests order food through the website, specify room number (or takeaway), and the order is sent via WhatsApp to the cafeteria. Admin and staff receive in-app notifications.

## Current State (Frontend — Built)
- **Meal selection page** (`/cafeteria`) — clickable cards for Breakfast, Lunch, Dinner
- **Menu page** (`/cafeteria/:mealId`) — full menu with items, images, prices, quantities
- **Order flow** — name, room number (or takeaway toggle), cart total
- **WhatsApp integration** — clicking "Order via WhatsApp" opens WhatsApp with pre-filled order message

## What Needs Building (Backend)

### 1. Order Management

**Database Table: `cafeteria_orders`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| created_at | timestamptz | |
| guest_name | text | from form |
| room_number | text | nullable (null = takeaway/walk-in) |
| is_takeaway | boolean | default false |
| meal_type | text | 'breakfast', 'lunch', 'dinner' |
| items | jsonb | array of {menu_item_id, name, quantity, price} |
| total_amount | numeric | sum of items |
| status | text | 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled' |
| order_source | text | 'web', 'whatsapp', 'phone', 'walk-in' |
| staff_notified | boolean | default false |
| notes | text | nullable |

**RLS Policies:**
- Anyone can INSERT (guests place orders)
- Staff/Admin can SELECT all orders
- Staff can UPDATE status
- Admin can DELETE (void orders)

### 2. Menu Management

**Database Table: `cafeteria_menu_items`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| description | text | |
| price | numeric | KES |
| image_url | text | nullable, Supabase storage URL |
| category | text | 'breakfast', 'lunch', 'dinner' |
| available | boolean | default true |
| sort_order | integer | display order |
| created_at | timestamptz | |

**RLS Policies:**
- Public can SELECT (menu is public)
- Admin can INSERT/UPDATE/DELETE (manage menu from admin panel)

### 3. Real-time Notifications

**Supabase Realtime:** Subscribe to `cafeteria_orders` INSERT events.

**Notification Table: `cafeteria_notifications`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| order_id | uuid (FK → cafeteria_orders) | |
| recipient_role | text | 'staff', 'admin', 'manager' |
| message | text | |
| read | boolean | default false |
| created_at | timestamptz | |

**Flow:**
1. Guest places order → INSERT into `cafeteria_orders`
2. Trigger creates notification for staff + admin
3. Staff sees notification in-app (bell icon / notifications panel)
4. Staff updates order status → status change logged
5. When status = 'ready', guest gets WhatsApp notification (optional)

### 4. Admin Dashboard Additions

**New section in Admin Panel: `/admin/cafeteria`**
- Orders list (filterable by status, date, meal type)
- Order detail view (items, guest info, status timeline)
- Menu management (CRUD for menu items)
- Status update buttons (Confirm → Preparing → Ready → Delivered)

**New section in Staff Panel: `/staff/cafeteria`**
- Active orders queue (real-time)
- Quick status update (slide/tap to advance status)
- Today's orders summary

### 5. WhatsApp Integration

**Current:** Pre-filled message opens WhatsApp app.

**Future (Optional):**
- WhatsApp Business API integration for:
  - Automated order confirmation messages
  - Status update messages ("Your order is ready!")
  - Incoming order parsing (guest sends order via WhatsApp)

### 6. Revenue Tracking

**Daily summary in Admin Reports:**
- Total cafeteria revenue by meal type
- Average order value
- Most popular items
- Peak ordering times
- Room vs. takeaway vs. walk-in split

## API Endpoints (Future)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cafeteria/orders` | POST | Place order |
| `/api/cafeteria/orders` | GET | List orders (staff/admin) |
| `/api/cafeteria/orders/:id` | PATCH | Update order status |
| `/api/cafeteria/menu` | GET | Public menu |
| `/api/cafeteria/menu` | POST | Add menu item (admin) |
| `/api/cafeteria/menu/:id` | PATCH | Update menu item (admin) |
| `/api/cafeteria/menu/:id` | DELETE | Remove menu item (admin) |
| `/api/cafeteria/stats` | GET | Revenue/usage stats (admin) |

## Seed Data
Menu items are already seeded in `src/lib/cafeteria-menu.ts`:
- **Breakfast:** 6 items (KES 150–500)
- **Lunch:** 6 items (KES 350–650)
- **Dinner:** 6 items (KES 500–1,200)

When building the backend, migrate this data into the `cafeteria_menu_items` table.

## Success Metrics
- Orders placed per day
- Average order value
- Time from order to delivery
- Guest satisfaction (optional survey)
- Staff response time to notifications

## Dependencies
- Supabase Realtime (for live notifications)
- WhatsApp Business API (optional future enhancement)
- Push notifications (optional — for mobile)
