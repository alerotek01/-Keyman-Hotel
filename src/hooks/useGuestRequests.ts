import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GuestRequest, RequestStatus, RequestType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useGuestRequests() {
  return useQuery({
    queryKey: ['guest-requests'],
    queryFn: async (): Promise<GuestRequest[]> => {
      const { data, error } = await sb
        .from('housekeeping_tasks')
        .select(`
          *,
          reservations (
            *,
            guests (*),
            rooms (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Map to GuestRequest shape with bookings alias
      return (data || []).map((item: any) => ({
        ...item,
        reservation_id: item.reservation_id,
        bookings: item.reservations ? {
          ...item.reservations,
          guests: item.reservations.guests,
          rooms: item.reservations.rooms,
        } : null,
      }));
    },
  });
}

export function useCreateGuestRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestData: {
      reservation_id: string;
      request_type: RequestType;
      description?: string;
    }) => {
      const { data: result, error } = await sb
        .from('housekeeping_tasks')
        .insert({
          reservation_id: requestData.reservation_id,
          request_type: requestData.request_type,
          description: requestData.description || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-requests'] });
    },
  });
}

export function useUpdateGuestRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from('housekeeping_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-requests'] });
    },
  });
}
