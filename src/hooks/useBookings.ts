import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Booking, BookingFormData, BookingStatus } from '@/lib/types';
import { calculateBookingPrice } from '@/lib/utils';

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          rooms (*),
          customers (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Booking[];
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: BookingFormData) => {
      // First, create or get customer
      let customer;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select()
        .eq('email', formData.customer_email)
        .maybeSingle();
      
      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            full_name: formData.customer_name,
            email: formData.customer_email,
          })
          .select()
          .single();
        
        if (customerError) throw customerError;
        customer = newCustomer;
      }

      // Get room details for pricing
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('base_price, breakfast_price')
        .eq('id', formData.room_id)
        .single();
      
      if (roomError) throw roomError;

      // Calculate pricing
      const pricing = calculateBookingPrice(
        Number(room.base_price),
        Number(room.breakfast_price),
        formData.check_in,
        formData.check_out,
        formData.guests_count,
        formData.breakfast
      );

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          room_id: formData.room_id,
          customer_id: customer.id,
          check_in: formData.check_in.toISOString().split('T')[0],
          check_out: formData.check_out.toISOString().split('T')[0],
          guests_count: formData.guests_count,
          breakfast: formData.breakfast,
          vehicle: formData.vehicle,
          base_price: pricing.base_cost,
          extras_price: pricing.breakfast_cost,
          total_amount: pricing.total,
          status: 'Pending',
        })
        .select()
        .single();
      
      if (bookingError) throw bookingError;
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
