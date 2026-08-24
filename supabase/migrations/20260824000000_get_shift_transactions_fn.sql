-- SECURITY DEFINER function to bypass RLS for reconciliation transaction drill-down
-- Used by manager/admin reconciliation page to view all transactions for a staff member on a shift date
CREATE OR REPLACE FUNCTION get_shift_transactions(
  p_staff_id uuid,
  p_shift_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payments json;
  v_orders json;
BEGIN
  -- Get payments recorded by this staff on this date
  SELECT COALESCE(json_agg(p ORDER BY p.created_at), '[]'::json) INTO v_payments
  FROM (
    SELECT id, amount, method, mpesa_transaction_id as mpesa_code,
           receipt_image_url, status, created_at::text
    FROM payments
    WHERE recorded_by = p_staff_id
      AND created_at::date = p_shift_date
    ORDER BY created_at
  ) p;

  -- Get restaurant orders handled by this staff on this date
  SELECT COALESCE(json_agg(o ORDER BY o.created_at), '[]'::json) INTO v_orders
  FROM (
    SELECT id, order_number, guest_name, delivery_type, status, total as total_amount, created_at::text
    FROM restaurant_orders
    WHERE waiter_id = p_staff_id
      AND created_at::date = p_shift_date
    ORDER BY created_at
  ) o;

  RETURN json_build_object(
    'payments', v_payments,
    'orders', v_orders
  );
END;
$$;

-- Grant execute to authenticated users (manager/admin will use this)
GRANT EXECUTE ON FUNCTION get_shift_transactions(uuid, date) TO authenticated;
