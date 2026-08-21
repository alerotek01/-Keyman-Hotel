-- ENUMS

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN CREATE TYPE public.room_status AS ENUM ('available','reserved','occupied','dirty','cleaning','inspected','out_of_order','maintenance'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN CREATE TYPE public.reservation_status AS ENUM ('inquiry','pending','confirmed','checked_in','checked_out','cancelled','no_show'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_source') THEN CREATE TYPE public.booking_source AS ENUM ('direct','website','phone','walk_in','ota'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN CREATE TYPE public.payment_method AS ENUM ('cash','mpesa','card','room_charge','other'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN CREATE TYPE public.payment_status AS ENUM ('pending','verified','rejected'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source') THEN CREATE TYPE public.order_source AS ENUM ('web','waiter','walk_in'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN CREATE TYPE public.order_status AS ENUM ('new','accepted','kitchen_accepted','preparing','ready','delivered','payment_submitted','payment_verified','reconciled','rejected','cancelled','payment_rejected','flagged'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_name') THEN CREATE TYPE public.shift_name AS ENUM ('morning','afternoon','night'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status') THEN CREATE TYPE public.shift_status AS ENUM ('not_started','active','ended','submitted','reconciled','closed'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'folio_status') THEN CREATE TYPE public.folio_status AS ENUM ('open','closed'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'housekeeping_status') THEN CREATE TYPE public.housekeeping_status AS ENUM ('pending','in_progress','completed','inspected'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exception_severity') THEN CREATE TYPE public.exception_severity AS ENUM ('info','warning','critical'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exception_status') THEN CREATE TYPE public.exception_status AS ENUM ('open','acknowledged','resolved','dismissed'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reconciliation_status') THEN CREATE TYPE public.reconciliation_status AS ENUM ('submitted','approved','flagged','explained','reconciled','closed'); END IF; END $$;



-- Drop rooms with old schema (will be recreated with new schema)
DROP TABLE IF EXISTS public.room_images CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- Drop old schema tables that conflict
DROP TABLE IF EXISTS public.guest_requests CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
-- Drop old triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_manager() CASCADE;
DROP FUNCTION IF EXISTS public.is_staff() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

-- CORE TABLES
CREATE TABLE IF NOT EXISTS public.departments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, description TEXT, manager_id UUID, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.users (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','manager','receptionist','waiter','chef','housekeeper','storekeeper','maintenance','accountant')), department_id UUID REFERENCES public.departments(id), phone TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE public.departments ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES public.users(id);
CREATE TABLE IF NOT EXISTS public.room_types (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, description TEXT, base_rate NUMERIC(10,2) NOT NULL DEFAULT 0, max_occupancy INT DEFAULT 2, breakfast_price NUMERIC(10,2) DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.rooms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_number INT UNIQUE NOT NULL, room_type_id UUID NOT NULL REFERENCES public.room_types(id), floor INT DEFAULT 1, status room_status DEFAULT 'available', base_price NUMERIC(10,2) NOT NULL DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.room_images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE, image_url TEXT NOT NULL, sort_order INT DEFAULT 0, alt_text TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.room_status_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES public.rooms(id), old_status room_status, new_status room_status NOT NULL, changed_by UUID REFERENCES public.users(id), notes TEXT, created_at TIMESTAMPTZ DEFAULT now());


CREATE TABLE IF NOT EXISTS public.guests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT, phone TEXT, id_type TEXT, id_number TEXT, nationality TEXT, preferences JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.reservations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), guest_id UUID NOT NULL REFERENCES public.guests(id), room_id UUID REFERENCES public.rooms(id), room_type_id UUID NOT NULL REFERENCES public.room_types(id), check_in DATE NOT NULL, check_out DATE NOT NULL, num_adults INT DEFAULT 1, num_children INT DEFAULT 0, rate NUMERIC(10,2) NOT NULL, source booking_source DEFAULT 'direct', status reservation_status DEFAULT 'pending', deposit_amount NUMERIC(10,2) DEFAULT 0, payment_status TEXT DEFAULT 'unpaid', special_requests TEXT, cancellation_reason TEXT, created_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), CONSTRAINT chk_dates CHECK (check_out > check_in));
CREATE TABLE IF NOT EXISTS public.booking_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE, amount NUMERIC(10,2) NOT NULL CHECK (amount > 0), method payment_method NOT NULL, reference TEXT, mpesa_transaction_id TEXT, receipt_image_url TEXT, status payment_status DEFAULT 'pending', recorded_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());


