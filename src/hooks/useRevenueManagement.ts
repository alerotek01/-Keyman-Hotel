import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── RATE OVERRIDES ───
export function useRateOverrides() {
  return useQuery({
    queryKey: ['rate-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_overrides')
        .select('*, room_types(id, name, base_rate)')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateRateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (override: {
      room_type_id: string;
      start_date: string;
      end_date: string;
      rate: number;
      reason?: string;
      source?: string;
    }) => {
      const { data, error } = await supabase
        .from('rate_overrides')
        .insert({
          ...override,
          source: override.source || 'manual',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-overrides'] })
  });
}

export function useDeleteRateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rate_overrides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-overrides'] })
  });
}

// ─── MIN STAY RULES ───
export function useMinStayRules() {
  return useQuery({
    queryKey: ['min-stay-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('min_stay_rules')
        .select('*, room_types(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateMinStayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: {
      room_type_id?: string;
      day_of_week?: number;
      start_date?: string;
      end_date?: string;
      min_nights: number;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from('min_stay_rules')
        .insert({
          ...rule,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['min-stay-rules'] })
  });
}

export function useDeleteMinStayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('min_stay_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['min-stay-rules'] })
  });
}

// ─── PRICING RULES ───
export function usePricingRules() {
  return useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: any) => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert({
          ...rule,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] })
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] })
  });
}

// ─── RATE PLANS (FENCING) ───
export function useRatePlans() {
  return useQuery({
    queryKey: ['rate-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_plans')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateRatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: any) => {
      const { data, error } = await supabase
        .from('rate_plans')
        .insert({
          ...plan,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-plans'] })
  });
}

export function useDeleteRatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rate_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-plans'] })
  });
}

// ─── SEASONAL TEMPLATES ───
export function useSeasonalTemplates() {
  return useQuery({
    queryKey: ['seasonal-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_templates')
        .select('*')
        .order('start_date');
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateSeasonalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: any) => {
      const { data, error } = await supabase
        .from('seasonal_templates')
        .insert({
          ...template,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal-templates'] })
  });
}

export function useDeleteSeasonalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal-templates'] })
  });
}

// ─── REVENUE FUNCTIONS ───
export function useCalculateStayTotal() {
  return useMutation({
    mutationFn: async (params: {
      p_room_type_id: string;
      p_check_in: string;
      p_check_out: string;
      p_rate_plan_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('calculate_stay_total', {
        p_room_type_id: params.p_room_type_id,
        p_check_in: params.p_check_in,
        p_check_out: params.p_check_out,
        p_rate_plan_id: params.p_rate_plan_id || null
      });
      if (error) throw error;
      return data;
    }
  });
}

export function useCheckMinStay() {
  return useMutation({
    mutationFn: async (params: {
      p_room_type_id: string;
      p_check_in: string;
      p_check_out: string;
    }) => {
      const { data, error } = await supabase.rpc('check_min_stay', {
        p_room_type_id: params.p_room_type_id,
        p_check_in: params.p_check_in,
        p_check_out: params.p_check_out
      });
      if (error) throw error;
      return data;
    }
  });
}

export function useRevenueSummary() {
  return useQuery({
    queryKey: ['revenue-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_revenue_summary', { p_days: 30 });
      if (error) throw error;
      return data;
    }
  });
}

export function useOverbookingLimit() {
  return useQuery({
    queryKey: ['overbooking-limit'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_overbooking_limit');
      if (error) throw error;
      return data;
    }
  });
}

export function useRunAutoPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('apply_auto_pricing');
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-overrides'] })
  });
}

// ─── ROOM TYPES ───
export function useRoomTypes() {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('is_active', true)
        .order('base_rate');
      if (error) throw error;
      return data;
    }
  });
}
