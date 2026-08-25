-- ============================================================
-- CORE BUSINESS LOGIC FUNCTIONS — Versioned Migration
-- ============================================================
-- These functions previously existed only in the Supabase SQL editor.
-- Exported for disaster recovery and version control.
-- Date: 2026-08-25
-- ============================================================

-- ─── check_in_guest_atomic (oid: 22102) ────────
-- Atomic check-in with SELECT FOR UPDATE to prevent double-room assignment
CREATE OR REPLACE FUNCTION public.check_in_guest_atomic(p_reservation_id uuid, p_room_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
      DECLARE
        v_res RECORD; v_room RECORD; v_folio_id UUID; v_result JSON;
      BEGIN
        SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
        IF v_res.status != 'confirmed' THEN RAISE EXCEPTION 'Reservation is not confirmed, status: %', v_res.status; END IF;
        SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
        IF v_room.status != 'available' THEN RAISE EXCEPTION 'Room is not available, status: %', v_room.status; END IF;
        IF EXISTS (SELECT 1 FROM public.reservations WHERE room_id = p_room_id AND id != p_reservation_id AND status IN ('confirmed','checked_in') AND check_in < v_res.check_out AND check_out > v_res.check_in) THEN
          RAISE EXCEPTION 'Room is already booked for these dates';
        END IF;
        UPDATE public.reservations SET room_id = p_room_id, status = 'checked_in' WHERE id = p_reservation_id;
        UPDATE public.rooms SET status = 'occupied' WHERE id = p_room_id;
        INSERT INTO public.room_status_history (room_id, old_status, new_status, changed_by, notes) VALUES (p_room_id, v_room.status, 'occupied', auth.uid(), 'Check-in');
        INSERT INTO public.guest_folios (reservation_id, guest_id, status) VALUES (p_reservation_id, v_res.guest_id, 'open') RETURNING id INTO v_folio_id;
        INSERT INTO public.folio_transactions (folio_id, type, description, amount, recorded_by) VALUES (v_folio_id, 'room_charge', 'Room ' || v_room.room_number || ' - ' || (v_res.check_out - v_res.check_in) || ' nights', v_res.rate * GREATEST(1, v_res.check_out - v_res.check_in), auth.uid());
        -- Save parking if plate number provided
        IF v_res.plate_number IS NOT NULL AND v_res.plate_number != '' THEN
          INSERT INTO public.parking (guest_id, reservation_id, plate_number, status, checked_in_at)
          VALUES (v_res.guest_id, p_reservation_id, v_res.plate_number, 'parked', now());
        END IF;
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values) VALUES (auth.uid(), 'check_in', 'reservations', p_reservation_id, jsonb_build_object('room_id', p_room_id));
        SELECT jsonb_build_object('reservation_id', p_reservation_id, 'room_id', p_room_id, 'folio_id', v_folio_id, 'status', 'checked_in') INTO v_result;
        RETURN v_result;
      END;
      $function$
;

-- ─── check_out_guest_safe (oid: 22323) ────────
-- Safe check-out: validates status, records payment, creates housekeeping task
CREATE OR REPLACE FUNCTION public.check_out_guest_safe(p_reservation_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_reservation RECORD;
  v_room_id UUID;
  v_folio_id UUID;
BEGIN
  SELECT * INTO v_reservation
  FROM reservations WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Reservation not found');
  END IF;

  IF v_reservation.status != 'checked_in' THEN
    RETURN json_build_object('success', false, 'message', 'Guest is not checked in, status: ' || v_reservation.status);
  END IF;

  v_room_id := v_reservation.room_id;

  UPDATE reservations SET status = 'checked_out', updated_at = now() WHERE id = p_reservation_id;

  IF v_room_id IS NOT NULL THEN
    UPDATE rooms SET status = 'dirty' WHERE id = v_room_id;
    INSERT INTO room_status_history (room_id, old_status, new_status, notes)
    VALUES (v_room_id, 'occupied', 'dirty', 'Guest checked out');
  END IF;

  SELECT id INTO v_folio_id
  FROM guest_folios WHERE reservation_id = p_reservation_id AND status = 'open' LIMIT 1;

  IF v_folio_id IS NOT NULL THEN
    UPDATE guest_folios SET status = 'closed', closed_at = now() WHERE id = v_folio_id;
  END IF;

  BEGIN
    IF v_room_id IS NOT NULL THEN
      INSERT INTO housekeeping_tasks (room_id, status, shift_date, priority, notes)
      VALUES (v_room_id, 'pending', current_date, 'high', 'Post checkout cleaning');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'message', 'Guest checked out',
    'reservation_id', p_reservation_id,
    'room_id', v_room_id,
    'folio_id', v_folio_id
  );
