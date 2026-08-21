import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Room, RoomWithAvailability, RoomType } from '@/lib/types';

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_images (*)
        `)
        .eq('is_active', true)
        .order('room_number');
      
      if (error) throw error;
      return data as Room[];
    },
  });
}

export function useAllRooms() {
  return useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_images (*)
        `)
        .order('room_number');
      
      if (error) throw error;
      return data as Room[];
    },
  });
}

export function useRoomAvailability(checkIn: Date | null, checkOut: Date | null) {
  return useQuery({
    queryKey: ['rooms', 'availability', checkIn?.toISOString(), checkOut?.toISOString()],
    queryFn: async (): Promise<RoomWithAvailability[]> => {
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          room_images (*)
        `)
        .eq('is_active', true)
        .order('room_number');
      
      if (roomsError) throw roomsError;
      
      if (!checkIn || !checkOut) {
        return (rooms as Room[]).map(room => ({
          ...room,
          available_count: room.total_rooms,
        }));
      }

      // Get confirmed bookings that overlap with the date range
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('room_id')
        .eq('status', 'Confirmed')
        .lt('check_in', checkOut.toISOString().split('T')[0])
        .gt('check_out', checkIn.toISOString().split('T')[0]);
      
      if (bookingsError) throw bookingsError;

      // Count confirmed bookings per room
      const bookingCounts: Record<string, number> = {};
      bookings?.forEach(booking => {
        bookingCounts[booking.room_id] = (bookingCounts[booking.room_id] || 0) + 1;
      });

      return (rooms as Room[]).map(room => ({
        ...room,
        available_count: room.total_rooms - (bookingCounts[room.id] || 0),
      }));
    },
    enabled: true,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      room_number: number;
      room_type: RoomType;
      description: string;
      base_price: number;
      breakfast_price: number;
      total_rooms: number;
    }) => {
      const { data: room, error } = await supabase
        .from('rooms')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Room> & { id: string }) => {
      const { room_images: _ignored, ...updates } = data as Partial<Room> & { room_images?: unknown };
      const { data: room, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
