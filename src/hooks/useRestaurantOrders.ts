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

// ===== Create Order =====
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
      items: { menu_item_id: string; quantity: number; unit_price: number; notes?: string }[];
    }) => {
      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const vatRate = 0.16;
      const vatAmount = Math.round(subtotal * vatRate);
      const total = subtotal + vatAmount;

      // Create order
      const { data: order, error: orderErr } = await sb
        .from('restaurant_orders')
        .insert({
          source: data.source,
          guest_name: data.guest_name || null,
          room_number: data.room_number || null,
          guest_id: data.guest_id || null,
          waiter_id: data.waiter_id || null,
          notes: data.notes || null,
          status: 'new',
          total,
          vat_amount: vatAmount,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsErr } = await sb
        .from('restaurant_order_items')
        .insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Log order event
      await sb
        .from('order_events')
        .insert({
          order_id: order.id,
          from_status: null,
          to_status: 'new',
          notes: `Order created from ${data.source}`,
        });

      return order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}

// ===== Update Order Status =====
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: OrderStatus; notes?: string }) => {
      // Get current status
      const { data: current } = await sb
        .from('restaurant_orders')
        .select('status')
        .eq('id', orderId)
        .single();

      // Update order status
      const { error } = await sb
        .from('restaurant_orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;

      // Log event
      await sb
        .from('order_events')
        .insert({
          order_id: orderId,
          from_status: current?.status || null,
          to_status: status,
          notes: notes || null,
        });

      return { orderId, status };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}

// ===== Delete Order (cancel) =====
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await sb
        .from('restaurant_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;

      await sb
        .from('order_events')
        .insert({
          order_id: orderId,
          to_status: 'cancelled',
          notes: 'Order cancelled',
        });

      return orderId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['waiter-orders'] });
    },
  });
}
