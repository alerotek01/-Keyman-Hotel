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
    }) => {
      // 1. Find or create guest
      let guestId: string;
      const { data: existingGuest } = await sb
        .from('guests')
        .select('id')
        .eq('email', formData.guest_email)
        .maybeSingle();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        const { data: newGuest, error: guestErr } = await sb
          .from('guests')
          .insert({
            name: formData.guest_name,
            email: formData.guest_email,
            phone: formData.guest_phone,
          })
          .select('id')
          .single();
        if (guestErr) throw guestErr;
        guestId = newGuest.id;
      }

      // 2. Get rate from room_types
      const { data: rt, error: rtErr } = await sb
        .from('room_types')
        .select('base_rate')
        .eq('id', formData.room_type_id)
        .single();
      if (rtErr) throw rtErr;

      const nights = Math.ceil(
        (formData.check_out.getTime() - formData.check_in.getTime()) / (1000 * 60 * 60 * 24)
      );
      const rate = Number(rt.base_rate) * nights;

      // 3. Create reservation
      const { data: reservation, error: resErr } = await sb
        .from('reservations')
        .insert({
          guest_id: guestId,
          room_type_id: formData.room_type_id,
          check_in: formData.check_in.toISOString().split('T')[0],
          check_out: formData.check_out.toISOString().split('T')[0],
          num_adults: formData.num_adults,
          num_children: formData.num_children,
          rate,
          source: 'website',
          status: 'confirmed',
          special_requests: formData.special_requests || null,
        })
        .select()
        .single();
      if (resErr) throw resErr;

      return reservation;
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
