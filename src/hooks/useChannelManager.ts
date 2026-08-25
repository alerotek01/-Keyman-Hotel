import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── CHANNELS ───
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('channels')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] })
  });
}

// ─── ROOM MAPPINGS ───
export function useChannelMappings(channelId?: string) {
  return useQuery({
    queryKey: ['channel-mappings', channelId],
    queryFn: async () => {
      let query = supabase
        .from('channel_room_mappings')
        .select('*, room_types(id, name, base_rate)')
        .order('created_at');
      if (channelId) query = query.eq('channel_id', channelId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!channelId
  });
}

export function useCreateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: any) => {
      const { data, error } = await supabase
        .from('channel_room_mappings')
        .insert(mapping)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] })
  });
}

export function useUpdateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('channel_room_mappings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] })
  });
}

export function useDeleteMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('channel_room_mappings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] })
  });
}

// ─── SYNC LOG ───
export function useSyncLog(channelId?: string, limit = 50) {
  return useQuery({
    queryKey: ['sync-log', channelId, limit],
    queryFn: async () => {
      let query = supabase
        .from('channel_sync_log')
        .select('*, channels(name, code)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (channelId) query = query.eq('channel_id', channelId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      channel_id: string;
      sync_type: string;
      start_date: string;
      end_date: string;
    }) => {
      // Generate the payload (in production, this would call the OTA API)
      const { data: payload, error: payloadError } = await supabase.rpc(
        params.sync_type === 'rate_push' ? 'generate_rate_push_payload' : 'generate_availability_push_payload',
        {
          p_channel_id: params.channel_id,
          p_start_date: params.start_date,
          p_end_date: params.end_date
        }
      );
      if (payloadError) throw payloadError;

      // Log the sync
      const { data: logId, error: logError } = await supabase.rpc('log_channel_sync', {
        p_channel_id: params.channel_id,
        p_sync_type: params.sync_type,
        p_status: 'success',
        p_room_types_synced: (payload as any)?.rates?.length || 0,
        p_dates_synced: Math.ceil(
          (new Date(params.end_date).getTime() - new Date(params.start_date).getTime()) / 86400000
        ),
        p_response_summary: `Generated ${(payload as any)?.rates?.length || 0} rate entries`
      });
      if (logError) throw logError;

      return { logId, payload };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync-log'] });
      qc.invalidateQueries({ queryKey: ['channels'] });
    }
  });
}

// ─── CHANNEL BOOKINGS ───
export function useChannelBookings(channelId?: string) {
  return useQuery({
    queryKey: ['channel-bookings', channelId],
    queryFn: async () => {
      let query = supabase
        .from('channel_bookings')
        .select('*, channels(name, code), room_types(name)')
        .order('created_at', { ascending: false });
      if (channelId) query = query.eq('channel_id', channelId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

// ─── SYNC SUMMARY ───
export function useChannelSyncSummary() {
  return useQuery({
    queryKey: ['channel-sync-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_channel_sync_summary');
      if (error) throw error;
      return data;
    }
  });
}

// ─── ROOM TYPES (for mapping) ───
export function useRoomTypesForMapping() {
  return useQuery({
    queryKey: ['room-types-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, name, base_rate, max_occupancy')
        .eq('is_active', true)
        .order('base_rate');
      if (error) throw error;
      return data;
    }
  });
}
