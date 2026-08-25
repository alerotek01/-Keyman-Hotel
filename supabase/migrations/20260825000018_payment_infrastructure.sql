-- ═══════════════════════════════════════════════════════════════
-- PAYMENT INFRASTRUCTURE — Provider Abstraction Layer
-- Supports: Manual (receipt upload), M-Pesa Daraja, Stripe
-- Design: Manual flow works NOW, API adapters plug in LATER
-- ═══════════════════════════════════════════════════════════════

-- 1. PAYMENT PROVIDERS — Configured payment methods
CREATE TABLE IF NOT EXISTS payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- 'M-Pesa (Manual)', 'M-Pesa Daraja', 'Stripe', 'Cash', 'Card (POS)'
  code TEXT UNIQUE NOT NULL,                   -- 'mpesa_manual', 'mpesa_daraja', 'stripe', 'cash', 'card_pos'
  
  -- Provider type
  provider_type TEXT NOT NULL CHECK (provider_type IN (
    'manual',        -- Receipt upload, manager verifies
    'api',           -- Automated via API (M-Pesa Daraja, Stripe)
    'pos',           -- Physical card terminal
    'bank_transfer'  -- Manual bank transfer
  )),
  
  -- API Configuration (for api type providers)
  api_base_url TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  consumer_key TEXT,               -- M-Pesa consumer key
  consumer_secret TEXT,            -- M-Pesa consumer secret
  passkey TEXT,                    -- M-Pesa passkey
  shortcode TEXT,                  -- M-Pesa shortcode (till/paybill)
  callback_url TEXT,               -- Webhook/callback URL
  
  -- Stripe specific
  stripe_publishable_key TEXT,
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  
  -- Display
  icon TEXT,                       -- Emoji or icon name
  color TEXT,                      -- Brand color
  description TEXT,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  requires_verification BOOLEAN DEFAULT true,  -- Manager must verify?
  auto_verify_threshold NUMERIC(10,2),         -- Auto-verify if below this amount
  
  -- Settlement
  settlement_days INTEGER DEFAULT 1,           -- Days to settle
  commission_pct NUMERIC(5,2) DEFAULT 0,       -- Provider commission %
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PAYMENT TRANSACTIONS — Unified payment record
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to business entities (polymorphic — exactly one should be set)
  reservation_id UUID REFERENCES reservations(id),
  folio_id UUID REFERENCES guest_folios(id),
  order_id UUID REFERENCES restaurant_orders(id),
  
  -- Provider
  provider_id UUID NOT NULL REFERENCES payment_providers(id),
  
  -- Amounts
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'KES',
  commission_amount NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(10,2),                     -- amount - commission
  
  -- Reference
  internal_reference TEXT,                       -- Our reference number
  provider_reference TEXT,                       -- M-Pesa receipt, Stripe payment_intent ID
  mpesa_receipt_number TEXT,                     -- M-Pesa specific
  stripe_payment_intent_id TEXT,                 -- Stripe specific
  
  -- Status machine: initiated → processing → successful/failed
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated',      -- Payment started
    'processing',     -- Waiting for confirmation (API) or verification (manual)
    'successful',     -- Confirmed
    'failed',         -- Payment failed
    'cancelled',      -- User cancelled
    'refunded',       -- Refunded
    'disputed'        -- Chargeback or dispute
  )),
  
  -- For manual payments
  receipt_image_url TEXT,                        -- Uploaded receipt/screenshot
  payer_phone TEXT,                              -- Phone number used
  payer_name TEXT,
  
  -- For API payments
  api_response JSONB,                            -- Raw API response
  webhook_verified BOOLEAN DEFAULT false,        -- Confirmed via webhook?
  
  -- Metadata
  description TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_tx_reservation ON payment_transactions(reservation_id);
