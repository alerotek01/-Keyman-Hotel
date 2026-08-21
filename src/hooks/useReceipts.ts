import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Receipt } from '@/lib/types';

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from('receipts' as any)
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
      return (data || []) as unknown as Receipt[];
    },
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (receiptData: {
      booking_id: string;
      file: File;
      notes?: string;
    }) => {
      // Upload file to storage
      const fileName = `${receiptData.booking_id}/${Date.now()}_${receiptData.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptData.file);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create receipt record
      const { data: result, error } = await supabase
        .from('receipts' as any)
        .insert({
          booking_id: receiptData.booking_id,
          receipt_url: urlData.publicUrl,
          uploaded_by: user?.id || null,
          notes: receiptData.notes || null,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}
