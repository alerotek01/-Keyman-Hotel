import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Order Status Type =====
export type OrderStatus = 'new' | 'accepted' | 'kitchen_accepted' | 'preparing' | 'ready' | 'delivered' | 'payment_submitted' | 'payment_verified' | 'reconciled' | 'rejected' | 'cancelled';

// ===== List Orders =====
export function useRestaurantOrders(statusFilter?: string[]) {
  return useQuery({
    queryKey: ['restaurant-orders', statusFilter],
    queryFn: async () => {
      let query = sb
        .from('restaurant_orders')
        .select('*, restaurant_order_items(*, menu_items(name, price)), users:waiter_id(full_name)')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Kitchen Orders (specific statuses) =====
export function useKitchenOrders() {
  return useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('restaurant_orders')
        .select('*, restaurant_order_items(*, menu_items(name, price)), users:waiter_id(full_name)')
        .in('status', ['new', 'accepted', 'kitchen_accepted', 'preparing', 'ready'])
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000, // Poll every 5 seconds for kitchen
  });
}

// ===== Waiter Orders (their own) =====
export function useWaiterOrders(waiterId?: string) {
  return useQuery({
    queryKey: ['waiter-orders', waiterId],
    queryFn: async () => {
      let query = sb
        .from('restaurant_orders')
        .select('*, restaurant_order_items(*, menu_items(name, price))')
        .order('created_at', { ascending: false });

      if (waiterId) {
        query = query.eq('waiter_id', waiterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });
}

// ===== Create Order (SERVER-VALIDATED via DB function) =====
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      source: 'web' | 'waiter' | 'walk_in';
      guest_name?: string;
      room_number?: number;
      guest_id?: string;
      waiter_id?: string;
      notes?: string;
      items: { menu_item_id: string; quantity: number; notes?: string }[];
    }) => {
      // Call the safe DB function — prices are validated server-side
      const { data: result, error } = await sb.rpc('create_order_safe', {
        p_guest_id: data.guest_id || null,
        p_room_number: data.room_number || null,
        p_staff_id: data.waiter_id || null,
        p_items: data.items.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}

// ===== Update Order Status (SERVER-VALIDATED via DB function) =====
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: OrderStatus; notes?: string }) => {
      // Call the state machine DB function — validates transitions
      const { data: result, error } = await sb.rpc('update_order_status_sm', {
        p_order_id: orderId,
        p_new_status: status,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}

// ===== Cancel Order (via state machine) =====
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data: result, error } = await sb.rpc('update_order_status_sm', {
        p_order_id: orderId,
        p_new_status: 'cancelled',
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}
