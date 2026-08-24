CREATE OR REPLACE FUNCTION public.update_order_status_sm(
  p_order_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_valid_transitions JSONB := '{
    "new": ["kitchen_accepted", "rejected"],
    "kitchen_accepted": ["preparing"],
    "preparing": ["ready"],
    "ready": ["delivered"],
    "delivered": ["payment_submitted"],
    "payment_submitted": ["payment_verified", "cancelled"]
  }'::jsonb;
  v_allowed JSONB;
BEGIN
  SELECT status INTO v_current_status
  FROM restaurant_orders
  WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_allowed := v_valid_transitions -> v_current_status;

  IF v_allowed IS NULL OR NOT (v_allowed @> to_jsonb(p_new_status::text)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition from ' || v_current_status || ' to ' || p_new_status
    );
  END IF;

  UPDATE restaurant_orders
  SET status = p_new_status::order_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, from_status, to_status, notes, actor_id)
  VALUES (p_order_id, v_current_status::order_status, p_new_status::order_status, p_notes, auth.uid());

  RETURN jsonb_build_object('success', true, 'from', v_current_status, 'to', p_new_status);
END;
$$;
