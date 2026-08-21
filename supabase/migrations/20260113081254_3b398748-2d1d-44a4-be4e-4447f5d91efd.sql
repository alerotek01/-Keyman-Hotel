-- First, create helper functions for role checks
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role::text IN ('manager', 'admin')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role::text IN ('staff', 'manager', 'admin')
    )
$$;

-- Create guest_requests table for staff to manage
CREATE TABLE public.guest_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('housekeeping', 'maintenance', 'room_service', 'other')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create receipts table for booking payment receipts
CREATE TABLE public.receipts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    receipt_url TEXT NOT NULL,
    uploaded_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_requests (staff, manager, admin access)
CREATE POLICY "Staff can view all guest requests"
ON public.guest_requests FOR SELECT
USING (is_staff());

CREATE POLICY "Staff can create guest requests"
ON public.guest_requests FOR INSERT
WITH CHECK (is_staff());

CREATE POLICY "Staff can update guest requests"
ON public.guest_requests FOR UPDATE
USING (is_staff());

-- RLS policies for receipts (staff, manager, admin access)
CREATE POLICY "Staff can view receipts"
ON public.receipts FOR SELECT
USING (is_staff());

CREATE POLICY "Staff can upload receipts"
ON public.receipts FOR INSERT
WITH CHECK (is_staff());

-- Update bookings policies to allow staff to view and update
CREATE POLICY "Staff can view bookings"
ON public.bookings FOR SELECT
USING (is_staff());

CREATE POLICY "Staff can update booking status"
ON public.bookings FOR UPDATE
USING (is_staff());

-- Add receipts storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Staff can upload receipt files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND is_staff());

CREATE POLICY "Staff can view receipt files"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts' AND is_staff());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for updated_at on guest_requests
CREATE TRIGGER update_guest_requests_updated_at
BEFORE UPDATE ON public.guest_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();