import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useRoomTypesList() {
  return useQuery({
    queryKey: ['room_types_list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('room_types')
        .select('*')
        .order('base_rate');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      base_rate: number;
      max_occupancy: number;
      breakfast_price: number;
    }) => {
      const { data: rt, error } = await sb
        .from('room_types')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return rt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room_types_list'] }),
  });
}

export function useUpdateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; base_rate?: number; max_occupancy?: number; breakfast_price?: number; is_active?: boolean }) => {
      const { data: rt, error } = await sb
        .from('room_types')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return rt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room_types_list'] }),
  });
}

export function useDeleteRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('room_types').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room_types_list'] }),
  });
}
