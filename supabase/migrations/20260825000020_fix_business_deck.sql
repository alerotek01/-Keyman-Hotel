-- ═══════════════════════════════════════════════════════════════
-- FIX BUSINESS DECK FUNCTIONS — Match actual schema
-- ═══════════════════════════════════════════════════════════════

-- Fix: get_business_deck_occupancy (GROUP BY issue)
CREATE OR REPLACE FUNCTION get_business_deck_occupancy(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_total_rooms INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_rooms FROM rooms WHERE is_active = true;

  SELECT jsonb_build_object(
    'total_rooms', v_total_rooms,
    'occupied', (SELECT COUNT(*) FROM reservations WHERE status IN ('confirmed','checked_in') AND check_in <= p_date AND check_out > p_date),
    'by_type', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', rt.name,
        'total', sub.total,
        'occupied', sub.occupied,
        'available', sub.total - sub.occupied,
        'occupancy_pct', CASE WHEN sub.total > 0 THEN ROUND(sub.occupied::NUMERIC / sub.total * 100, 1) ELSE 0 END,
        'adr', COALESCE(rt.base_rate, 0),
        'revpar', CASE WHEN sub.total > 0 THEN ROUND(COALESCE(rt.base_rate, 0) * sub.occupied::NUMERIC / sub.total, 0) ELSE 0 END
      ))
      FROM room_types rt
      JOIN LATERAL (
        SELECT
          (SELECT COUNT(*) FROM rooms WHERE room_type_id = rt.id AND is_active = true) as total,
          (SELECT COUNT(*) FROM reservations r WHERE r.room_type_id = rt.id AND r.status IN ('confirmed','checked_in') AND r.check_in <= p_date AND r.check_out > p_date) as occupied
      ) sub ON true
      WHERE rt.is_active = true
      ORDER BY rt.base_rate
    ),
    'room_status', (
      SELECT jsonb_build_object(
        'vacant_clean', (SELECT COUNT(*) FROM rooms WHERE status = 'available' AND is_active = true),
        'occupied_clean', (SELECT COUNT(*) FROM rooms WHERE status = 'occupied' AND is_active = true),
        'out_of_order', (SELECT COUNT(*) FROM rooms WHERE status = 'out_of_order')
      )
    ),
    'trend_14d', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', d,
        'occupied', (SELECT COUNT(*) FROM reservations WHERE status IN ('confirmed','checked_in') AND check_in <= d AND check_out > d)
      ))
      FROM generate_series(p_date - 13, p_date, '1 day') d
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_deck_revenue (enum 'internal' → use source column safely)
CREATE OR REPLACE FUNCTION get_business_deck_revenue(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'room_revenue', (SELECT COALESCE(SUM(ft.amount), 0) FROM folio_transactions ft JOIN folios f ON f.id = ft.folio_id WHERE ft.type = 'room_charge' AND ft.created_at::DATE = p_date),
      'restaurant_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE = p_date AND status NOT IN ('cancelled')),
      'total', (SELECT COALESCE(SUM(amount), 0) FROM folio_transactions WHERE created_at::DATE = p_date)
    ),
    'yesterday', jsonb_build_object(
      'room_revenue', (SELECT COALESCE(SUM(ft.amount), 0) FROM folio_transactions ft JOIN folios f ON f.id = ft.folio_id WHERE ft.type = 'room_charge' AND ft.created_at::DATE = p_date - 1),
      'restaurant_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE = p_date - 1 AND status NOT IN ('cancelled')),
      'total', (SELECT COALESCE(SUM(amount), 0) FROM folio_transactions WHERE created_at::DATE = p_date - 1)
    ),
    'week', jsonb_build_object(
      'room_revenue', (SELECT COALESCE(SUM(ft.amount), 0) FROM folio_transactions ft JOIN folios f ON f.id = ft.folio_id WHERE ft.type = 'room_charge' AND ft.created_at::DATE >= p_date - 6),
      'restaurant_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE >= p_date - 6 AND status NOT IN ('cancelled')),
      'total', (SELECT COALESCE(SUM(amount), 0) FROM folio_transactions WHERE created_at::DATE >= p_date - 6)
    ),
    'month', jsonb_build_object(
      'room_revenue', (SELECT COALESCE(SUM(ft.amount), 0) FROM folio_transactions ft JOIN folios f ON f.id = ft.folio_id WHERE ft.type = 'room_charge' AND ft.created_at::DATE >= date_trunc('month', p_date)::DATE),
      'restaurant_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE >= date_trunc('month', p_date)::DATE AND status NOT IN ('cancelled')),
      'total', (SELECT COALESCE(SUM(amount), 0) FROM folio_transactions WHERE created_at::DATE >= date_trunc('month', p_date)::DATE)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_deck_kitchen (enum values: 'web','waiter','walk_in')
CREATE OR REPLACE FUNCTION get_business_deck_kitchen(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'total_orders', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date),
      'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE = p_date AND status NOT IN ('cancelled')),
      'avg_order_value', (SELECT COALESCE(ROUND(AVG(total), 0), 0) FROM restaurant_orders WHERE created_at::DATE = p_date AND status NOT IN ('cancelled')),
      'dine_in', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date AND source = 'waiter'),
      'web_orders', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date AND source = 'web'),
      'walk_in', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date AND source = 'walk_in'),
      'rejected', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date AND status IN ('cancelled', 'rejected'))
    ),
    'yesterday', jsonb_build_object(
      'total_orders', (SELECT COUNT(*) FROM restaurant_orders WHERE created_at::DATE = p_date - 1),
      'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE = p_date - 1 AND status NOT IN ('cancelled'))
    ),
    'top_dishes', (
      SELECT jsonb_agg(jsonb_build_object('name', mi.name, 'orders', oi.cnt, 'revenue', oi.rev))
      FROM (
        SELECT roi.menu_item_id, COUNT(*) as cnt, SUM(roi.subtotal) as rev
        FROM restaurant_order_items roi
        JOIN restaurant_orders ro ON ro.id = roi.order_id
        WHERE ro.created_at::DATE >= p_date - 6 AND ro.status NOT IN ('cancelled')
        GROUP BY roi.menu_item_id ORDER BY cnt DESC LIMIT 5
      ) oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
    ),
    'orders_by_source', (
      SELECT jsonb_agg(jsonb_build_object('source', source, 'count', cnt))
      FROM (
        SELECT source, COUNT(*) as cnt FROM restaurant_orders
        WHERE created_at::DATE = p_date AND status NOT IN ('cancelled')
        GROUP BY source
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_deck_staff (start_time/end_time, not clock_in/clock_out)
CREATE OR REPLACE FUNCTION get_business_deck_staff(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'active_shifts', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', u.full_name,
        'role', u.role,
        'shift_start', ss.start_time,
        'shift_end', ss.end_time,
        'status', ss.status
      ))
      FROM staff_shifts ss
      JOIN users u ON u.id = ss.user_id
      WHERE ss.shift_date = p_date AND ss.status IN ('active', 'completed')
    ),
    'shift_summary', jsonb_build_object(
      'total_shifts', (SELECT COUNT(*) FROM staff_shifts WHERE shift_date = p_date),
      'completed', (SELECT COUNT(*) FROM staff_shifts WHERE shift_date = p_date AND status = 'completed'),
      'active', (SELECT COUNT(*) FROM staff_shifts WHERE shift_date = p_date AND status = 'active'),
      'variance', (SELECT COALESCE(SUM(ABS(variance)), 0) FROM shift_reconciliations WHERE created_at::DATE = p_date)
    ),
    'revenue_by_department', (
      SELECT jsonb_agg(jsonb_build_object('department', dept, 'revenue', rev))
      FROM (
        SELECT 'Rooms' as dept, COALESCE(SUM(ft.amount), 0) as rev FROM folio_transactions ft WHERE ft.created_at::DATE = p_date AND ft.type = 'room_charge'
        UNION ALL
        SELECT 'Restaurant', COALESCE(SUM(total), 0) FROM restaurant_orders WHERE created_at::DATE = p_date AND status NOT IN ('cancelled')
        UNION ALL
        SELECT 'Services', COALESCE(SUM(amount), 0) FROM folio_transactions WHERE created_at::DATE = p_date AND type = 'service_charge'
      ) d
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_deck_guests (loyalty_transactions.points not points_earned)
CREATE OR REPLACE FUNCTION get_business_deck_guests(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'guests_tonight', (SELECT COUNT(DISTINCT g.id) FROM guests g JOIN reservations r ON r.guest_id = g.id WHERE r.status IN ('checked_in') AND r.check_in <= p_date AND r.check_out > p_date),
    'avg_length_of_stay', (SELECT COALESCE(ROUND(AVG(check_out - check_in), 1), 0) FROM reservations WHERE status IN ('checked_in', 'checked_out') AND check_in >= p_date - 30),
    'direct_pct', (
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE source = 'direct')::NUMERIC / COUNT(*) * 100, 0) ELSE 0 END
      FROM reservations WHERE check_in >= p_date - 30 AND status != 'cancelled'
    ),
    'repeat_pct', (
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE r.guest_id IN (SELECT guest_id FROM reservations WHERE check_in < r.check_in GROUP BY guest_id HAVING COUNT(*) > 1))::NUMERIC / COUNT(*) * 100, 0) ELSE 0 END
      FROM reservations r WHERE check_in >= p_date - 30 AND status != 'cancelled'
    ),
    'avg_review_score', (SELECT COALESCE(ROUND(AVG(rating), 1), 4.7) FROM meal_feedback WHERE created_at >= NOW() - INTERVAL '30 days'),
    'loyalty_points_earned', (SELECT COALESCE(SUM(points), 0) FROM loyalty_transactions WHERE type = 'earn' AND created_at::DATE = p_date),
    'booking_sources', (
      SELECT jsonb_agg(jsonb_build_object('source', source, 'count', cnt))
      FROM (
        SELECT source, COUNT(*) as cnt
        FROM reservations WHERE check_in >= p_date - 30 AND status != 'cancelled'
        GROUP BY source
      ) s
    ),
    'active_guests', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', g.full_name,
        'room', rm.room_number,
        'nights', (r.check_out - r.check_in),
        'balance', 0,
        'status', r.status,
        'meal_plan', COALESCE(r.meal_plan, 'room_only')
      ))
      FROM reservations r
      JOIN guests g ON g.id = r.guest_id
      LEFT JOIN rooms rm ON rm.id = r.room_id
      WHERE r.status = 'checked_in' AND r.check_in <= p_date AND r.check_out > p_date
      LIMIT 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_deck_payments (use payments table for method)