CREATE TABLE IF NOT EXISTS public.guest_folios (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id UUID NOT NULL REFERENCES public.reservations(id), guest_id UUID NOT NULL REFERENCES public.guests(id), status folio_status DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT now(), closed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS public.folio_transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), folio_id UUID NOT NULL REFERENCES public.guest_folios(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK (type IN ('room_charge','restaurant_charge','service_charge','adjustment','refund','vat')), description TEXT NOT NULL, amount NUMERIC(10,2) NOT NULL, vat_amount NUMERIC(10,2) DEFAULT 0, reference TEXT, recorded_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.folio_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), folio_id UUID NOT NULL REFERENCES public.guest_folios(id) ON DELETE CASCADE, amount NUMERIC(10,2) NOT NULL CHECK (amount > 0), method payment_method NOT NULL, reference TEXT, mpesa_transaction_id TEXT, receipt_image_url TEXT, recorded_by UUID REFERENCES public.users(id), verified BOOLEAN DEFAULT false, verified_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());


CREATE TABLE IF NOT EXISTS public.menu_categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, description TEXT, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.menu_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID NOT NULL REFERENCES public.menu_categories(id), name TEXT NOT NULL, description TEXT, price NUMERIC(10,2) NOT NULL CHECK (price > 0), image_url TEXT, is_available BOOLEAN DEFAULT true, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.restaurant_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number SERIAL, source order_source NOT NULL, guest_name TEXT, room_number INT, guest_id UUID REFERENCES public.guests(id), reservation_id UUID REFERENCES public.reservations(id), status order_status DEFAULT 'new', total NUMERIC(10,2) DEFAULT 0, vat_amount NUMERIC(10,2) DEFAULT 0, notes TEXT, waiter_id UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE, menu_item_id UUID NOT NULL REFERENCES public.menu_items(id), quantity INT NOT NULL CHECK (quantity > 0), unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0), subtotal NUMERIC(10,2) NOT NULL, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.order_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE, from_status order_status, to_status order_status NOT NULL, actor_id UUID REFERENCES public.users(id), notes TEXT, created_at TIMESTAMPTZ DEFAULT now());


CREATE TABLE IF NOT EXISTS public.payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES public.restaurant_orders(id), folio_id UUID REFERENCES public.guest_folios(id), amount NUMERIC(10,2) NOT NULL CHECK (amount > 0), method payment_method NOT NULL, mpesa_transaction_id TEXT, receipt_image_url TEXT, status payment_status DEFAULT 'pending', recorded_by UUID REFERENCES public.users(id), verified_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mpesa_unique ON public.payments (mpesa_transaction_id) WHERE mpesa_transaction_id IS NOT NULL AND status != 'rejected';


CREATE TABLE IF NOT EXISTS public.staff_shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES public.users(id), department_id UUID NOT NULL REFERENCES public.departments(id), shift_date DATE NOT NULL, shift_name shift_name NOT NULL, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status shift_status DEFAULT 'not_started', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shift_opening_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES public.staff_shifts(id) ON DELETE CASCADE, items JSONB DEFAULT '[]', opening_float NUMERIC(10,2) DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shift_transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES public.staff_shifts(id) ON DELETE CASCADE, order_id UUID REFERENCES public.restaurant_orders(id), payment_id UUID REFERENCES public.payments(id), amount NUMERIC(10,2), type TEXT CHECK (type IN ('sale','payment','adjustment')), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.shift_reconciliations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES public.staff_shifts(id), submitted_by UUID REFERENCES public.users(id), sales_total NUMERIC(10,2) DEFAULT 0, cash_total NUMERIC(10,2) DEFAULT 0, mpesa_total NUMERIC(10,2) DEFAULT 0, room_charges_total NUMERIC(10,2) DEFAULT 0, expected_cash NUMERIC(10,2) DEFAULT 0, actual_cash NUMERIC(10,2), variance NUMERIC(10,2) DEFAULT 0, notes TEXT, status reconciliation_status DEFAULT 'submitted', manager_id UUID REFERENCES public.users(id), manager_notes TEXT, reconciled_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());


CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES public.rooms(id), assigned_to UUID REFERENCES public.users(id), status housekeeping_status DEFAULT 'pending', shift_date DATE, priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')), notes TEXT, completed_at TIMESTAMPTZ, inspected_by UUID REFERENCES public.users(id), inspected_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.exceptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT NOT NULL, severity exception_severity DEFAULT 'warning', description TEXT NOT NULL, related_id UUID, related_table TEXT, status exception_status DEFAULT 'open', assigned_to UUID REFERENCES public.users(id), resolved_by UUID REFERENCES public.users(id), resolution_notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), resolved_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS public.audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES public.users(id), action TEXT NOT NULL, table_name TEXT NOT NULL, record_id UUID, old_value JSONB, new_value JSONB, reason TEXT, department_id UUID REFERENCES public.departments(id), ip_address TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE RULE audit_no_delete AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_no_update AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;


CREATE TABLE IF NOT EXISTS public.daily_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), report_date DATE UNIQUE NOT NULL, status TEXT DEFAULT 'generated' CHECK (status IN ('generated','reviewed','finalized')), data JSONB DEFAULT '{}', occupancy_pct NUMERIC(5,2), room_revenue NUMERIC(12,2) DEFAULT 0, restaurant_revenue NUMERIC(12,2) DEFAULT 0, total_revenue NUMERIC(12,2) DEFAULT 0, orders_count INT DEFAULT 0, pending_payments INT DEFAULT 0, pending_shifts INT DEFAULT 0, open_exceptions INT DEFAULT 0, reviewed_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES public.users(id), title TEXT NOT NULL, message TEXT, type TEXT, related_id UUID, related_table TEXT, read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.site_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT UNIQUE NOT NULL, value TEXT, updated_by UUID REFERENCES public.users(id), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.page_content (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), page TEXT NOT NULL, section TEXT NOT NULL, heading TEXT, subheading TEXT, body TEXT, cta_text TEXT, cta_link TEXT, image_url TEXT, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.hero_slides (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), image_url TEXT NOT NULL, caption TEXT, alt_text TEXT, link_url TEXT, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.media_library (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), url TEXT NOT NULL, filename TEXT, alt_text TEXT, category TEXT, file_size INT, mime_type TEXT, uploaded_by UUID REFERENCES public.users(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.vat_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rate NUMERIC(5,2) DEFAULT 16.00 NOT NULL, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());


