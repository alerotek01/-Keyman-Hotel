import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Payments =====
export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('payments')
        .select('*, restaurant_orders(order_number, guest_name), guest_folios(id, reservation_id), users_recorded:recorded_by(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      order_id?: string;
      folio_id?: string;
      amount: number;
      method: string;
      mpesa_transaction_id?: string;
      receipt_image_url?: string;
      recorded_by: string;
    }) => {
      const { data: payment, error } = await sb
        .from('payments')
        .insert(data)
        .select()
        .single();
      if (error) throw error;

      // Update order status if linked
      if (data.order_id) {
        await sb
          .from('restaurant_orders')
          .update({ status: 'payment_submitted' })
          .eq('id', data.order_id);
      }

      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
    },
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, status, verifiedBy }: { paymentId: string; status: string; verifiedBy: string }) => {
      const { data, error } = await sb
        .from('payments')
        .update({ status, verified_by: verifiedBy })
        .eq('id', paymentId)
        .select()
        .single();
      if (error) throw error;

      // Update order if payment verified
      if (status === 'verified' && data.order_id) {
        await sb
          .from('restaurant_orders')
          .update({ status: 'payment_verified' })
          .eq('id', data.order_id);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
    },
  });
}

// ===== Staff Shifts =====
export function useStaffShifts(userId?: string, date?: string) {
  return useQuery({
    queryKey: ['staff-shifts', userId, date],
    queryFn: async () => {
      let query = sb
        .from('staff_shifts')
        .select('*, users(user_id, full_name, email), departments(name)')
        .order('shift_date', { ascending: false });

      if (userId) query = query.eq('user_id', userId);
      if (date) query = query.eq('shift_date', date);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllShifts(date?: string) {
  return useQuery({
    queryKey: ['staff-shifts', 'all', date],
    queryFn: async () => {
      let query = sb
        .from('staff_shifts')
        .select('*, users(user_id, full_name, email), departments(name)')
        .order('shift_date', { ascending: false });

      if (date) query = query.eq('shift_date', date);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useStartShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      department_id?: string;
      shift_date: string;
      shift_name: string;
    }) => {
      const { data: shift, error } = await sb
        .from('staff_shifts')
        .insert({
          ...data,
          start_time: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return shift;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-shifts'] }),
  });
}

export function useEndShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId }: { shiftId: string }) => {
      const { data, error } = await sb
        .from('staff_shifts')
        .update({
          end_time: new Date().toISOString(),
          status: 'ended',
        })
        .eq('id', shiftId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-shifts'] }),
  });
}

// ===== Reconciliation =====
export function useReconciliations(date?: string) {
  return useQuery({
    queryKey: ['reconciliations', date],
    queryFn: async () => {
      let query = sb
        .from('shift_reconciliations')
        .select('*, staff_shifts(*, users(user_id, full_name)), users_submitted:submitted_by(full_name), users_manager:manager_id(full_name)')
        .order('created_at', { ascending: false });

      if (date) query = query.eq('staff_shifts.shift_date', date);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSubmitReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      shift_id: string;
      submitted_by: string;
      sales_total: number;
      cash_total: number;
      mpesa_total: number;
      room_charges_total: number;
      expected_cash: number;
      actual_cash: number;
      notes?: string;
    }) => {
      const variance = data.actual_cash - data.expected_cash;
      const { data: rec, error } = await sb
        .from('shift_reconciliations')
        .insert({
          ...data,
          variance,
          status: 'submitted',
        })
        .select()
        .single();
      if (error) throw error;

      // Update shift status
      await sb
        .from('staff_shifts')
        .update({ status: 'submitted' })
        .eq('id', data.shift_id);

      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['staff-shifts'] });
    },
  });
}

export function useApproveReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reconciliationId, managerId, status }: { reconciliationId: string; managerId: string; status: string }) => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .update({
          status,
          manager_id: managerId,
          reconciled_at: new Date().toISOString(),
        })
        .eq('id', reconciliationId)
        .select()
        .single();
      if (error) throw error;

      // Update shift status
      if (data.shift_id) {
        await sb
          .from('staff_shifts')
          .update({ status: status === 'approved' ? 'reconciled' : 'closed' })
          .eq('id', data.shift_id);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['staff-shifts'] });
    },
  });
}

// ===== Shift Summary (for reconciliation form) =====
export function useShiftSummary(shiftId: string) {
  return useQuery({
    queryKey: ['shift-summary', shiftId],
    queryFn: async () => {
      // Get shift info
      const { data: shift } = await sb
        .from('staff_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();

      if (!shift) return null;

      // Get orders during shift
      const { data: orders } = await sb
        .from('restaurant_orders')
        .select('id, total, status, payment_method')
        .gte('created_at', shift.start_time || shift.shift_date)
        .lte('created_at', shift.end_time || new Date().toISOString());

      // Get payments during shift
      const { data: payments } = await sb
        .from('payments')
        .select('id, amount, method, status')
        .gte('created_at', shift.start_time || shift.shift_date)
        .lte('created_at', shift.end_time || new Date().toISOString());

      const salesTotal = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
      const cashPayments = payments?.filter((p: any) => p.method === 'cash' && p.status !== 'rejected') || [];
      const mpesaPayments = payments?.filter((p: any) => p.method === 'mpesa' && p.status !== 'rejected') || [];
      const cashTotal = cashPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const mpesaTotal = mpesaPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      return {
        shift,
        salesTotal,
        cashTotal,
        mpesaTotal,
        ordersCount: orders?.length || 0,
        paymentsCount: payments?.length || 0,
      };
    },
    enabled: !!shiftId,
  });
}
