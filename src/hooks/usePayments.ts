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
          user_id: data.user_id,
          department_id: data.department_id || null,
          shift_date: data.shift_date,
          shift_name: data.shift_name,
          status: 'assigned',
        })
        .select('id, user_id, department_id, shift_date, shift_name, start_time, end_time, status, created_at, users:user_id(full_name, email)')
        .single();
      if (error) throw error;

      // Notify staff of new shift assignment
      try {
        await sb.rpc('fire_notification', {
          p_user_id: data.user_id,
          p_title: `Shift Assigned — ${data.shift_name}`,
          p_body: `You have been assigned a ${data.shift_name} shift on ${data.shift_date}. Please accept or reject.`,
          p_type: 'shift',
        });
      } catch (e) { console.warn('Notification failed:', e); }

      return shift;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-shifts'] }),
  });
}

export function useAcceptShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId }: { shiftId: string }) => {
      const { data: shift, error } = await sb
        .from('staff_shifts')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', shiftId)
        .select('id, user_id, shift_name, shift_date, users:user_id(full_name)')
        .single();
      if (error) throw error;

      // Notify manager that shift was accepted
      try {
        const { data: managers } = await sb.from('users').select('id, email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && shift?.users) {
          for (const m of managers) {
            await sb.rpc('fire_notification', {
              p_user_id: m.id,
              p_title: `Shift Accepted`,
              p_body: `${shift.users?.full_name || 'Staff'} accepted the ${shift.shift_name} shift on ${shift.shift_date}.`,
              p_type: 'shift',
            });
          }
        }
      } catch (e) { console.warn('Notification failed:', e); }

      return shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-shifts'] });
      qc.invalidateQueries({ queryKey: ['all-shifts'] });
    },
  });
}