CREATE INDEX IF NOT EXISTS idx_res_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_dates ON public.reservations(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_res_guest ON public.reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_folio_txn ON public.folio_transactions(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_pay ON public.folio_payments(folio_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.restaurant_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON public.restaurant_orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON public.staff_shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_exc_status ON public.exceptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);


ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folio_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_opening_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_config ENABLE ROW LEVEL SECURITY;


-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID) RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM public.users WHERE id = uid AND is_active = true; $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.get_user_role(auth.uid()) = 'admin'; $$;
CREATE OR REPLACE FUNCTION public.is_manager() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.get_user_role(auth.uid()) IN ('admin','manager'); $$;
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.get_user_role(auth.uid()) IS NOT NULL; $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_res_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.restaurant_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pagecontent_updated_at BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION public.log_room_status_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO public.room_status_history (room_id, old_status, new_status, changed_by) VALUES (NEW.id, OLD.status, NEW.status, auth.uid()); END IF; RETURN NEW; END; $$;
CREATE TRIGGER on_room_status_change AFTER UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.log_room_status_change();
CREATE OR REPLACE FUNCTION public.audit_reservations() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF TG_OP = 'INSERT' THEN INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value) VALUES (NEW.created_by, 'reservation_created', 'reservations', NEW.id, jsonb_build_object('guest_id', NEW.guest_id, 'room_type_id', NEW.room_type_id, 'check_in', NEW.check_in, 'check_out', NEW.check_out, 'rate', NEW.rate, 'source', NEW.source)); ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value, new_value) VALUES (auth.uid(), 'reservation_status_changed', 'reservations', NEW.id, jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status)); END IF; RETURN NEW; END; $$;
CREATE TRIGGER on_reservations_audit AFTER INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.audit_reservations();
CREATE OR REPLACE FUNCTION public.log_order_status_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO public.order_events (order_id, from_status, to_status, actor_id) VALUES (NEW.id, OLD.status, NEW.status, auth.uid()); END IF; RETURN NEW; END; $$;
CREATE TRIGGER on_orders_status_change AFTER UPDATE ON public.restaurant_orders FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- RLS POLICIES
CREATE POLICY "Staff can view" ON public.departments FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage" ON public.departments FOR ALL USING (is_admin());
CREATE POLICY "Staff can view" ON public.users FOR SELECT USING (id = auth.uid() OR is_manager());
CREATE POLICY "Admins can manage" ON public.users FOR ALL USING (is_admin());
CREATE POLICY "View active" ON public.room_types FOR SELECT USING (is_active = true OR is_staff());
CREATE POLICY "Admins manage" ON public.room_types FOR ALL USING (is_admin());
CREATE POLICY "Public view active" ON public.rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Staff view all" ON public.rooms FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admins insert" ON public.rooms FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update" ON public.rooms FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins delete" ON public.rooms FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Public view" ON public.room_images FOR SELECT USING (true);
CREATE POLICY "Admins manage" ON public.room_images FOR ALL USING (is_admin());
CREATE POLICY "Staff view" ON public.room_status_history FOR SELECT USING (is_staff());
CREATE POLICY "Anyone create" ON public.guests FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff view" ON public.guests FOR SELECT USING (is_staff());
CREATE POLICY "Anyone create" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff view" ON public.reservations FOR SELECT USING (is_staff());
CREATE POLICY "Staff update" ON public.reservations FOR UPDATE USING (is_staff());
CREATE POLICY "Staff view" ON public.booking_payments FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.booking_payments FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff view" ON public.guest_folios FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.guest_folios FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff update" ON public.guest_folios FOR UPDATE USING (is_staff());
CREATE POLICY "Staff view" ON public.folio_transactions FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.folio_transactions FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff view" ON public.folio_payments FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.folio_payments FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Managers verify" ON public.folio_payments FOR UPDATE USING (is_manager());
CREATE POLICY "View active" ON public.menu_categories FOR SELECT USING (is_active = true OR is_staff());
CREATE POLICY "Admins manage" ON public.menu_categories FOR ALL USING (is_admin());
CREATE POLICY "View available" ON public.menu_items FOR SELECT USING (is_available = true OR is_staff());
CREATE POLICY "Admins manage" ON public.menu_items FOR ALL USING (is_admin());
CREATE POLICY "Staff view" ON public.restaurant_orders FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.restaurant_orders FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff update" ON public.restaurant_orders FOR UPDATE USING (is_staff());
CREATE POLICY "Staff view" ON public.restaurant_order_items FOR SELECT USING (is_staff());
CREATE POLICY "Staff manage" ON public.restaurant_order_items FOR ALL USING (is_staff());
CREATE POLICY "Staff view" ON public.order_events FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.order_events FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff view" ON public.payments FOR SELECT USING (is_staff());
CREATE POLICY "Staff create" ON public.payments FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Managers verify" ON public.payments FOR UPDATE USING (is_manager());
CREATE POLICY "View own or manager" ON public.staff_shifts FOR SELECT USING (user_id = auth.uid() OR is_manager());
CREATE POLICY "Create own" ON public.staff_shifts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own or manager" ON public.staff_shifts FOR UPDATE USING (user_id = auth.uid() OR is_manager());
CREATE POLICY "View own" ON public.shift_opening_records FOR SELECT USING (shift_id IN (SELECT id FROM public.staff_shifts WHERE user_id = auth.uid()) OR is_manager());
CREATE POLICY "Staff create" ON public.shift_opening_records FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "View own" ON public.shift_transactions FOR SELECT USING (shift_id IN (SELECT id FROM public.staff_shifts WHERE user_id = auth.uid()) OR is_manager());
CREATE POLICY "Staff create" ON public.shift_transactions FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "View own" ON public.shift_reconciliations FOR SELECT USING (submitted_by = auth.uid() OR is_manager());
CREATE POLICY "Staff submit" ON public.shift_reconciliations FOR INSERT WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Managers update" ON public.shift_reconciliations FOR UPDATE USING (is_manager());
CREATE POLICY "View assigned" ON public.housekeeping_tasks FOR SELECT USING (assigned_to = auth.uid() OR is_manager());
CREATE POLICY "Staff create" ON public.housekeeping_tasks FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Update assigned" ON public.housekeeping_tasks FOR UPDATE USING (assigned_to = auth.uid() OR is_manager());
CREATE POLICY "Managers view" ON public.exceptions FOR SELECT USING (is_manager());
CREATE POLICY "Managers manage" ON public.exceptions FOR ALL USING (is_manager());
CREATE POLICY "System create" ON public.exceptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers view" ON public.audit_logs FOR SELECT USING (is_manager());
CREATE POLICY "System insert" ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers view" ON public.daily_reports FOR SELECT USING (is_manager());
CREATE POLICY "System create" ON public.daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers update" ON public.daily_reports FOR UPDATE USING (is_manager());
CREATE POLICY "Users view own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System create" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public view" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage" ON public.site_settings FOR ALL USING (is_admin());
CREATE POLICY "View active" ON public.page_content FOR SELECT USING (is_active = true OR is_staff());
CREATE POLICY "Admins manage" ON public.page_content FOR ALL USING (is_admin());
CREATE POLICY "View active" ON public.hero_slides FOR SELECT USING (is_active = true OR is_staff());
CREATE POLICY "Admins manage" ON public.hero_slides FOR ALL USING (is_admin());
CREATE POLICY "Public view" ON public.media_library FOR SELECT USING (true);
CREATE POLICY "Staff upload" ON public.media_library FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Admins manage" ON public.media_library FOR ALL USING (is_admin());
CREATE POLICY "Public view" ON public.vat_config FOR SELECT USING (true);
CREATE POLICY "Admins manage" ON public.vat_config FOR ALL USING (is_admin());

