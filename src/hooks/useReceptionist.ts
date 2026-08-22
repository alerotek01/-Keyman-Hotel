import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Today's Arrivals =====
export function useTodayArrivals() {
  return useQuery({
    queryKey: ['receptionist', 'arrivals'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await sb
        .from('reservations')
        .select('*, guests(*), rooms(*, room_types(*)), room_types(*)')
        .eq('check_in', today)
        .in('status', ['confirmed', 'pending'])
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Today's Departures =====
export function useTodayDepartures() {
  return useQuery({
    queryKey: ['receptionist', 'departures'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await sb
        .from('reservations')
        .select('*, guests(*), rooms(*, room_types(*)), room_types(*)')
        .eq('check_out', today)
        .eq('status', 'checked_in')
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Available Rooms for Assignment =====
export function useAvailableRooms(roomTypeId?: string) {
  return useQuery({
    queryKey: ['receptionist', 'available-rooms', roomTypeId],
    queryFn: async () => {
      let query = sb
        .from('rooms')
        .select('*, room_types(*)')
        .eq('is_active', true)
        .in('status', ['available', 'inspected']);

      if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId);
      }

      const { data, error } = await query.order('room_number');
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Check-In (ATOMIC via DB function — prevents double-assignment) =====
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, roomId }: { reservationId: string; roomId: string }) => {
      // Call atomic DB function — uses SELECT FOR UPDATE to prevent race conditions
      const { data: result, error } = await sb.rpc('check_in_guest_atomic', {
        p_reservation_id: reservationId,
        p_room_id: roomId,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptionist'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

// ===== Check-Out (SAFE via DB function — validates payment before closing) =====
export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      paymentMethod = 'cash',
      paymentAmount = 0,
      paymentReference,
    }: {
      reservationId: string;
      paymentMethod?: string;
      paymentAmount?: number;
      paymentReference?: string;
    }) => {
      // Call safe DB function — validates reservation status, records payment, creates housekeeping task
      const { data: result, error } = await sb.rpc('check_out_guest_safe', {
        p_reservation_id: reservationId,
        p_payment_method: paymentMethod,
        p_payment_amount: paymentAmount,
        p_payment_reference: paymentReference || null,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptionist'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
    },
  });
}

// ===== Walk-In Mutation =====
export function useWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      guest_name: string;
      guest_phone: string;
      guest_email?: string;
      room_type_id: string;
      room_id: string;
      num_adults: number;
      num_children: number;
      check_out: string;
      rate: number;
      special_requests?: string;
    }) => {
      // 1. Find or create guest
      let guestId: string;
      if (data.guest_email) {
        const { data: existing } = await sb
          .from('guests')
          .select('id')
          .eq('email', data.guest_email)
          .maybeSingle();
        if (existing) {
          guestId = existing.id;
        } else {
          const { data: newGuest, error: gErr } = await sb
            .from('guests')
            .insert({ name: data.guest_name, email: data.guest_email, phone: data.guest_phone })
            .select('id')
            .single();
          if (gErr) throw gErr;
          guestId = newGuest.id;
        }
      } else {
        const { data: newGuest, error: gErr } = await sb
          .from('guests')
          .insert({ name: data.guest_name, phone: data.guest_phone })
          .select('id')
          .single();
        if (gErr) throw gErr;
        guestId = newGuest.id;
      }

      const today = new Date().toISOString().split('T')[0];

      // 2. Create reservation (walk-in, checked_in immediately)
      const { data: reservation, error: resErr } = await sb
        .from('reservations')
        .insert({
          guest_id: guestId,
          room_type_id: data.room_type_id,
          room_id: data.room_id,
          check_in: today,
          check_out: data.check_out,
          num_adults: data.num_adults,
          num_children: data.num_children,
          rate: data.rate,
          source: 'walk_in',
          status: 'checked_in',
          special_requests: data.special_requests || null,
        })
        .select()
        .single();
      if (resErr) throw resErr;

      // 3. Update room -> occupied
      const { error: roomErr } = await sb
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', data.room_id);
      if (roomErr) throw roomErr;

      // 4. Log room status
      await sb
        .from('room_status_history')
        .insert({ room_id: data.room_id, new_status: 'occupied', notes: 'Walk-in guest checked in' });

      // 5. Create folio
      await sb
        .from('guest_folios')
        .insert({ reservation_id: reservation.id, guest_id: guestId });

      return reservation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptionist'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

// ===== Room Status Overview =====
export function useRoomStatusOverview() {
  return useQuery({
    queryKey: ['receptionist', 'room-status'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('rooms')
        .select('id, room_number, floor, status, room_types(name)')
        .eq('is_active', true)
        .order('room_number');
      if (error) throw error;
      return data || [];
    },
  });
}
