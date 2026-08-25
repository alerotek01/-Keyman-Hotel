import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── PAYMENT PROVIDERS ───
export function usePaymentProviders() {
  return useQuery({
    queryKey: ['payment-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_providers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('payment_providers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-providers'] })
  });
}

// ─── PAYMENT TRANSACTIONS ───
export function usePaymentTransactions(filters?: { status?: string; provider_id?: string; limit?: number }) {
  return useQuery({
    queryKey: ['payment-transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('payment_transactions')
        .select('*, payment_providers(name, code, icon, provider_type)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.provider_id) query = query.eq('provider_id', filters.provider_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useInitiatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      p_provider_code: string;
      p_amount: number;
      p_currency?: string;
      p_reservation_id?: string;
      p_folio_id?: string;
      p_order_id?: string;
      p_description?: string;
      p_payer_phone?: string;
      p_payer_name?: string;
    }) => {
      const { data, error } = await supabase.rpc('initiate_payment', params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-transactions'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
    }
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      p_transaction_id: string;
      p_action: 'verify' | 'reject';
      p_notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('verify_payment', params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-transactions'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
    }
  });
}

// ─── PAYMENT SUMMARY ───
export function usePaymentSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['payment-summary', startDate, endDate],
    queryFn: async () => {
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || start;
      const { data, error } = await supabase.rpc('get_payment_summary', {
        p_start_date: start,
        p_end_date: end
      });
      if (error) throw error;
      return data;
    }
  });
}

// ─── WEBHOOK EVENTS ───
export function useWebhookEvents(limit = 50) {
  return useQuery({
    queryKey: ['webhook-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_webhook_events')
        .select('*, payment_providers(name, code)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    }
  });
}