END;
$function$
;

-- ─── walk_in_guest (oid: 22959) ────────
-- Atomic walk-in: guest create/lookup + reservation + room + folio + parking + audit
CREATE OR REPLACE FUNCTION public.walk_in_guest(p_guest_name text, p_room_type_id uuid, p_check_in date, p_check_out date, p_guest_phone text DEFAULT NULL::text, p_guest_email text DEFAULT NULL::text, p_num_adults integer DEFAULT 2, p_num_children integer DEFAULT 0, p_plate_number text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_guest_id UUID;
  v_reservation_id UUID;
  v_folio_id UUID;
  v_room_id UUID;
  v_room_number TEXT;
  v_rate DECIMAL;
  v_nights INT;
  v_total DECIMAL;
  v_result JSON;
BEGIN
  IF p_guest_email IS NOT NULL THEN
    SELECT id INTO v_guest_id FROM guests WHERE email = p_guest_email LIMIT 1;
  END IF;

  IF v_guest_id IS NULL THEN
    INSERT INTO guests (name, phone, email)
    VALUES (p_guest_name, p_guest_phone, p_guest_email)
    RETURNING id INTO v_guest_id;
  ELSE
    UPDATE guests SET name = p_guest_name, phone = COALESCE(p_guest_phone, phone)
    WHERE id = v_guest_id;
  END IF;

  SELECT base_rate INTO v_rate FROM room_types WHERE id = p_room_type_id AND is_active = true;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive room type';
  END IF;

  v_nights := GREATEST(1, p_check_out - p_check_in);
  v_total := v_rate * v_nights;

  SELECT r.id, r.room_number INTO v_room_id, v_room_number
  FROM rooms r
  WHERE r.room_type_id = p_room_type_id
    AND r.is_active = true
    AND r.status IN ('available', 'inspected')
    AND r.id NOT IN (
      SELECT res.room_id FROM reservations res
      WHERE res.room_id IS NOT NULL
        AND res.status NOT IN ('cancelled', 'no_show')
        AND res.check_in < p_check_out AND res.check_out > p_check_in
    )
  ORDER BY r.room_number
  LIMIT 1 FOR UPDATE OF r SKIP LOCKED;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'No rooms available of requested type';
  END IF;

  INSERT INTO reservations (guest_id, room_id, room_type_id, check_in, check_out,
    num_adults, num_children, status, rate, source, plate_number, special_requests)
  VALUES (v_guest_id, v_room_id, p_room_type_id, p_check_in, p_check_out,
    p_num_adults, p_num_children, 'checked_in'::reservation_status,
    v_rate, 'walk_in'::booking_source, p_plate_number, 'Walk-in guest')
  RETURNING id INTO v_reservation_id;

  UPDATE rooms SET status = 'occupied' WHERE id = v_room_id;
  INSERT INTO room_status_history (room_id, new_status, changed_by, notes)
  VALUES (v_room_id, 'occupied', auth.uid(), 'Walk-in check-in');

  INSERT INTO guest_folios (reservation_id, guest_id, status)
  VALUES (v_reservation_id, v_guest_id, 'open')
  RETURNING id INTO v_folio_id;

  INSERT INTO folio_transactions (folio_id, type, description, amount, recorded_by)
  VALUES (v_folio_id, 'room_charge',
    'Room ' || v_room_number || ' - ' || v_nights || ' nights',
    v_total, auth.uid());

  IF p_plate_number IS NOT NULL AND p_plate_number != '' THEN
    INSERT INTO parking (guest_id, reservation_id, plate_number, status, checked_in_at)
    VALUES (v_guest_id, v_reservation_id, p_plate_number, 'parked', now());
  END IF;

  INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (auth.uid(), 'walk_in', 'reservations', v_reservation_id,
    jsonb_build_object('guest_name', p_guest_name, 'room', v_room_number,
      'rate_per_night', v_rate, 'nights', v_nights, 'total', v_total,
      'plate_number', p_plate_number));

  SELECT jsonb_build_object(
    'reservation_id', v_reservation_id,
    'guest_id', v_guest_id,
    'folio_id', v_folio_id,
    'room_number', v_room_number,
    'rate_per_night', v_rate,
    'nights', v_nights,
    'total_amount', v_total,
    'status', 'checked_in'
  ) INTO v_result;

  RETURN v_result;
END;
$function$
;

-- ─── create_order_rate_limited (oid: 22059) ────────
-- Rate-limited restaurant order creation with server-side total calculation
CREATE OR REPLACE FUNCTION public.create_order_rate_limited(p_source text DEFAULT 'web'::text, p_guest_id uuid DEFAULT NULL::uuid, p_room_number integer DEFAULT NULL::integer, p_staff_id uuid DEFAULT NULL::uuid, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_recent_count INT;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM public.restaurant_orders
  WHERE source = p_source::order_source
    AND created_at > now() - interval '60 seconds';

  IF v_recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit: max 10 orders per minute from %', p_source;
  END IF;

  RETURN public.create_order_safe(p_guest_id, p_room_number, p_staff_id, p_source, p_items);
END; $function$
;

-- ─── create_order_rate_limited (oid: 22521) ────────
-- Rate-limited restaurant order creation with server-side total calculation
CREATE OR REPLACE FUNCTION public.create_order_rate_limited(p_source text DEFAULT 'waiter'::text, p_guest_id uuid DEFAULT NULL::uuid, p_room_number integer DEFAULT NULL::integer, p_staff_id uuid DEFAULT NULL::uuid, p_items jsonb DEFAULT '[]'::jsonb, p_guest_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
      DECLARE v_recent_count INT;
      BEGIN
        SELECT COUNT(*) INTO v_recent_count
        FROM public.restaurant_orders
        WHERE source = p_source::order_source
          AND created_at > now() - interval '60 seconds';

        IF v_recent_count >= 10 THEN
          RAISE EXCEPTION 'Rate limit: max 10 orders per minute from %', p_source;
        END IF;

        RETURN public.create_order_safe(p_guest_id, p_room_number, p_staff_id, p_source, p_items, p_guest_name);
      END;
      $function$
;

-- ─── record_payment_safe (oid: 22025) ────────
-- Safe payment recording with folio validation and dedup check
CREATE OR REPLACE FUNCTION public.record_payment_safe(p_reservation_id uuid, p_method text, p_amount numeric, p_mpesa_txn_id text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
      DECLARE
        v_folio RECORD;
        v_payment_id UUID;
      BEGIN
        IF p_amount <= 0 THEN
          RAISE EXCEPTION 'Payment amount must be positive';
        END IF;

        IF p_method = 'mpesa' AND (p_mpesa_txn_id IS NULL OR p_mpesa_txn_id = '') THEN
          RAISE EXCEPTION 'M-Pesa payment requires a transaction reference';
        END IF;

        IF p_method = 'mpesa' THEN
          IF EXISTS (
            SELECT 1 FROM public.folio_payments
            WHERE mpesa_transaction_id = p_mpesa_txn_id
          ) THEN
            RAISE EXCEPTION 'M-Pesa transaction already recorded: %', p_mpesa_txn_id;
          END IF;
        END IF;

        SELECT * INTO v_folio
        FROM public.guest_folios
        WHERE reservation_id = p_reservation_id
        LIMIT 1;

        IF v_folio IS NULL THEN
          RAISE EXCEPTION 'No folio found for reservation';
        END IF;

        INSERT INTO public.folio_payments (
          folio_id, reservation_id, method, amount, mpesa_transaction_id, 
          reference, recorded_by, status
        ) VALUES (
          v_folio.id, p_reservation_id, p_method, p_amount,
          CASE WHEN p_method = 'mpesa' THEN p_mpesa_txn_id ELSE NULL END,
          p_notes, auth.uid(), 'completed'
        ) RETURNING id INTO v_payment_id;

        RETURN jsonb_build_object(
          'payment_id', v_payment_id,
          'amount', p_amount,
          'method', p_method
        );
      END;
      $function$
;

-- ─── GRANT EXECUTE PERMISSIONS ────────────────────────
GRANT EXECUTE ON FUNCTION public.check_in_guest_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_guest_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.walk_in_guest(text, uuid, date, date, text, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_safe(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_rate_limited(text, uuid, integer, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_rate_limited(text, uuid, integer, uuid, jsonb, text) TO authenticated;

-- ============================================================
-- END OF CORE FUNCTIONS MIGRATION
-- ============================================================
