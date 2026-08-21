-- 1. Create enums (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN
    CREATE TYPE public.room_type AS ENUM ('SINGLE', 'STUDIO', 'TWIN', 'CONFERENCE', 'CAFETERIA');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE public.booking_status AS ENUM ('Pending', 'Confirmed', 'Cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'manager', 'public');
  END IF;
END $$;

-- 2. Create tables
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_number INTEGER NOT NULL UNIQUE,
    room_type room_type NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    breakfast_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_rooms INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests_count INTEGER NOT NULL DEFAULT 1,
    breakfast BOOLEAN NOT NULL DEFAULT false,
    vehicle BOOLEAN NOT NULL DEFAULT false,
    base_price NUMERIC(10, 2) NOT NULL,
    extras_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    status booking_status NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    actor UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Security functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'manager') OR public.is_admin() $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'staff') OR public.is_manager() $$;

-- 5. RLS Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.rooms;
  DROP POLICY IF EXISTS "Admins can view all rooms" ON public.rooms;
  DROP POLICY IF EXISTS "Admins can insert rooms" ON public.rooms;
  DROP POLICY IF EXISTS "Admins can update rooms" ON public.rooms;
  DROP POLICY IF EXISTS "Admins can delete rooms" ON public.rooms;
END $$;

CREATE POLICY "Anyone can view active rooms" ON public.rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all rooms" ON public.rooms FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update rooms" ON public.rooms FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete rooms" ON public.rooms FOR DELETE TO authenticated USING (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view room images" ON public.room_images;
  DROP POLICY IF EXISTS "Admins can insert room images" ON public.room_images;
  DROP POLICY IF EXISTS "Admins can delete room images" ON public.room_images;
END $$;

CREATE POLICY "Anyone can view room images" ON public.room_images FOR SELECT USING (true);
CREATE POLICY "Admins can insert room images" ON public.room_images FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete room images" ON public.room_images FOR DELETE TO authenticated USING (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
  DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
END $$;

CREATE POLICY "Anyone can create customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view customers" ON public.customers FOR SELECT TO authenticated USING (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
END $$;

CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
END $$;

CREATE POLICY "Admins can view user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
END $$;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
END $$;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 6. Auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('rooms', 'rooms', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view room images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload room images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete room images" ON storage.objects;
END $$;

CREATE POLICY "Anyone can view room images" ON storage.objects FOR SELECT USING (bucket_id = 'rooms');
CREATE POLICY "Authenticated users can upload room images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rooms');
CREATE POLICY "Authenticated users can delete room images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rooms');
