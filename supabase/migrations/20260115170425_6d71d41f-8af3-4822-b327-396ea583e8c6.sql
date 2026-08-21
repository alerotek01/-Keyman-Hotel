-- Fix 1: Add admin-only DELETE policy for bookings table
CREATE POLICY "Admins can delete bookings"
ON public.bookings FOR DELETE
TO authenticated
USING (public.is_admin());

-- Fix 2: Fix storage policies for 'rooms' bucket - restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can upload room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete room images" ON storage.objects;

CREATE POLICY "Admins can upload room images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rooms' AND public.is_admin());

CREATE POLICY "Admins can delete room images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rooms' AND public.is_admin());

-- Fix 3: Add server-side validation trigger for bookings
-- Validate booking data before insert
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate check_out is after check_in
    IF NEW.check_out <= NEW.check_in THEN
        RAISE EXCEPTION 'Check-out date must be after check-in date';
    END IF;
    
    -- Validate guests_count is between 1 and 10
    IF NEW.guests_count < 1 OR NEW.guests_count > 10 THEN
        RAISE EXCEPTION 'Guest count must be between 1 and 10';
    END IF;
    
    -- Validate booking is not too far in the future (max 1 year)
    IF NEW.check_in > CURRENT_DATE + INTERVAL '365 days' THEN
        RAISE EXCEPTION 'Bookings cannot be made more than 1 year in advance';
    END IF;
    
    -- Validate booking duration (max 30 days)
    IF NEW.check_out - NEW.check_in > 30 THEN
        RAISE EXCEPTION 'Booking duration cannot exceed 30 days';
    END IF;
    
    -- Validate total_amount is positive
    IF NEW.total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be positive';
    END IF;
    
    -- Recalculate and validate pricing from room data
    DECLARE
        room_record RECORD;
        expected_nights INTEGER;
        expected_base NUMERIC;
        expected_extras NUMERIC;
        expected_total NUMERIC;
    BEGIN
        SELECT base_price, breakfast_price INTO room_record
        FROM public.rooms WHERE id = NEW.room_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid room ID';
        END IF;
        
        expected_nights := NEW.check_out - NEW.check_in;
        expected_base := room_record.base_price * expected_nights;
        expected_extras := CASE WHEN NEW.breakfast THEN room_record.breakfast_price * NEW.guests_count * expected_nights ELSE 0 END;
        expected_total := expected_base + expected_extras;
        
        -- Override with server-calculated values to prevent price manipulation
        NEW.base_price := expected_base;
        NEW.extras_price := expected_extras;
        NEW.total_amount := expected_total;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for booking validation
DROP TRIGGER IF EXISTS validate_booking_trigger ON public.bookings;
CREATE TRIGGER validate_booking_trigger
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking();

-- Fix 4: Add validation trigger for customers
CREATE OR REPLACE FUNCTION public.validate_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate full_name length
    IF LENGTH(TRIM(NEW.full_name)) < 2 THEN
        RAISE EXCEPTION 'Full name must be at least 2 characters';
    END IF;
    
    IF LENGTH(NEW.full_name) > 100 THEN
        RAISE EXCEPTION 'Full name cannot exceed 100 characters';
    END IF;
    
    -- Validate email format (basic check)
    IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;
    
    IF LENGTH(NEW.email) > 255 THEN
        RAISE EXCEPTION 'Email cannot exceed 255 characters';
    END IF;
    
    -- Trim whitespace
    NEW.full_name := TRIM(NEW.full_name);
    NEW.email := LOWER(TRIM(NEW.email));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_customer_trigger ON public.customers;
CREATE TRIGGER validate_customer_trigger
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.validate_customer();