-- SEED DATA
INSERT INTO public.departments (name, description) VALUES ('Front Office','Reception and reservations'),('Restaurant','Food and beverage service'),('Kitchen','Food preparation'),('Housekeeping','Room cleaning'),('Stores','Inventory management'),('Maintenance','Building maintenance'),('Finance','Cash handling'),('Management','Hotel management') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.room_types (name, description, base_rate, max_occupancy, breakfast_price) VALUES ('Single','Comfortable single room. Clean linens, modern bathroom, Taita Hills view.',5000.00,1,500.00),('Twin','Twin room with two beds. Mountain views, lounge seating.',8000.00,2,500.00),('Studio','Premium studio suite. Full amenities, Taita Hills panorama.',10000.00,3,500.00) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.vat_config (rate, description) VALUES (16.00,'Kenya VAT on hotel rooms and restaurant') ON CONFLICT DO NOTHING;
INSERT INTO public.site_settings (key, value) VALUES ('hotel_name','Keyman Hotel'),('hotel_email','info@keymanhotel.co.ke'),('hotel_address','Mwatate, Taita Taveta'),('check_in_time','14:00'),('check_out_time','11:00'),('currency','KES'),('vat_rate','16') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO public.menu_categories (name, sort_order) VALUES ('Breakfast',1),('Lunch',2),('Dinner',3),('Drinks',4),('Snacks',5) ON CONFLICT (name) DO NOTHING;



-- KEYMAN HOTEL - COMPLETE DATABASE SCHEMA - Stage 0
-- All Phase 1 tables, RLS, functions, seed data


;