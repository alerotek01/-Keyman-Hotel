import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RequestStatus, RequestType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useGuestRequests() {
  return useQuery({
    queryKey: ['guest-requests'],
    queryFn: async () => {
      // housekeeping_tasks FKs: room_id → rooms, assigned_to → users
      // NO reservation_id FK exists
      const { data, error } = await sb
        .from('housekeeping_tasks')
        .select(`
          *,
          rooms (id, room_number, floor, status, room_types (name)),
          users:assigned_to (id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with active reservation info for each room
      const roomIds = [...new Set((data || []).map((t: any) => t.room_id).filter(Boolean))];
      let roomReservations: Record<string, any> = {};

      if (roomIds.length > 0) {
        const { data: reservations } = await sb
          .from('reservations')
          .select('room_id, guests(name, email, phone), check_in, check_out, status')
          .in('room_id', roomIds)
          .in('status', ['confirmed', 'checked_in']);

        if (reservations) {
          for (const r of reservations) {
            if (!roomReservations[r.room_id]) {
              roomReservations[r.room_id] = r;
            }
          }
        }
      }

      return (data || []).map((item: any) => ({
        ...item,
        reservation: roomReservations[item.room_id] || null,
        rooms: item.rooms,
      }));
    },
  });
}

export function useCreateGuestRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestData: {
      room_id: string;
      request_type: RequestType;
      description?: string;
      shift_date?: string;
      assigned_to?: string;
    }) => {
      const { data: result, error } = await sb
        .from('housekeeping_tasks')
        .insert({
          room_id: requestData.room_id,
          request_type: requestData.request_type,
          notes: requestData.description || null,
          shift_date: requestData.shift_date || new Date().toISOString().split('T')[0],
          assigned_to: requestData.assigned_to || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-requests'] });
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
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
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
    },
  });
}