export function useRejectShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId, reason }: { shiftId: string; reason: string }) => {
      const { data: shift, error } = await sb
        .from('staff_shifts')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          recall_reason: reason,
        })
        .eq('id', shiftId)
        .select('id, user_id, shift_name, shift_date, users:user_id(full_name)')
        .single();
      if (error) throw error;

      // Notify manager that shift was rejected
      try {
        const { data: managers } = await sb.from('users').select('id, email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && shift?.users) {
          for (const m of managers) {
            await sb.rpc('fire_notification', {
              p_user_id: m.id,
              p_title: `Shift Rejected`,
              p_body: `${shift.users?.full_name || 'Staff'} rejected the ${shift.shift_name} shift on ${shift.shift_date}. Reason: ${reason}`,
              p_type: 'shift',
            });
          }
        }
      } catch (e) { console.warn('Notification failed:', e); }

      return shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-shifts'] });
      qc.invalidateQueries({ queryKey: ['all-shifts'] });
    },
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
        .select('id, user_id, department_id, shift_date, shift_name, start_time, end_time, status, created_at, users:user_id(full_name, email)')
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
      submitted_by?: string;
      actual_cash: number;
      notes?: string;
      variance_explanation?: string;
      variance_proof_type?: 'mpesa_message' | 'receipt' | 'both';
      proofFile?: File | null;
    }) => {
      // Server recalculates all totals from actual transactions
      const { data: result, error } = await sb.rpc('submit_reconciliation_safe', {
        p_shift_id: data.shift_id,
        p_actual_cash: data.actual_cash,
        p_notes: data.notes || null,
        p_variance_explanation: data.variance_explanation || null,
        p_variance_proof_type: data.variance_proof_type || null,
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Submission failed');

      const recId = result.reconciliation_id;
      const variance = result.variance;
      const hasVariance = variance !== 0;

      // Upload proof file if provided
      if (data.proofFile && recId) {
        try {
          const ext = data.proofFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/variance/${recId}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, data.proofFile, { contentType: data.proofFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            await sb
              .from('shift_reconciliations')
              .update({ variance_proof_url: urlData.publicUrl })
              .eq('id', recId);
          }
        } catch (e) {
          console.warn('Proof upload failed (reconciliation still submitted):', e);
        }
      }

      // Fetch the full reconciliation record for email notification
      const { data: rec } = await sb
        .from('shift_reconciliations')
        .select('*, staff_shifts(shift_name, users(full_name, email))')
        .eq('id', recId)
        .single();

      // Send reconciliation email to manager/admin
      try {
        const { sendReconciliationSubmitted } = await import('@/lib/email');
        const { data: managers } = await sb.from('users').select('email').in('role', ['admin', 'manager']).eq('is_active', true);
        if (managers?.length && rec?.staff_shifts) {
          const managerEmails = managers.map((m: any) => m.email).filter(Boolean);
          const staffName = rec.staff_shifts?.users?.full_name || 'Staff';
          await sendReconciliationSubmitted(managerEmails, staffName, rec.staff_shifts?.shift_name || '', {
            salesTotal: result.sales_total,
            cashTotal: result.cash_total,
            mpesaTotal: result.mpesa_total,
            variance,
            notes: data.notes,
          });
        }
        // In-app notification to manager/admin
        await sb.rpc('fire_notification', {
          p_title: `Reconciliation Submitted — ${rec?.staff_shifts?.shift_name || 'Shift'}`,
          p_body: hasVariance
            ? `Variance of KES ${variance} reported. Staff explanation: ${data.variance_explanation || 'None'}`
            : `Reconciliation submitted with no variance.`,
          p_type: 'reconciliation',
          p_roles: JSON.stringify(['admin', 'manager']),
        });
      } catch (e) { console.warn('Email/notification failed:', e); }

      return { ...result, rec };
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
        .select('*, staff_shifts(user_id, shift_name)')
        .single();
      if (error) throw error;

      // Update shift status: 'reconciled' when approved, 'closed' when fully reconciled
      if (data.shift_id) {
        await sb
          .from('staff_shifts')
          .update({ status: status === 'approved' ? 'reconciled' : 'closed' })
          .eq('id', data.shift_id);
      }

      // Send in-app notification + email to staff member
      try {
        const staffUserId = data.staff_shifts?.user_id;
        if (staffUserId) {
          if (status === 'flagged') {
            await sb.rpc('fire_notification', {
              p_user_id: staffUserId,
              p_title: '⚠️ Reconciliation Flagged',
              p_body: `Your ${data.staff_shifts?.shift_name || ''} shift reconciliation was flagged. Reason: ${notes || 'No reason provided'}. Please submit an explanation with proof (M-Pesa message or receipt).`,
              p_type: 'reconciliation',
            });
          } else if (status === 'approved' || status === 'reconciled') {
            // In-app notification
            await sb.rpc('fire_notification', {
              p_user_id: staffUserId,
              p_title: status === 'approved' ? '✅ Reconciliation Approved' : '🔒 Shift Closed',
              p_body: status === 'approved'
                ? `Your ${data.staff_shifts?.shift_name || ''} shift reconciliation has been approved. Check your email for the full transaction summary.`
                : `Your ${data.staff_shifts?.shift_name || ''} shift has been fully reconciled and closed.`,
              p_type: 'reconciliation',
            });

            // Send email with full transaction summary to shift owner
            try {
              const { sendShiftReconciliationSummary } = await import('@/lib/email');
              // Get staff email
              const { data: staffUser } = await sb.from('users').select('email, full_name').eq('id', staffUserId).single();
              if (staffUser?.email) {
                // Get full transaction data
                const { data: txData } = await sb.rpc('get_shift_transactions', {
                  p_staff_id: staffUserId,
                  p_shift_date: data.staff_shifts?.shift_date || new Date().toISOString().split('T')[0],
                });
                const payments = (txData?.payments || []).map((p: any) => ({
                  amount: Number(p.amount),
                  method: p.method,
                  mpesaCode: p.mpesa_transaction_id || undefined,
                  hasReceipt: !!p.receipt_image_url,
                  time: new Date(p.created_at).toLocaleTimeString(),
                }));
                const orders = (txData?.orders || []).map((o: any) => ({
                  orderNumber: o.order_number,
                  guestName: o.guest_name || 'Walk-in',
                  total: Number(o.total),
                  type: o.delivery_type || 'dine_in',
                  items: o.items?.length || 0,
                }));

                // Get manager name
                const { data: managerUser } = await sb.from('users').select('full_name').eq('id', managerId).single();

                await sendShiftReconciliationSummary(staffUser.email, staffUser.full_name || 'Staff', {
                  shiftName: data.staff_shifts?.shift_name || 'Unknown',
                  shiftDate: data.staff_shifts?.shift_date || new Date().toISOString().split('T')[0],
                  salesTotal: Number(data.sales_total || 0),
                  cashTotal: Number(data.cash_total || 0),
                  mpesaTotal: Number(data.mpesa_total || 0),
                  variance: Number(data.variance || 0),
                  payments,
                  orders,
                  approvedBy: managerUser?.full_name || 'Manager',
                  notes: data.manager_notes || notes || undefined,
                });

                // Log email send to notifications for admin/manager visibility
                await sb.rpc('fire_notification', {
                  p_title: `📧 Reconciliation Email Sent`,
                  p_body: `Shift reconciliation summary emailed to ${staffUser.full_name || 'staff'} (${staffUser.email}). ${payments.length} payments, ${orders.length} orders. Variance: KES ${data.variance}.`,
                  p_type: 'reconciliation',
                  p_roles: JSON.stringify(['admin', 'manager']),
                });
              }
            } catch (e) { console.warn('Email failed:', e); }
          }
        }
      } catch (e) { console.warn('Staff notification failed:', e); }

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

      // Get payments during shift (now from folio_payments) — with full detail for reconciliation
      const { data: payments } = await sb
        .from('folio_payments')
        .select('id, amount, method, mpesa_transaction_id, receipt_image_url, status, recorded_by, created_at')
        .gte('created_at', shift.start_time || shift.shift_date)
        .lte('created_at', shift.end_time || new Date().toISOString());

      // Also get waiter-recorded payments (from payments table)
      const { data: waiterPayments } = await sb
        .from('payments')
        .select('id, amount, method, mpesa_transaction_id, receipt_image_url, status, recorded_by, created_at, order_id')
        .eq('recorded_by', shift.user_id)
        .gte('created_at', shift.start_time || shift.shift_date)
        .lte('created_at', shift.end_time || new Date().toISOString());

      const allPayments = [...(payments || []), ...(waiterPayments || [])];
      const salesTotal = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
      const cashPayments = allPayments.filter((p: any) => p.method === 'cash');
      const mpesaPayments = allPayments.filter((p: any) => p.method === 'mpesa');
      const cardPayments = allPayments.filter((p: any) => p.method === 'card');
      const cashTotal = cashPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const mpesaTotal = mpesaPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      return {
        shift,
        salesTotal,
        cashTotal,
        mpesaTotal,
        ordersCount: orders?.length || 0,
        paymentsCount: allPayments.length,
        payments: allPayments,
        cashPayments,
        mpesaPayments,
        cardPayments,
      };
    },
    enabled: !!shiftId,
  });
}

