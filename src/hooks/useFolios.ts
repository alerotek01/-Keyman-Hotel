import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== List All Folios (admin view) =====
export function useAllFolios(statusFilter?: string) {
  return useQuery({
    queryKey: ['all-folios', statusFilter],
    queryFn: async () => {
      let query = sb
        .from('guest_folios')
        .select('*, reservations(guests(name, email, phone), rooms(room_number, room_types(name)), check_in, check_out, status), folio_transactions(amount), folio_payments(amount)')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Compute list balance from transactions and payments
      return (data || []).map((f: any) => {
        const totalCharges = (f.folio_transactions || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
        const totalPayments = (f.folio_payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        return { ...f, _listBalance: totalCharges - totalPayments };
      });
    },
  });
}

// ===== Get Folio by Reservation =====
export function useFolio(folioId?: string) {
  return useQuery({
    queryKey: ['folio', folioId],
    queryFn: async () => {
      if (!folioId) return null;
      // Step 1: Get folio with transactions, payments, and reservation data
      const { data, error } = await sb
        .from('guest_folios')
        .select('*, folio_transactions(*), folio_payments(*), reservations(*, guests(*), rooms(*, room_types(*)))')
        .eq('id', folioId)
        .single();
      if (error) {
        console.error('[useFolio] Query error:', JSON.stringify(error));
        throw error;
      }
      if (!data) return null;

      // Step 2: Fetch staff info for recorded_by users (separate query to avoid join failures)
      const staffIds = new Set<string>();
      (data.folio_transactions || []).forEach((t: any) => { if (t.recorded_by) staffIds.add(t.recorded_by); });
      (data.folio_payments || []).forEach((p: any) => { if (p.recorded_by) staffIds.add(p.recorded_by); });

      let staffMap: Record<string, { full_name: string; email: string; role: string }> = {};
      if (staffIds.size > 0) {
        const { data: staffData } = await sb
          .from('users')
          .select('id, full_name, email, role')
          .in('id', Array.from(staffIds));
        if (staffData) {
          staffMap = Object.fromEntries(staffData.map((s: any) => [s.id, s]));
        }
      }

      // Step 3: Attach staff info to transactions and payments
      data.folio_transactions = (data.folio_transactions || []).map((t: any) => ({
        ...t,
        recorded_by_user: t.recorded_by ? staffMap[t.recorded_by] || null : null,
      }));
      data.folio_payments = (data.folio_payments || []).map((p: any) => ({
        ...p,
        recorded_by_user: p.recorded_by ? staffMap[p.recorded_by] || null : null,
      }));

      return data;
    },
    enabled: !!folioId,
  });
}

// ===== Post Room Charge to Folio =====
export function usePostRoomCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folioId, description, amount, recordedBy }: {
      folioId: string;
      description: string;
      amount: number;
      recordedBy?: string;
    }) => {
      const { data, error } = await sb
        .from('folio_transactions')
        .insert({
          folio_id: folioId,
          type: 'room_charge',
          description,
          amount,
          recorded_by: recordedBy || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folio'] }),
  });
}

// ===== Post Restaurant Charge to Folio =====
export function usePostRestaurantCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folioId, description, amount, recordedBy }: {
      folioId: string;
      description: string;
      amount: number;
      recordedBy?: string;
    }) => {
      const { data, error } = await sb
        .from('folio_transactions')
        .insert({
          folio_id: folioId,
          type: 'restaurant_charge',
          description,
          amount,
          recorded_by: recordedBy || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folio'] }),
  });
}

// ===== Post Payment to Folio (with optional receipt upload) =====
export function usePostFolioPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folioId, amount, method, reference, recordedBy, receiptFile }: {
      folioId: string;
      amount: number;
      method: string;
      reference?: string;
      recordedBy?: string;
      receiptFile?: File | null;
    }) => {
      // Insert payment record first
      const { data: payment, error } = await sb
        .from('folio_payments')
        .insert({
          folio_id: folioId,
          amount,
          method,
          reference: reference || null,
          recorded_by: recordedBy || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Upload receipt file if provided
      if (receiptFile && payment) {
        const ext = receiptFile.name.split('.').pop() || 'jpg';
        const fileName = `receipts/folio/${payment.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await sb.storage
          .from('rooms')
          .upload(fileName, receiptFile, { contentType: receiptFile.type });
        if (!uploadErr) {
          const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
          await sb
            .from('folio_payments')
            .update({ receipt_image_url: urlData.publicUrl })
            .eq('id', payment.id);
          payment.receipt_image_url = urlData.publicUrl;
        }
      }

      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// ===== Close Folio =====
export function useCloseFolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folioId: string) => {
      const { data, error } = await sb
        .from('guest_folios')
        .update({ status: 'closed' })
        .eq('id', folioId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folio'] }),
  });
}

// ===== Link Restaurant Order to Folio =====
export function useLinkOrderToFolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, folioId }: { orderId: string; folioId: string }) => {
      const { error } = await sb
        .from('restaurant_orders')
        .update({ guest_id: folioId }) // We'll use a different approach
        .eq('id', orderId);
      if (error) throw error;

      // Get order details and post as restaurant charge
      const { data: order } = await sb
        .from('restaurant_orders')
        .select('*, restaurant_order_items(*, menu_items(name))')
        .eq('id', orderId)
        .single();

      if (order) {
        const description = order.restaurant_order_items
          ?.map((item: any) => `${item.menu_items?.name} x${item.quantity}`)
          .join(', ') || 'Restaurant order';

        await sb
          .from('folio_transactions')
          .insert({
            folio_id: folioId,
            type: 'restaurant_charge',
            description: `Order #${order.order_number}: ${description}`,
            amount: order.total,
          });
      }

      return { orderId, folioId };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folio'] }),
  });
}
