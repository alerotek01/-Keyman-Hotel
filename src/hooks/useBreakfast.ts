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
