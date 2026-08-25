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
        .eq('check_in_date', today)
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
        .eq('check_out_date', today)
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
        .in('status', ['available']);

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
      receiptFile,
    }: {
      reservationId: string;
      paymentMethod?: string;
      paymentAmount?: number;
      paymentReference?: string;
      receiptFile?: File | null;
    }) => {
      // Call safe DB function — validates reservation status, records payment, creates housekeeping task
      const { data: result, error } = await sb.rpc('check_out_guest_safe', {
        p_reservation_id: reservationId,
        p_payment_method: paymentMethod,
        p_payment_amount: paymentAmount,
        p_payment_reference: paymentReference || null,
      });
      if (error) throw error;

      // Upload receipt file if provided (after checkout succeeds)
      if (receiptFile && result) {
        try {
          // Find the payment record we just created via checkout
          const { data: payments } = await sb
            .from('folio_payments')
            .select('id')
            .eq('folio_id', result.folio_id || result)
            .order('created_at', { ascending: false })
            .limit(1);

          const paymentRecord = payments?.[0];
          if (paymentRecord) {
            const ext = receiptFile.name.split('.').pop() || 'jpg';
            const fileName = `receipts/checkout/${paymentRecord.id}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await sb.storage
              .from('rooms')
              .upload(fileName, receiptFile, { contentType: receiptFile.type });
            if (!uploadErr) {
              const { data: urlData } = sb.storage.from('rooms').getPublicUrl(fileName);
              await sb
                .from('folio_payments')
                .update({ receipt_image_url: urlData.publicUrl })
                .eq('id', paymentRecord.id);
            }
          }
        } catch (uploadErr) {
          console.warn('Receipt upload failed (payment still recorded):', uploadErr);
        }
      }

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptionist'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// ===== Walk-In Mutation (ATOMIC via DB function — all-or-nothing) =====
export function useWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      guest_name: string;
      guest_phone: string;
      guest_email?: string;
      room_type_id: string;
      num_adults: number;
      num_children: number;
      check_out: string;
      special_requests?: string;
      plate_number?: string;
    }) => {
      // Call atomic DB function — rate is ALWAYS calculated server-side from room_types.base_rate
      // Client does NOT send rate — prevents price manipulation
      const { data: result, error } = await sb.rpc('walk_in_guest', {
        p_guest_name: data.guest_name,
        p_room_type_id: data.room_type_id,
        p_check_in: new Date().toISOString().split('T')[0],
        p_check_out: data.check_out,
        p_guest_phone: data.guest_phone || null,
        p_guest_email: data.guest_email || null,
        p_num_adults: data.num_adults,
        p_num_children: data.num_children,
        p_plate_number: data.plate_number || null,
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
