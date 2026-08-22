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
        .select('*, reservations(guests(name, email, phone), rooms(room_number, room_types(name)), check_in, check_out, status)')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Get Folio by Reservation =====
export function useFolio(folioId?: string) {
  return useQuery({
    queryKey: ['folio', folioId],
    queryFn: async () => {
      if (!folioId) return null;
      const { data, error } = await sb
        .from('guest_folios')
        .select('*, folio_transactions(*, recorded_by_user:recorded_by(full_name, email, role)), folio_payments(*, recorded_by_user:recorded_by(full_name, email, role)), reservations(*, guests(*), rooms(*, room_types(*)))')
        .eq('id', folioId)
        .single();
      if (error) throw error;
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

// ===== Post Payment to Folio =====
export function usePostFolioPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folioId, amount, method, reference, recordedBy }: {
      folioId: string;
      amount: number;
      method: string;
      reference?: string;
      recordedBy?: string;
    }) => {
      const { data, error } = await sb
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
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folio'] }),
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