// ===== Variance Resolution — Staff submits explanation + proof =====
export function useResolveVariance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      reconciliationId: string;
      explanation: string;
      proofType: 'mpesa_message' | 'receipt' | 'both';
      proofFile?: File | null;
    }) => {
      let proofUrl: string | null = null;

      // Upload proof file if provided
      if (data.proofFile) {
        try {
          const ext = data.proofFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/variance/${data.reconciliationId}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, data.proofFile, { contentType: data.proofFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            proofUrl = urlData.publicUrl;
          }
        } catch (e) {
          console.warn('Proof upload failed:', e);
        }
      }

      const { data: rec, error } = await sb
        .from('shift_reconciliations')
        .update({
          variance_status: 'staff_explained',
          variance_explanation: data.explanation,
          variance_proof_type: data.proofType,
          variance_proof_url: proofUrl,
          variance_resolved_at: new Date().toISOString(),
          status: 'explained',
        })
        .eq('id', data.reconciliationId)
        .select()
        .single();
      if (error) throw error;

      // Notify manager
      try {
        await sb.rpc('fire_notification', {
          p_title: 'Variance Explanation Received',
          p_body: `Staff has submitted an explanation for a variance. Please review.`,
          p_type: 'reconciliation',
          p_roles: JSON.stringify(['admin', 'manager']),
        });
      } catch (e) { console.warn('Notification failed:', e); }

      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });
}

// ===== Admin confirms variance resolution =====
export function useAdminConfirmVariance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      reconciliationId: string;
      adminId: string;
      adminNotes?: string;
      proofFile?: File | null;
      proofType?: 'mpesa_message' | 'receipt' | 'both';
    }) => {
      let proofUrl: string | null = null;

      // Upload admin's proof if provided
      if (data.proofFile) {
        try {
          const ext = data.proofFile.name.split('.').pop() || 'jpg';
          const fileName = `receipts/variance-admin/${data.reconciliationId}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await sb.storage
            .from('rooms')
            .upload(fileName, data.proofFile, { contentType: data.proofFile.type });
          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
            proofUrl = urlData.publicUrl;
          }
        } catch (e) {
          console.warn('Admin proof upload failed:', e);
        }
      }

      const { data: rec, error } = await sb
        .from('shift_reconciliations')
        .update({
          variance_status: 'resolved',
          variance_admin_confirmed: true,
          variance_admin_proof_url: proofUrl,
          variance_admin_confirmed_by: data.adminId,
          variance_admin_confirmed_at: new Date().toISOString(),
          manager_notes: data.adminNotes || undefined,
        })
        .eq('id', data.reconciliationId)
        .select()
        .single();
      if (error) throw error;

      // Notify the staff member
      try {
        const staffId = rec.submitted_by;
        if (staffId) {
          await sb.rpc('fire_notification', {
            p_user_id: staffId,
            p_title: 'Variance Resolved',
            p_body: `Admin has confirmed your variance explanation. Your shift reconciliation has been resolved.`,
            p_type: 'reconciliation',
          });
        }
      } catch (e) { console.warn('Notification failed:', e); }

      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });
}