CREATE INDEX idx_payment_tx_folio ON payment_transactions(folio_id);
CREATE INDEX idx_payment_tx_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_tx_provider ON payment_transactions(provider_id, status);
CREATE INDEX idx_payment_tx_status ON payment_transactions(status, created_at DESC);
CREATE INDEX idx_payment_tx_reference ON payment_transactions(provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payment_tx_mpesa ON payment_transactions(mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL;

-- 3. WEBHOOK EVENTS — Raw webhook payloads from payment providers
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES payment_providers(id),
  
  -- Event details
  event_type TEXT NOT NULL,                      -- 'mpesa_callback', 'stripe.payment_intent.succeeded'
  event_id TEXT,                                 -- Provider's event ID (for idempotency)
  
  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- Linked transaction
  transaction_id UUID REFERENCES payment_transactions(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_provider ON payment_webhook_events(provider_id, processed);
CREATE INDEX idx_webhook_event_id ON payment_webhook_events(event_id) WHERE event_id IS NOT NULL;

-- 4. PAYMENT REFUNDS — Track refunds
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
  
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'processing', 'completed', 'failed')),
  
  provider_refund_id TEXT,
  initiated_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 5. EXTEND EXISTING TYPES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_type') THEN
    CREATE TYPE public.payment_provider_type AS ENUM ('manual', 'api', 'pos', 'bank_transfer');
  END IF;
END $$;

-- 6. RLS POLICIES
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage providers" ON payment_providers FOR ALL USING (is_admin());
CREATE POLICY "Manager view providers" ON payment_providers FOR SELECT USING (is_manager());
CREATE POLICY "Staff view providers" ON payment_providers FOR SELECT USING (is_staff());

CREATE POLICY "Staff create transactions" ON payment_transactions FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "Staff view transactions" ON payment_transactions FOR SELECT USING (is_staff());
CREATE POLICY "Manager verify transactions" ON payment_transactions FOR UPDATE USING (is_manager());
CREATE POLICY "Admin manage transactions" ON payment_transactions FOR ALL USING (is_admin());

CREATE POLICY "Service insert webhooks" ON payment_webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin view webhooks" ON payment_webhook_events FOR SELECT USING (is_admin());

CREATE POLICY "Manager manage refunds" ON payment_refunds FOR ALL USING (is_manager());
CREATE POLICY "Staff view refunds" ON payment_refunds FOR SELECT USING (is_staff());

-- ═══════════════════════════════════════════════════════════════
-- PAYMENT FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Generate internal reference number
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  v_ref := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  RETURN v_ref;
END;
$$;

-- Initiate a payment (works for ALL providers)
CREATE OR REPLACE FUNCTION initiate_payment(
  p_provider_code TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'KES',
  p_reservation_id UUID DEFAULT NULL,
  p_folio_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_payer_phone TEXT DEFAULT NULL,
  p_payer_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider RECORD;
  v_tx_id UUID;
  v_ref TEXT;
  v_result JSON;
BEGIN
  -- Find provider
  SELECT * INTO v_provider FROM payment_providers WHERE code = p_provider_code AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment provider not found or inactive');
  END IF;
  
  -- Generate reference
  v_ref := generate_payment_reference();
  
  -- Calculate net amount
  v_provider.commission_pct := COALESCE(v_provider.commission_pct, 0);
  
  -- Create transaction
  INSERT INTO payment_transactions (
    provider_id, amount, currency, commission_amount, net_amount,
    internal_reference, reservation_id, folio_id, order_id,
    description, payer_phone, payer_name, status, recorded_by
  ) VALUES (
    v_provider.id, p_amount, p_currency,
    ROUND(p_amount * v_provider.commission_pct / 100, 2),
    p_amount - ROUND(p_amount * v_provider.commission_pct / 100, 2),
    v_ref, p_reservation_id, p_folio_id, p_order_id,
    p_description, p_payer_phone, p_payer_name,
    CASE WHEN v_provider.provider_type = 'manual' THEN 'processing' ELSE 'initiated' END,
    auth.uid()
  ) RETURNING id INTO v_tx_id;
  
  -- For manual payments, status is immediately 'processing' (awaiting verification)
  -- For API payments, status is 'initiated' (awaiting API call)
  
  v_result := jsonb_build_object(
    'transaction_id', v_tx_id,
    'reference', v_ref,
    'provider', v_provider.name,
    'provider_type', v_provider.provider_type,
    'amount', p_amount,
    'currency', p_currency,
    'status', CASE WHEN v_provider.provider_type = 'manual' THEN 'processing' ELSE 'initiated' END,
    'message', CASE 
      WHEN v_provider.provider_type = 'manual' THEN 'Payment recorded. Awaiting manager verification.'
      WHEN v_provider.provider_type = 'api' THEN 'Payment initiated. Awaiting provider confirmation.'
      ELSE 'Payment recorded.'
    END
  );
  
  -- For M-Pesa manual, include till/paybill info
  IF v_provider.code = 'mpesa_manual' AND v_provider.shortcode IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'instructions', 'Send KES ' || p_amount || ' to Till/Paybill ' || v_provider.shortcode || '. Reference: ' || v_ref
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Verify a manual payment (manager action)
CREATE OR REPLACE FUNCTION verify_payment(
  p_transaction_id UUID,
  p_action TEXT,              -- 'verify' or 'reject'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_new_status TEXT;
BEGIN
  -- Only managers can verify
  IF NOT is_manager() AND NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Only managers can verify payments');
  END IF;
  
  SELECT * INTO v_tx FROM payment_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;
  
  IF v_tx.status != 'processing' THEN
    RETURN jsonb_build_object('error', 'Transaction is not in verification state. Current status: ' || v_tx.status);
  END IF;
  
  v_new_status := CASE WHEN p_action = 'verify' THEN 'successful' ELSE 'failed' END;
  
  UPDATE payment_transactions
  SET status = v_new_status,
      verified_by = auth.uid(),
      verified_at = now(),
      description = COALESCE(p_notes, description),
      updated_at = now()
  WHERE id = p_transaction_id;
  
  -- If linked to a folio, update the existing folio_payments table for compatibility
  IF v_tx.folio_id IS NOT NULL AND p_action = 'verify' THEN
    INSERT INTO folio_payments (folio_id, amount, method, reference, mpesa_transaction_id, receipt_image_url, recorded_by, verified, verified_by)
    SELECT v_tx.folio_id, v_tx.amount,
      CASE 
        WHEN v_tx.provider_reference LIKE 'mpesa%' OR v_tx.mpesa_receipt_number IS NOT NULL THEN 'mpesa'::payment_method
        WHEN v_tx.provider_reference LIKE 'stripe%' THEN 'card'::payment_method
        ELSE 'other'::payment_method
      END,
      v_tx.internal_reference,
      v_tx.mpesa_receipt_number,
      v_tx.receipt_image_url,
      v_tx.recorded_by,
      true,
      auth.uid();
  END IF;
  
  -- If linked to a reservation, update booking_payments for compatibility
  IF v_tx.reservation_id IS NOT NULL AND p_action = 'verify' THEN
    INSERT INTO booking_payments (reservation_id, amount, method, reference, mpesa_transaction_id, receipt_image_url, status, recorded_by)
    SELECT v_tx.reservation_id, v_tx.amount,
      CASE 
        WHEN v_tx.mpesa_receipt_number IS NOT NULL THEN 'mpesa'::payment_method
        WHEN v_tx.provider_reference LIKE 'stripe%' THEN 'card'::payment_method
        ELSE 'cash'::payment_method
      END,
      v_tx.internal_reference,
      v_tx.mpesa_receipt_number,
      v_tx.receipt_image_url,
      'verified'::payment_status,
      v_tx.recorded_by;
  END IF;
  
  -- If linked to an order, update payments table for compatibility
  IF v_tx.order_id IS NOT NULL AND p_action = 'verify' THEN
    INSERT INTO payments (order_id, amount, method, mpesa_transaction_id, receipt_image_url, status, recorded_by, verified_by)
    SELECT v_tx.order_id, v_tx.amount,
      CASE 
        WHEN v_tx.mpesa_receipt_number IS NOT NULL THEN 'mpesa'::payment_method
        ELSE 'cash'::payment_method
      END,
      v_tx.mpesa_receipt_number,
      v_tx.receipt_image_url,
      'verified'::payment_status,
      v_tx.recorded_by,
      auth.uid();
  END IF;
  
  RETURN jsonb_build_object(
    'transaction_id', p_transaction_id,
    'status', v_new_status,
    'message', CASE WHEN p_action = 'verify' THEN 'Payment verified successfully' ELSE 'Payment rejected' END
  );
END;
$$;

-- Process M-Pesa callback (called by webhook receiver)
CREATE OR REPLACE FUNCTION process_mpesa_callback(
  p_checkout_request_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT,
  p_amount NUMERIC,
  p_mpesa_receipt TEXT,
  p_phone TEXT,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_provider_id UUID;
BEGIN
  -- Find the provider
  SELECT id INTO v_provider_id FROM payment_providers WHERE code = 'mpesa_daraja';
  IF NOT FOUND THEN
    SELECT id INTO v_provider_id FROM payment_providers WHERE code = 'mpesa_manual';
  END IF;
  
  -- Log the webhook event
  INSERT INTO payment_webhook_events (provider_id, event_type, event_id, payload, processed)
  VALUES (v_provider_id, 'mpesa_callback', p_checkout_request_id, p_raw_payload, false);
  
  -- Find the transaction by internal reference or checkout request ID
  SELECT * INTO v_tx FROM payment_transactions
  WHERE internal_reference = p_checkout_request_id
     OR provider_reference = p_checkout_request_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No matching transaction — could be a direct STK push
    RETURN jsonb_build_object('status', 'no_matching_transaction', 'receipt', p_mpesa_receipt);
  END IF;
  
  -- Update transaction
  IF p_result_code = 0 THEN
    UPDATE payment_transactions
    SET status = 'successful',
        provider_reference = p_mpesa_receipt,
        mpesa_receipt_number = p_mpesa_receipt,
        payer_phone = COALESCE(p_phone, payer_phone),
        api_response = p_raw_payload,
        webhook_verified = true,
        verified_at = now(),
        updated_at = now()
    WHERE id = v_tx.id;
    
    -- Auto-update legacy tables
    PERFORM verify_payment(v_tx.id, 'verify', 'Auto-verified via M-Pesa callback');
    
    RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx.id);
  ELSE
    UPDATE payment_transactions
    SET status = 'failed',
        api_response = p_raw_payload,
        description = COALESCE(p_result_desc, 'M-Pesa payment failed'),
        updated_at = now()
    WHERE id = v_tx.id;
    
    RETURN jsonb_build_object('status', 'failed', 'error', p_result_desc);
  END IF;
END;
$$;

-- Process Stripe webhook (called by webhook receiver)
CREATE OR REPLACE FUNCTION process_stripe_webhook(
  p_event_type TEXT,
  p_event_id TEXT,
  p_payment_intent_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_status TEXT,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_provider_id UUID;
BEGIN
  SELECT id INTO v_provider_id FROM payment_providers WHERE code = 'stripe';
  
  -- Log webhook
  INSERT INTO payment_webhook_events (provider_id, event_type, event_id, payload, processed)
  VALUES (v_provider_id, p_event_type, p_event_id, p_raw_payload, false);
  
  -- Find transaction
  SELECT * INTO v_tx FROM payment_transactions
  WHERE stripe_payment_intent_id = p_payment_intent_id
     OR provider_reference = p_payment_intent_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_matching_transaction');
  END IF;
  
  -- Handle event types
  IF p_event_type = 'payment_intent.succeeded' AND p_status = 'succeeded' THEN
    UPDATE payment_transactions
    SET status = 'successful',
        provider_reference = p_payment_intent_id,
        api_response = p_raw_payload,
        webhook_verified = true,
        verified_at = now(),
        updated_at = now()
    WHERE id = v_tx.id;
    
    PERFORM verify_payment(v_tx.id, 'verify', 'Auto-verified via Stripe webhook');
    
    RETURN jsonb_build_object('status', 'success', 'transaction_id', v_tx.id);
  ELSIF p_event_type = 'payment_intent.payment_failed' THEN
    UPDATE payment_transactions
    SET status = 'failed',
        api_response = p_raw_payload,
        description = COALESCE(p_status, 'Stripe payment failed'),
        updated_at = now()
    WHERE id = v_tx.id;
    
    RETURN jsonb_build_object('status', 'failed');
  ELSIF p_event_type = 'charge.dispute.created' THEN
    UPDATE payment_transactions SET status = 'disputed', updated_at = now() WHERE id = v_tx.id;
    RETURN jsonb_build_object('status', 'disputed');
  END IF;
  
  RETURN jsonb_build_object('status', 'unhandled_event', 'event_type', p_event_type);
END;
$$;

-- Get payment summary for reconciliation
CREATE OR REPLACE FUNCTION get_payment_summary(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH tx_summary AS (
    SELECT
      pp.code as provider_code,
      pp.name as provider_name,
      pp.provider_type,
      pt.status,
      COUNT(*) as count,
      SUM(pt.amount) as total_amount,
      SUM(pt.commission_amount) as total_commission,
      SUM(pt.net_amount) as total_net
    FROM payment_transactions pt
    JOIN payment_providers pp ON pp.id = pt.provider_id
    WHERE pt.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY pp.code, pp.name, pp.provider_type, pt.status
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'by_provider', jsonb_agg(jsonb_build_object(
      'provider', ts.provider_name,
      'type', ts.provider_type,
      'status', ts.status,
      'count', ts.count,
      'total', ts.total_amount,
      'commission', ts.total_commission,
      'net', ts.total_net
    )),
    'totals', jsonb_build_object(
      'total_transactions', (SELECT COUNT(*) FROM payment_transactions WHERE created_at::DATE BETWEEN p_start_date AND p_end_date),
      'successful', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'successful' AND created_at::DATE BETWEEN p_start_date AND p_end_date),
      'pending', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'processing' AND created_at::DATE BETWEEN p_start_date AND p_end_date),
      'failed', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'failed' AND created_at::DATE BETWEEN p_start_date AND p_end_date),
      'total_amount', (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE status = 'successful' AND created_at::DATE BETWEEN p_start_date AND p_end_date),
      'total_commission', (SELECT COALESCE(SUM(commission_amount), 0) FROM payment_transactions WHERE status = 'successful' AND created_at::DATE BETWEEN p_start_date AND p_end_date)
    )
  ) INTO v_result
  FROM tx_summary ts;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'by_provider', '[]'::JSONB,
    'totals', jsonb_build_object('total_transactions', 0, 'total_amount', 0)
  ));
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- SEED PAYMENT PROVIDERS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO payment_providers (name, code, provider_type, icon, color, description, requires_verification, is_active) VALUES
  ('M-Pesa (Manual)', 'mpesa_manual', 'manual', '📱', '#4CAF50', 'M-Pesa payment — staff uploads receipt screenshot, manager verifies', true, true),
  ('M-Pesa Daraja', 'mpesa_daraja', 'api', '📱', '#4CAF50', 'Automated M-Pesa via Safaricom Daraja API — instant confirmation via STK push', false, false),
  ('Stripe', 'stripe', 'api', '💳', '#635BFF', 'Card payments via Stripe — Visa, Mastercard, Apple Pay, Google Pay', false, false),
  ('Cash', 'cash', 'manual', '💵', '#FF9800', 'Cash payment — recorded and reconciled at shift end', true, true),
  ('Card (POS)', 'card_pos', 'pos', '💳', '#2196F3', 'Physical card terminal at reception', false, true),
  ('Bank Transfer', 'bank_transfer', 'bank_transfer', '🏦', '#795548', 'Direct bank transfer — manual verification with bank statement', true, true),
  ('Room Charge', 'room_charge', 'manual', '🏨', '#9C27B0', 'Charge to guest folio — paid at checkout', false, true)
ON CONFLICT (code) DO NOTHING;
