-- Create the missing update_order_status_sm function
-- This function validates order status transitions and updates the order

CREATE OR REPLACE FUNCTION public.update_order_status_sm(
  p_order_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_valid_transition BOOLEAN := FALSE;
  v_order RECORD;
BEGIN
  -- Get current order status
  SELECT id, status, order_number INTO v_order
  FROM restaurant_orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  v_current_status := v_order.status::text;
  
  -- Validate status transition
  CASE v_current_status
    WHEN 'new' THEN
      -- Chef can accept or reject new orders
      v_valid_transition := p_new_status IN ('kitchen_accepted', 'rejected', 'cancelled');
    WHEN 'accepted' THEN
      -- Legacy status - can transition to kitchen_accepted
      v_valid_transition := p_new_status IN ('kitchen_accepted', 'rejected', 'cancelled');
    WHEN 'kitchen_accepted' THEN
      -- Chef starts preparing
      v_valid_transition := p_new_status IN ('preparing', 'cancelled');
    WHEN 'preparing' THEN
      -- Chef marks ready
      v_valid_transition := p_new_status IN ('ready', 'cancelled');
    WHEN 'ready' THEN
      -- Waiter delivers
      v_valid_transition := p_new_status IN ('delivered', 'cancelled');
    WHEN 'delivered' THEN
      -- Waiter records payment
      v_valid_transition := p_new_status IN ('payment_submitted', 'cancelled');
    WHEN 'payment_submitted' THEN
      -- Manager verifies
      v_valid_transition := p_new_status IN ('payment_verified', 'payment_rejected');
    WHEN 'payment_verified' THEN
      -- End of day reconciliation
      v_valid_transition := p_new_status IN ('reconciled');
    WHEN 'rejected' THEN
      -- Can be reassigned
      v_valid_transition := p_new_status IN ('kitchen_accepted', 'cancelled');
    WHEN 'cancelled' THEN
      -- Terminal state
      v_valid_transition := FALSE;
    WHEN 'reconciled' THEN
      -- Terminal state
      v_valid_transition := FALSE;
    WHEN 'payment_rejected' THEN
      -- Can be resubmitted
      v_valid_transition := p_new_status IN ('payment_submitted', 'cancelled');
    WHEN 'flagged' THEN
      -- Can be resolved
      v_valid_transition := p_new_status IN ('payment_verified', 'cancelled');
    ELSE
      v_valid_transition := FALSE;
  END CASE;
  
  IF NOT v_valid_transition THEN
    RETURN jsonb_build_object(
      'error', format('Invalid transition from %s to %s', v_current_status, p_new_status)
    );
  END IF;
  
  -- Update the order status
  UPDATE restaurant_orders
  SET status = p_new_status::order_status,
      updated_at = now()
  WHERE id = p_order_id;
  
  -- Log the status change event
  INSERT INTO order_events (order_id, from_status, to_status, actor_id, notes)
  VALUES (
    p_order_id,
    v_current_status::order_status,
    p_new_status::order_status,
    auth.uid(),
    p_notes
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'from_status', v_current_status,
    'to_status', p_new_status,
    'order_number', v_order.order_number
  );
END;
$$;

-- Grant execute permission to authenticated users (staff)
GRANT EXECUTE ON FUNCTION public.update_order_status_sm(UUID, TEXT, TEXT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.update_order_status_sm IS 'Validates and applies order status transitions with audit logging';
