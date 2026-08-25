import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BreakfastOrder {
  id: string;
  verification_code: string;
  guest_name: string;
  room_number: string;
  pax: number;
  status: string;
  verified_at: string | null;
  meal_date: string;
  reservation_id: string;
}

export interface VerifyResult {
  valid: boolean;
  guest_name: string | null;
  room_number: string | null;
  item_name: string | null;
  item_price: number | null;
  quantity: number | null;
  pax: number | null;
  meal_date: string | null;
  status: string | null;
  message: string | null;
}

export function useTodayBreakfasts() {
  return useQuery({
    queryKey: ['today-breakfasts'],
    queryFn: async (): Promise<BreakfastOrder[]> => {
      const { data, error } = await supabase.rpc('get_today_breakfasts');
      if (error) throw error;
      return (data ?? []) as BreakfastOrder[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}

export interface BreakfastItem {
  id: string;
  verification_code: string;
  guest_name: string;
  room_number: string;
  item_name: string;
  item_price: number;
  quantity: number;
  status: string;
  verified_at: string | null;
  meal_date: string;
  breakfast_order_id: string;
}

export function useTodayBreakfastItems() {
  return useQuery({
    queryKey: ['today-breakfast-items'],
    queryFn: async (): Promise<BreakfastItem[]> => {
      const { data, error } = await supabase.rpc('get_today_breakfast_items');
      if (error) throw error;
      return (data ?? []) as BreakfastItem[];
    },
    refetchInterval: 30000,
  });
}

export function useVerifyBreakfastCode() {
  return useMutation({
    mutationFn: async (code: string): Promise<VerifyResult> => {
      const { data, error } = await supabase.rpc('verify_breakfast_code', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      const r = data?.[0];
      return {
        valid: r?.valid ?? false,
        guest_name: r?.guest_name ?? null,
        room_number: r?.room_number ?? null,
        item_name: r?.item_name ?? null,
        item_price: r?.item_price ?? null,
        quantity: r?.quantity ?? null,
        pax: r?.pax ?? null,
        meal_date: r?.meal_date ?? null,
        status: r?.status ?? null,
        message: r?.message ?? 'Unknown error',
      };
    },
  });
}

export function useMarkBreakfastServed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('mark_breakfast_served', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-breakfasts'] });
    },
  });
}

export function useMarkBreakfastSkipped() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('mark_breakfast_skipped', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-breakfasts'] });
    },
  });
}

export function useScheduleBreakfasts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      p_reservation_id: string;
      p_room_number: string;
      p_guest_name: string;
      p_check_in: string;
      p_check_out: string;
      p_num_adults: number;
      p_guest_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('schedule_bb_breakfasts', params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-breakfasts'] });
    },
  });
}

// Breakfast selections (what guest picks at booking time)
export interface BreakfastSelection {
  id: string;
  reservation_id: string;
  menu_item_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
  meal_date: string;
  pax: number;
}

export function useBreakfastSelections(reservationId?: string) {
  return useQuery({
    queryKey: ['breakfast-selections', reservationId],
    queryFn: async () => {
      if (!reservationId) return [];
      const { data, error } = await supabase
        .from('breakfast_selections')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('meal_date');
      if (error) throw error;
      return (data ?? []) as BreakfastSelection[];
    },
    enabled: !!reservationId,
  });
}

export function useSaveBreakfastSelections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      selections,
    }: {
      reservationId: string;
      selections: Omit<BreakfastSelection, 'id' | 'reservation_id'>[];
    }) => {
      // Delete existing selections
      await supabase.from('breakfast_selections').delete().eq('reservation_id', reservationId);
      // Insert new ones
      if (selections.length > 0) {
        const { error } = await supabase.from('breakfast_selections').insert(
          selections.map(s => ({ ...s, reservation_id: reservationId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['breakfast-selections'] });
    },
  });
}

export function useGuestBreakfastOrders(guestId?: string) {
  return useQuery({
    queryKey: ['guest-breakfast-orders', guestId],
    queryFn: async () => {
      if (!guestId) return [];
      const { data, error } = await supabase.rpc('get_guest_breakfast_orders', { p_guest_id: guestId });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!guestId,
    refetchInterval: 15000,
  });
}

export function useUpdateKitchenStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { data, error } = await supabase.rpc('update_breakfast_kitchen_status', {
        p_item_id: itemId,
        p_new_status: status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-breakfast-items'] });
      qc.invalidateQueries({ queryKey: ['today-breakfasts'] });
      qc.invalidateQueries({ queryKey: ['guest-breakfast-orders'] });
    },
  });
}

export interface GuestAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: any;
  created_at: string;
}

export function useGuestAlerts(guestId?: string) {
  return useQuery({
    queryKey: ['guest-alerts', guestId],
    queryFn: async () => {
      if (!guestId) return [];
      const { data, error } = await supabase
        .from('guest_alerts')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as GuestAlert[];
    },
    enabled: !!guestId,
    refetchInterval: 10000,
  });
}

export function useUnreadAlertCount(guestId?: string) {
  return useQuery({
    queryKey: ['unread-alert-count', guestId],
    queryFn: async () => {
      if (!guestId) return 0;
      const { data, error } = await supabase.rpc('get_unread_alert_count', { p_guest_id: guestId });
      if (error) throw error;
      return data ?? 0;
    },
    enabled: !!guestId,
    refetchInterval: 10000,
  });
}

export function useMarkAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guestId: string) => {
      const { error } = await supabase.rpc('mark_alerts_read', { p_guest_id: guestId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guest-alerts'] });
      qc.invalidateQueries({ queryKey: ['unread-alert-count'] });
    },
  });
}

export function useBreakfastMenuItems() {
  return useQuery({
    queryKey: ['breakfast-menu-items'],
    queryFn: async () => {
      // Get breakfast category
      const { data: cat } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('name', 'Breakfast')
        .single();
      if (!cat) return [];
      // Get breakfast items
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, description, image_url')
        .eq('category_id', cat.id)
        .eq('is_available', true)
        .order('price');
      if (error) throw error;
      return data ?? [];
    },
  });
}
