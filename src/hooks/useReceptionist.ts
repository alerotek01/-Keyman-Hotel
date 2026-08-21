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

// ===== Check-In Mutation =====
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, roomId }: { reservationId: string; roomId: string }) => {
      // 1. Update reservation: assign room, status -> checked_in
      const { error: resErr } = await sb
        .from('reservations')
        .update({ room_id: roomId, status: 'checked_in' })
        .eq('id', reservationId);
      if (resErr) throw resErr;

      // 2. Update room status -> occupied
      const { error: roomErr } = await sb
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', roomId);
      if (roomErr) throw roomErr;

      // 3. Log room status change
      await sb
        .from('room_status_history')
        .insert({ room_id: roomId, status: 'occupied', notes: 'Guest checked in' });

      // 4. Create guest folio
      const { data: reservation } = await sb
        .from('reservations')
        .select('guest_id')
        .eq('id', reservationId)
        .single();

      if (reservation) {
        await sb
          .from('guest_folios')
          .insert({ reservation_id: reservationId, guest_id: reservation.guest_id });
      }

      return { reservationId, roomId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptionist'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

// ===== Check-Out Mutation =====
export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, roomId }: { reservationId: string; roomId: string }) => {
      // 1. Update reservation -> checked_out
      const { error: resErr } = await sb
        .from('reservations')
        .update({ status: 'checked_out' })
        .eq('id', reservationId);
      if (resErr) throw resErr;

      // 2. Update room status -> dirty (needs housekeeping)
      const { error: roomErr } = await sb
        .from('rooms')
        .update({ status: 'dirty' })
        .eq('id', roomId);
      if (roomErr) throw roomErr;

      // 3. Log room status change
      await sb
        .from('room_status_history')
        .insert({ room_id: roomId, status: 'dirty', notes: 'Guest checked out' });

      // 4. Create housekeeping task
      const today = new Date().toISOString().split('T')[0];
      await sb
        .from('housekeeping_tasks')
        .insert({ room_id: roomId, shift_date: today, status: 'pending' });

      return { reservationId, roomId };
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
        .insert({ room_id: data.room_id, status: 'occupied', notes: 'Walk-in guest checked in' });

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