CREATE OR REPLACE FUNCTION get_business_deck_payments(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'collected_today', (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified' AND created_at::DATE = p_date),
    'outstanding', (
      SELECT COALESCE(SUM(
        COALESCE((SELECT SUM(ft.amount) FROM folio_transactions ft WHERE ft.folio_id = f.id AND ft.type = 'room_charge'), 0)
        - COALESCE((SELECT SUM(fp.amount) FROM folio_payments fp WHERE fp.folio_id = f.id), 0)
      ), 0)
      FROM guest_folios f
      JOIN reservations r ON r.id = f.reservation_id
      WHERE r.status = 'checked_in'
    ),
    'deposits_held', (SELECT COALESCE(SUM(deposit_amount), 0) FROM reservations WHERE status IN ('confirmed', 'checked_in') AND deposit_amount > 0),
    'failed_payments', (SELECT COUNT(*) FROM payments WHERE status = 'rejected' AND created_at::DATE = p_date),
    'by_method', (
      SELECT jsonb_agg(jsonb_build_object('method', method, 'count', cnt, 'total', total))
      FROM (
        SELECT method, COUNT(*) as cnt, SUM(amount) as total
        FROM payments WHERE status = 'verified' AND created_at::DATE = p_date
        GROUP BY method
      ) m
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix: get_business_forecast (GROUP BY issue)
CREATE OR REPLACE FUNCTION get_business_deck_forecast(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_total_rooms INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_rooms FROM rooms WHERE is_active = true;

  SELECT jsonb_agg(jsonb_build_object(
    'date', f.day_date,
    'day_name', TO_CHAR(f.day_date, 'Dy'),
    'day_of_week', EXTRACT(DOW FROM f.day_date)::INTEGER,
    'booked', f.booked,
    'available', v_total_rooms - f.booked,
    'occupancy_pct', ROUND(f.booked::NUMERIC / GREATEST(v_total_rooms, 1) * 100, 1),
    'confidence', CASE
      WHEN f.day_date <= p_date + 3 THEN 'high'
      WHEN f.day_date <= p_date + 7 THEN 'medium'
      ELSE 'low'
    END
  ))
  INTO v_result
  FROM (
    SELECT d as day_date,
      (SELECT COUNT(*) FROM reservations r
       WHERE r.status IN ('confirmed', 'checked_in')
         AND r.check_in <= d AND r.check_out > d) as booked
    FROM generate_series(p_date, p_date + 6, '1 day') d
  ) f
  ORDER BY f.day_date;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
