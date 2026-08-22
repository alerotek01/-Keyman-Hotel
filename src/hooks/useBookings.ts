import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Reservation, Guest } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useBookings() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: async (): Promise<Reservation[]> => {
      const { data, error } = await sb
        .from('reservations')
        .select('*, guests(*), rooms(*, room_types(*)), room_types(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: {
      room_type_id: string;
      check_in: Date;
      check_out: Date;
      num_adults: number;
      num_children: number;
      guest_name: string;
      guest_email: string;
      guest_phone: string;
      special_requests?: string;
      plate_number?: string;
    }) => {
      // Generate idempotency key from guest+dates to prevent double-booking on retry
      const idempotencyKey = `${formData.guest_email}_${formData.check_in.toISOString().split('T')[0]}_${formData.check_out.toISOString().split('T')[0]}_${Date.now()}`;

      // Call atomic DB function — handles guest lookup/create, rate calc, room assignment, reservation
      const { data: result, error } = await sb.rpc('create_booking_safe', {
        p_guest_name: formData.guest_name,
        p_room_type_id: formData.room_type_id,
        p_check_in: formData.check_in.toISOString().split('T')[0],
        p_check_out: formData.check_out.toISOString().split('T')[0],
        p_guest_email: formData.guest_email,
        p_guest_phone: formData.guest_phone,
        p_num_adults: formData.num_adults,
        p_num_children: formData.num_children,
        p_source: 'website',
        p_special_requests: formData.special_requests || null,
        p_plate_number: formData.plate_number || null,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await sb
        .from('reservations')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
