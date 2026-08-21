# PRD - Keyman Hotel Management System (COMPLETE)

Version 2.0 | August 2026 | Keyman Hotel, Mwatate, Taita Taveta

---

# PHASE 1 SCOPE

| Module | Components |
|--------|------------|
| Rooms and Bookings | Room types, pricing, photos, website booking, walk-in, check-in/out, room status |
| CMS | Admin manages all website content |
| Housekeeping | Room status lifecycle, housekeeper PDA, inspection |
| Restaurant | Menu mgmt, web ordering, waiter PDA, kitchen tablet, order lifecycle |
| Payments | M-Pesa (manual+photo), cash, room charges, duplicate detection |
| VAT | 16% VAT on rooms and restaurant |
| Staff Shifts | Shift lifecycle, opening stock, reconciliation, manager approval |
| Folios | Room + restaurant charges + VAT, consolidated at checkout |
| Management | Dashboard, exceptions, night audit, daily reports |
| Policies | 24hr free cancellation, late=1 night, no-show=full stay |

---

# DECISIONS

| Decision | Choice |
|----------|--------|
| M-Pesa | Manual entry + photo evidence |
| Reconciliation | Staff then Manager then Done |
| Order Sources | Web + Waiter PDA only |
| Kitchen | Shared tablet view |
| Database | Single public schema + RLS |
| Real-time | Supabase Realtime |
| Night Audit | pg_cron at midnight |
| Staff PDA | Route group /staff/* |
| Amendments | Append-only with reason |
| Walk-ins | Create reservation + check in immediately |
| Cancellation | 24hr free, late=1 night, no-show=full |
| VAT | 16% on rooms and restaurant |
| CMS | Full admin control of website content |
| Housekeeping | Full lifecycle in Phase 1 |

---

# 1. DATABASE SCHEMA

## 1.1 Auth and Identity

CREATE TABLE users (id UUID PK refs auth.users, email TEXT UNIQUE, full_name TEXT, role TEXT CHECK (admin,manager,waiter,chef,housekeeper,storekeeper,receptionist,maintenance), department_id UUID refs departments, phone TEXT, is_active BOOLEAN DEFAULT true);

CREATE TABLE departments (id UUID PK, name TEXT UNIQUE, manager_id UUID refs users, is_active BOOLEAN);

## 1.2 Hotel

CREATE TABLE room_types (id UUID PK, name TEXT UNIQUE, description TEXT, base_rate NUMERIC(10,2), max_occupancy INT DEFAULT 2, is_active BOOLEAN);

CREATE TABLE rooms (id UUID PK, room_number INT UNIQUE, room_type_id UUID refs room_types, floor INT, status TEXT DEFAULT available CHECK (available,reserved,occupied,dirty,cleaning,inspected,out_of_order,maintenance), base_price NUMERIC(10,2), breakfast_price NUMERIC(10,2) DEFAULT 0, total_rooms INT DEFAULT 1, is_active BOOLEAN);

CREATE TABLE room_status_history (id UUID PK, room_id UUID refs rooms, status TEXT, changed_by UUID refs users, notes TEXT);

## 1.3 Guests and Reservations

CREATE TABLE guests (id UUID PK, name TEXT, email TEXT, phone TEXT, id_type TEXT, id_number TEXT, preferences JSONB);

CREATE TABLE reservations (id UUID PK, guest_id UUID refs guests, room_id UUID refs rooms, room_type_id UUID refs room_types, check_in DATE, check_out DATE, num_adults INT DEFAULT 1, num_children INT DEFAULT 0, rate NUMERIC(10,2), source TEXT DEFAULT direct CHECK (direct,website,phone,walk_in,ota), status TEXT DEFAULT pending CHECK (inquiry,pending,confirmed,checked_in,checked_out,cancelled,no_show), deposit_amount NUMERIC(10,2) DEFAULT 0, payment_status TEXT DEFAULT unpaid, special_requests TEXT, created_by UUID refs users);

CREATE TABLE booking_payments (id UUID PK, reservation_id UUID refs reservations, amount NUMERIC(10,2) CHECK (amount>0), method TEXT CHECK (cash,mpesa,card,other), reference TEXT, status TEXT DEFAULT pending);

## 1.4 Guest Folios

CREATE TABLE guest_folios (id UUID PK, reservation_id UUID refs reservations, guest_id UUID refs guests, status TEXT DEFAULT open CHECK (open,closed));

CREATE TABLE folio_transactions (id UUID PK, folio_id UUID refs guest_folios, type TEXT CHECK (room_charge,restaurant_charge,service_charge,adjustment,refund), description TEXT, amount NUMERIC(10,2), vat_amount NUMERIC(10,2) DEFAULT 0, reference TEXT, recorded_by UUID refs users);

CREATE TABLE folio_payments (id UUID PK, folio_id UUID refs guest_folios, amount NUMERIC(10,2) CHECK (amount>0), method TEXT, reference TEXT, recorded_by UUID refs users, verified BOOLEAN DEFAULT false);

## 1.5 Restaurant

CREATE TABLE menu_categories (id UUID PK, name TEXT, sort_order INT, is_active BOOLEAN);

CREATE TABLE menu_items (id UUID PK, category_id UUID refs menu_categories, name TEXT, description TEXT, price NUMERIC(10,2) CHECK (price>0), image_url TEXT, is_available BOOLEAN DEFAULT true);

CREATE TABLE restaurant_orders (id UUID PK, order_number SERIAL, source TEXT CHECK (web,waiter,walk_in), guest_name TEXT, room_number INT, guest_id UUID refs guests, status TEXT DEFAULT new CHECK (new,accepted,kitchen_accepted,preparing,ready,delivered,payment_submitted,payment_verified,reconciled,rejected,cancelled,payment_rejected,flagged), total NUMERIC(10,2) DEFAULT 0, vat_amount NUMERIC(10,2) DEFAULT 0, notes TEXT, waiter_id UUID refs users);

CREATE TABLE restaurant_order_items (id UUID PK, order_id UUID refs restaurant_orders ON DELETE CASCADE, menu_item_id UUID refs menu_items, quantity INT CHECK (quantity>0), unit_price NUMERIC(10,2) CHECK (unit_price>0), subtotal NUMERIC(10,2), notes TEXT);

CREATE TABLE order_events (id UUID PK, order_id UUID refs restaurant_orders, from_status TEXT, to_status TEXT, actor_id UUID refs users, notes TEXT);

## 1.6 Payments

CREATE TABLE payments (id UUID PK, order_id UUID refs restaurant_orders, folio_id UUID refs guest_folios, amount NUMERIC(10,2) CHECK (amount>0), method TEXT CHECK (cash,mpesa,card,room_charge,other), mpesa_transaction_id TEXT, receipt_image_url TEXT, status TEXT DEFAULT pending CHECK (pending,verified,rejected), recorded_by UUID refs users, verified_by UUID refs users);

CREATE UNIQUE INDEX idx_payments_mpesa ON payments (mpesa_transaction_id) WHERE mpesa_transaction_id IS NOT NULL AND status != rejected;

## 1.7 Staff Shifts

CREATE TABLE staff_shifts (id UUID PK, user_id UUID refs users, department_id UUID refs departments, shift_date DATE, shift_name TEXT CHECK (morning,afternoon,night), start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status TEXT DEFAULT not_started CHECK (not_started,active,ended,submitted,reconciled,closed));

CREATE TABLE shift_opening_records (id UUID PK, shift_id UUID refs staff_shifts, items JSONB, opening_float NUMERIC(10,2) DEFAULT 0, notes TEXT);

CREATE TABLE shift_transactions (id UUID PK, shift_id UUID refs staff_shifts, order_id UUID refs restaurant_orders, payment_id UUID refs payments, amount NUMERIC(10,2), type TEXT CHECK (sale,payment,adjustment));

CREATE TABLE shift_reconciliations (id UUID PK, shift_id UUID refs staff_shifts, submitted_by UUID refs users, sales_total NUMERIC(10,2), cash_total NUMERIC(10,2), mpesa_total NUMERIC(10,2), room_charges_total NUMERIC(10,2), expected_cash NUMERIC(10,2), actual_cash NUMERIC(10,2), variance NUMERIC(10,2), notes TEXT, status TEXT DEFAULT submitted CHECK (submitted,approved,flagged,explained,reconciled,closed), manager_id UUID refs users, reconciled_at TIMESTAMPTZ);

## 1.8 Housekeeping

CREATE TABLE housekeeping_tasks (id UUID PK, room_id UUID refs rooms, assigned_to UUID refs users, status TEXT DEFAULT pending CHECK (pending,in_progress,completed,inspected), shift_date DATE, notes TEXT, completed_at TIMESTAMPTZ, inspected_by UUID refs users, inspected_at TIMESTAMPTZ);

## 1.9 Exceptions and Audit

CREATE TABLE exceptions (id UUID PK, type TEXT, severity TEXT DEFAULT warning CHECK (info,warning,critical), description TEXT, related_id UUID, related_table TEXT, status TEXT DEFAULT open CHECK (open,acknowledged,resolved,dismissed), resolved_by UUID refs users, resolution_notes TEXT);

CREATE TABLE audit_logs (id UUID PK, user_id UUID refs users, action TEXT, table_name TEXT, record_id UUID, old_value JSONB, new_value JSONB, reason TEXT, department_id UUID refs departments);

CREATE RULE audit_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;

## 1.10 Night Audit

CREATE TABLE daily_reports (id UUID PK, report_date DATE UNIQUE, status TEXT DEFAULT generated, data JSONB, occupancy_pct NUMERIC, room_revenue NUMERIC, restaurant_revenue NUMERIC, total_revenue NUMERIC, orders_count INT, pending_payments INT, pending_shifts INT, open_exceptions INT, reviewed_by UUID refs users);

## 1.11 Notifications

CREATE TABLE notifications (id UUID PK, user_id UUID refs users, title TEXT, message TEXT, type TEXT, related_id UUID, read BOOLEAN DEFAULT false);

## 1.12 CMS

CREATE TABLE site_settings (id UUID PK, key TEXT UNIQUE, value TEXT, updated_by UUID refs users);

CREATE TABLE page_content (id UUID PK, page TEXT, section TEXT, heading TEXT, subheading TEXT, body TEXT, cta_text TEXT, cta_link TEXT, image_url TEXT, sort_order INT, is_active BOOLEAN);

CREATE TABLE hero_slides (id UUID PK, image_url TEXT, caption TEXT, alt_text TEXT, sort_order INT, is_active BOOLEAN);

CREATE TABLE media_library (id UUID PK, url TEXT, filename TEXT, alt_text TEXT, category TEXT, uploaded_by UUID refs users);

## 1.13 VAT

CREATE TABLE vat_config (id UUID PK, rate NUMERIC(5,2) DEFAULT 16.00, description TEXT, is_active BOOLEAN DEFAULT true);

INSERT INTO vat_config (rate, description) VALUES (16.00, Kenya VAT on rooms and restaurant);

---

# 2. KEY FLOWS

## 2.1 Booking Flow

Guest selects dates -> System shows available rooms with prices -> Guest selects room -> Enters name/email/phone -> Clicks Book Now -> Reservation created (status: confirmed) -> Confirmation shown -> Pay at hotel

## 2.2 Walk-in Flow

Receptionist creates reservation with today date -> Assigns room -> Checks in guest immediately -> Creates folio -> Guest gets room

## 2.3 Check-in Flow

Receptionist sees arrival -> Taps Check In -> Assigns specific room -> System: reservation=checked_in, room=occupied, creates folio -> Guest gets room key

## 2.4 Check-out Flow

Receptionist sees departure -> Taps Check Out -> System shows folio (room charges + restaurant + VAT) -> Guest pays -> System: reservation=checked_out, room=dirty, folio=closed

## 2.5 Restaurant Order Flow

Guest/waiter creates order -> Order status=new -> Waiter accepts -> Sent to kitchen -> Kitchen: accepted->preparing->ready -> Waiter delivers -> Collects payment (M-Pesa ID + photo or cash) -> Payment recorded -> Shift reconciliation -> Manager approves

## 2.6 Room Charge Flow

Checked-in guest orders food -> System verifies active reservation -> Posts charge to guest folio (with VAT) -> At checkout: folio shows all charges -> Guest pays total

## 2.7 Housekeeping Flow

Room checked out -> Status=dirty -> Housekeeping task created -> Housekeeper starts cleaning -> Status=cleaning -> Completes -> Status=clean -> Supervisor inspects -> Status=inspected -> Room available for check-in

## 2.8 Staff Shift Flow

Start shift -> Opening checklist -> Record stock/float -> Active: accept orders, record payments -> End shift: summary shown -> Submit -> Manager: approve or flag -> Reconciled

## 2.9 Night Audit Flow

pg_cron at 00:00 -> Gathers all data -> Generates daily_report -> Status: CLEAN or FLAGGED -> Notify manager

## 2.10 Cancellation Policy

24 hours before check-in: free cancellation
Less than 24 hours: 1 night charge
No-show: full stay charge

---


# 3. STAFF PDA PHILOSOPHY

Mobile-first. Large buttons. Minimal typing. One task per screen.
No admin dashboard look. Behaves like a modern digital PDA.

Main navigation: HOME | ORDERS | RECONCILE | RECORDS

Each role gets tailored screens:
- Waiter: My Orders, New Order, Payment, Reconcile
- Chef: Kitchen Queue, Preparing, Ready, Wastage
- Housekeeper: My Rooms, Start, Complete, Issues
- Storekeeper: Stock Count, Receive, Issue, Variance

# 4. KITCHEN ACCOUNTABILITY

Kitchen receives food component only.
Kitchen responsibility: Prepare and release the order.
Waiter responsibility: Accept, deliver, collect payment, reconcile.

Kitchen dashboard (tablet/large screen):
- NEW: orders waiting
- PREPARING: orders in progress
- READY: orders waiting for pickup

Kitchen records: orders received, completed, cancelled, delayed, wastage.

# 5. PAYMENT VERIFICATION

States: UNPAID -> PAYMENT_SUBMITTED -> PENDING_VERIFICATION -> VERIFIED
Rejected: PENDING -> REJECTED -> PAYMENT_REQUIRED

M-Pesa requires: Transaction ID + receipt photo
Duplicate M-Pesa ID blocked at database level (UNIQUE INDEX)
Same transaction ID cannot be used twice without manager override

# 6. CROSS-DEPARTMENT RECONCILIATION

After each department reconciles independently:
- Restaurant vs Kitchen: order count match
- Restaurant vs Payments: revenue vs payments
- Restaurant vs Inventory: expected vs actual consumption
- Front Office vs Restaurant: room charges match
- Front Office vs Payments: folio payments match

Variances generate exceptions. Manager investigates.

# 7. EXCEPTION CENTER

One central screen showing all unresolved issues:
- Cash shortage
- Missing M-Pesa receipt
- Duplicate M-Pesa transaction
- Unreconciled order
- Inventory variance
- Missing stock count
- Unclosed shift
- Room charge mismatch

Managers work from exceptions, not manual checking.

# 8. SECURITY AND PERMISSIONS

Role-based access control (RLS on every table):
- Waiter: own orders, own shift, own payments
- Chef: kitchen orders only
- Housekeeper: assigned rooms only
- Receptionist: rooms, reservations, folios
- Manager: department + reconciliation
- Admin: everything

Rules:
- Cannot delete reconciled financial records
- Cannot delete audit logs
- Cannot close shift with undisclosed cash
- Cannot post to nonexistent rooms
- Cannot change historical prices without amendment

# 9. AUDIT TRAIL

Every sensitive action generates an audit event:
- Order created/accepted/rejected/cancelled
- Price changed
- Payment added/changed/verified
- Cash adjusted
- Stock adjusted
- Shift closed
- Manager approved
- Record amended
- Report generated

Audit entry: User, Action, Record, Old, New, Reason, Time, Department, Approval

audit_logs table has NO DELETE and NO UPDATE rules enforced at database level.

# 10. CORE STATUS COLORS

Consistent across PDA, dashboards, and reports:
- GREEN: Complete, Reconciled
- BLUE: In Progress
- YELLOW: Waiting
- ORANGE: Warning
- RED: Exception, Action Required

# 11. IMPLEMENTATION STAGES

| Stage | Weeks | Scope |
|-------|-------|-------|
| 0. Rooms + Bookings + CMS | 1-3 | Room types, pricing, website booking, walk-in, check-in/out, CMS admin screens, dynamic website |
| 1. Housekeeping | 3-4 | Room status lifecycle, housekeeper PDA, supervisor inspection |
| 2. Foundation + VAT | 4-5 | Auth, roles, RLS, layouts, VAT calculation, audit trail |
| 3. Menu + Orders | 5-6 | Menu management, guest web ordering, waiter PDA, kitchen tablet |
| 4. Payments | 6-7 | M-Pesa (manual+photo), cash, room charges, folio integration, duplicate detection |
| 5. Staff Shifts | 7-8 | Shift lifecycle, opening stock, reconciliation, manager approval, PDF |
| 6. Dashboard + Reports | 8-9 | Manager dashboard, exceptions, night audit, daily reports |
| 7. Integration + Polish | 9-10 | Notifications, testing, cross-department reconciliation, hardening |

Total: 10 weeks for complete hotel operations system.

# 12. SUCCESS CRITERIA

Phase 1 is successful when:
1. Guest can book a room on the website and receive confirmation
2. Walk-in guest can be checked in within 2 minutes
3. Restaurant order flows from web/PDA -> kitchen -> delivery -> payment without paper
4. M-Pesa payment has photo evidence and unique ID
5. Staff shift reconciliation is complete before midnight
6. Manager sees all exceptions on one dashboard
7. Night audit generates clean or flagged report at midnight
8. Guest folio consolidates room + restaurant + VAT at checkout
9. No financial record can be silently deleted or overwritten
10. Every amendment has a reason and audit trail

# 13. TECHNICAL STACK

- Frontend: React + TypeScript + Tailwind
- Backend: Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
- Database: Single public schema with RLS
- Real-time: Supabase Realtime for kitchen/waiter
- Cron: pg_cron for night audit at 00:00
- Hosting: Vercel (frontend) + Supabase (backend)
- Payments: Manual M-Pesa entry (no API dependency)
- PDF: Client-side generation with jsPDF or similar

# 14. WHAT IS NOT IN PHASE 1

- Dynamic/seasonal pricing (manual pricing)
- Guest loyalty program
- WhatsApp integration
- Accounting integration
- Multi-property
- OTA channel manager
- Digital room keys
- Mobile check-in/out for guests
- Supplier management
- Procurement workflow
- Advanced forecasting

