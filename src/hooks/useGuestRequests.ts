import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GuestRequest, RequestStatus, RequestType } from '@/lib/types';

export function useGuestRequests() {
  return useQuery({
    queryKey: ['guest-requests'],
    queryFn: async (): Promise<GuestRequest[]> => {
      const { data, error } = await supabase
        .from('guest_requests' as any)
        .select(`
          *,
          bookings (
            *,
            rooms (*),
            customers (*)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as GuestRequest[];
    },
  });
}

export function useCreateGuestRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (requestData: {
      booking_id: string;
      request_type: RequestType;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('guest_requests' as any)
        .insert({
          booking_id: requestData.booking_id,
          request_type: requestData.request_type,
          description: requestData.description || null,
        } as any)
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
      
      const { data, error } = await supabase
        .from('guest_requests' as any)
        .update(updates as any)
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
