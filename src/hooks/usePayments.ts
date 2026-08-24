import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== All Payments (now from folio_payments — consolidated) =====
export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('folio_payments')
        .select('*, guest_folios(id, reservation_id, guests(name, email))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Record Payment (SAFE via DB function) =====
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      reservation_id: string;
      method: string;
      amount: number;
      mpesa_transaction_id?: string;
      notes?: string;
      receiptFile?: File | null;
    }) => {
      const { data: result, error } = await sb.rpc('record_payment_safe', {
        p_reservation_id: data.reservation_id,
        p_method: data.method,
        p_amount: data.amount,
        p_mpesa_txn_id: data.mpesa_transaction_id || null,
        p_notes: data.notes || null,
      });
      if (error) throw error;

      // Upload receipt file if provided
      if (data.receiptFile && result) {
        try {
          const ext = data.receiptFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/folio/${result.payment_id}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, data.receiptFile, { contentType: data.receiptFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            await sb
              .from('folio_payments')
              .update({ receipt_image_url: urlData.publicUrl })
              .eq('id', result.payment_id);
          }
        } catch (e) {
          console.warn('Receipt upload failed (payment still recorded):', e);
        }
      }

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['folio'] });
    },
  });
}

// ===== Record Order Payment (restaurant orders — uses folio_payments) =====
export function useRecordOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      order_id: string;
      folio_id?: string;
      amount: number;
      method: string;
      mpesa_transaction_id?: string;
      recorded_by: string;
      receiptFile?: File | null;
    }) => {
      const { data: payment, error } = await sb
        .from('folio_payments')
        .insert({
          order_id: data.order_id,
          folio_id: data.folio_id || null,
          amount: data.amount,
          method: data.method,
          mpesa_transaction_id: data.mpesa_transaction_id || null,
          recorded_by: data.recorded_by,
          status: 'completed',
        })
        .select()
        .single();
      if (error) throw error;

      // Upload receipt file if provided
      if (data.receiptFile && payment) {
        try {
          const ext = data.receiptFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/order/${payment.id}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, data.receiptFile, { contentType: data.receiptFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            await sb
              .from('folio_payments')
              .update({ receipt_image_url: urlData.publicUrl })
              .eq('id', payment.id);
          }
        } catch (e) {
          console.warn('Receipt upload failed (payment still recorded):', e);
        }
      }

      // Update order status via state machine
      if (data.order_id) {
        await sb.rpc('update_order_status_sm', {
          p_order_id: data.order_id,
          p_new_status: 'payment_submitted',
        });
      }

      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
    },
  });
}

// ===== Verify Payment =====
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, status, verifiedBy }: { paymentId: string; status: string; verifiedBy: string }) => {
      const verified = status === 'verified';
      const { data, error } = await sb
        .from('folio_payments')
        .update({
          verified,
          verified_by: verifiedBy,
          status: verified ? 'verified' : 'rejected',
        })
        .eq('id', paymentId)
        .select()
        .single();
      if (error) throw error;
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
        .select('*, users(full_name, email, role), departments(name)')
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
        .select('*, users(full_name, email, role), departments(name)')
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
        .select('*, users(full_name, email)')
        .single();
      if (error) throw error;

      // Send shift check-in notification to manager/admin emails
      try {
        const { sendShiftCheckIn } = await import('@/lib/email');
        const { data: managers } = await sb.from('users').select('email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && shift?.users) {
          const managerEmails = managers.map((m: any) => m.email).filter(Boolean);
          await sendShiftCheckIn(managerEmails, shift.users.full_name || 'Staff', shift.shift_name, new Date().toLocaleString());
        }
        // In-app notification
        await sb.rpc('fire_notification', {
          p_user_id: data.user_id,
          p_title: `Shift Started — ${data.shift_name}`,
          p_body: `You checked in for the ${data.shift_name} shift.`,
          p_type: 'shift',
        });
      } catch (e) { console.warn('Email/notification failed:', e); }

      return shift;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-shifts'] }),
  });
}

export function useEndShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId }: { shiftId: string }) => {
      const { data: shift, error } = await sb
        .from('staff_shifts')
        .update({
          end_time: new Date().toISOString(),
          status: 'ended',
        })
        .eq('id', shiftId)
        .select('*, users(full_name, email)')
        .single();
      if (error) throw error;

      // Send shift end notification to manager/admin
      try {
        const { sendShiftCheckOut } = await import('@/lib/email');
        const { data: managers } = await sb.from('users').select('email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && shift?.users && shift.start_time) {
          const managerEmails = managers.map((m: any) => m.email).filter(Boolean);
          await sendShiftCheckOut(managerEmails, shift.users.full_name || 'Staff', shift.shift_name, shift.start_time, new Date().toISOString());
        }
        // In-app notification to staff
        await sb.rpc('fire_notification', {
          p_user_id: shift.user_id,
          p_title: `Shift Ended — ${shift.shift_name}`,
          p_body: `Your ${shift.shift_name} shift has ended. Please submit your reconciliation.`,
          p_type: 'shift',
        });
      } catch (e) { console.warn('Email/notification failed:', e); }

      return shift;
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
        .select('*, staff_shifts(*, users(full_name, email)), users_submitted:submitted_by(full_name), users_manager:manager_id(full_name)')
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
        .select('*, staff_shifts(shift_name, users(full_name, email))')
        .single();
      if (error) throw error;

      await sb
        .from('staff_shifts')
        .update({ status: 'submitted' })
        .eq('id', data.shift_id);

      // Send reconciliation email to manager/admin
      try {
        const { sendReconciliationSubmitted } = await import('@/lib/email');
        const { data: managers } = await sb.from('users').select('email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && rec?.staff_shifts) {
          const managerEmails = managers.map((m: any) => m.email).filter(Boolean);
          const staffName = rec.staff_shifts?.users?.full_name || 'Staff';
          await sendReconciliationSubmitted(managerEmails, staffName, rec.staff_shifts?.shift_name || '', {
            salesTotal: data.sales_total,
            cashTotal: data.cash_total,
            mpesaTotal: data.mpesa_total,
            variance,
            notes: data.notes,
          });
        }
      } catch (e) { console.warn('Reconciliation email failed:', e); }

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
    mutationFn: async ({ reconciliationId, managerId, status, notes }: { reconciliationId: string; managerId: string; status: string; notes?: string }) => {
      const updateData: any = {
        status,
        manager_id: managerId,
      };
      // Only set reconciled_at when status is 'reconciled' (final close), not on 'approved'
      if (status === 'reconciled') {
        updateData.reconciled_at = new Date().toISOString();
      }
      // Save manager notes (abnormality notes when flagging)
      if (notes) {
        updateData.manager_notes = notes;
      }

      const { data, error } = await sb
        .from('shift_reconciliations')
        .update(updateData)
        .eq('id', reconciliationId)
        .select()
        .single();
      if (error) throw error;

      // Update shift status: 'reconciled' when approved, 'closed' when fully reconciled
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

      // Get payments during shift (now from folio_payments)
      const { data: payments } = await sb
        .from('folio_payments')
        .select('id, amount, method, status')
        .gte('created_at', shift.start_time || shift.shift_date)
        .lte('created_at', shift.end_time || new Date().toISOString());

      const salesTotal = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
      const cashPayments = payments?.filter((p: any) => p.method === 'cash') || [];
      const mpesaPayments = payments?.filter((p: any) => p.method === 'mpesa') || [];
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
