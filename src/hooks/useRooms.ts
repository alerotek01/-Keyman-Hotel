import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Room, RoomWithAvailability } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await sb
        .from('rooms')
        .select('*, room_images(*), room_types(*)')
        .eq('is_active', true)
        .order('room_number');
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        room_type: r.room_types?.name || '',
        breakfast_price: r.room_types?.breakfast_price || 0,
      }));
    },
  });
}

export function useAllRooms() {
  return useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await sb
        .from('rooms')
        .select('*, room_images(*), room_types(*)')
        .order('room_number');
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        room_type: r.room_types?.name || '',
        breakfast_price: r.room_types?.breakfast_price || 0,
      }));
    },
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: ['room_types'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('room_types')
        .select('*')
        .eq('is_active', true)
        .order('base_rate');
      if (error) throw error;
      return data;
    },
  });
}

export function useRoomAvailability(checkIn: Date | null, checkOut: Date | null) {
  return useQuery({
    queryKey: ['rooms', 'availability', checkIn?.toISOString(), checkOut?.toISOString()],
    queryFn: async (): Promise<RoomWithAvailability[]> => {
      const { data: rooms, error: roomsError } = await sb
        .from('rooms')
        .select('*, room_images(*), room_types(*)')
        .eq('is_active', true)
        .order('room_number');
      if (roomsError) throw roomsError;

      const mapped = (rooms || []).map((r: any) => ({
        ...r,
        room_type: r.room_types?.name || '',
        breakfast_price: r.room_types?.breakfast_price || 0,
      }));

      if (!checkIn || !checkOut) {
        return mapped.map((room: Room) => ({ ...room, available_count: 1 }));
      }

      const ci = checkIn.toISOString().split('T')[0];
      const co = checkOut.toISOString().split('T')[0];

      const { data: reservations, error: resErr } = await sb
        .from('reservations')
        .select('room_id')
        .in('status', ['confirmed', 'checked_in'])
        .lt('check_in', co)
        .gt('check_out', ci);
      if (resErr) throw resErr;

      const bookedRoomIds = new Set((reservations || []).map((r: any) => r.room_id));

      return mapped.map((room: any) => ({
        ...room,
        available_count: bookedRoomIds.has(room.id) ? 0 : 1,
      }));
    },
    enabled: true,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { room_number: number; room_type_id: string; floor: number; base_price: number }) => {
      const { data: room, error } = await sb.from('rooms').insert(data).select().single();
      if (error) throw error;
      return room;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Room> & { id: string }) => {
      const { room_images: _i, room_types: _t, ...updates } = data as any;
      const { data: room, error } = await sb.from('rooms').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return room;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('rooms').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}
