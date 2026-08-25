import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── COMPETITOR HOTELS ───
export function useCompetitorHotels() {
  return useQuery({
    queryKey: ['competitor-hotels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitor_hotels')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateCompetitorHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hotel: any) => {
      const { data, error } = await supabase.from('competitor_hotels').insert(hotel).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-hotels'] })
  });
}

export function useUpdateCompetitorHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('competitor_hotels')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-hotels'] })
  });
}

export function useDeleteCompetitorHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('competitor_hotels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-hotels'] })
  });
}

// ─── COMPETITOR RATES ───
export function useRecordCompetitorRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rate: {
      p_competitor_hotel_id: string;
      p_stay_date: string;
      p_rate: number;
      p_currency?: string;
      p_room_type?: string;
      p_room_name?: string;
      p_source?: string;
      p_source_url?: string;
      p_cancellation_policy?: string;
      p_meal_plan?: string;
    }) => {
      const { data, error } = await supabase.rpc('record_competitor_rate', rate);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitor-rates'] });
      qc.invalidateQueries({ queryKey: ['rate-alerts'] });
    }
  });
}

export function useCompetitorComparison(date?: string) {
  return useQuery({
    queryKey: ['competitor-comparison', date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_competitor_comparison', {
        p_date: date || new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      return data;
    }
  });
}

export function useCompetitorTrends(hotelId?: string, days = 30) {
  return useQuery({
    queryKey: ['competitor-trends', hotelId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_competitor_trends', {
        p_competitor_hotel_id: hotelId,
        p_days: days
      });
      if (error) throw error;
      return data;
    },
    enabled: !!hotelId
  });
}

// ─── RATE ALERTS ───
export function useRateAlerts(unreadOnly = false) {
  return useQuery({
    queryKey: ['rate-alerts', unreadOnly],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rate_alerts', { p_unread_only: unreadOnly });
      if (error) throw error;
      return data;
    }
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.rpc('mark_alert_read', { p_alert_id: alertId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-alerts'] })
  });
}

// ─── SCRAPE LOGS ───
export function useScrapeLogs(limit = 50) {
  return useQuery({
    queryKey: ['scrape-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitor_scrape_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    }
  });
}

export function useLogScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: any) => {
      const { data, error } = await supabase.from('competitor_scrape_logs').insert({
        ...log,
        triggered_by_user: (await supabase.auth.getUser()).data.user?.id
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrape-logs'] })
  });
}
