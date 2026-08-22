import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Receipts = payments (for hotel charges) + folio_transactions (for restaurant charges) =====
export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      // Combine payments and folio transactions as "receipts"
      const [paymentsRes, transactionsRes] = await Promise.all([
        sb
          .from('payments')
          .select('*, folio_id, order_id, recorded_by, verified_by')
          .order('created_at', { ascending: false }),
        sb
          .from('folio_transactions')
          .select('*, guest_folios(reservation_id, guests(name, email))')
          .order('created_at', { ascending: false }),
      ]);

      const payments = (paymentsRes.data || []).map((p: any) => ({
        id: p.id,
        type: 'payment',
        amount: p.amount,
        method: p.method,
        status: p.status,
        reference: p.mpesa_transaction_id || null,
        receipt_url: p.receipt_image_url || null,
        created_at: p.created_at,
        folio_id: p.folio_id,
      }));

      const transactions = (transactionsRes.data || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        created_at: t.created_at,
        guest_name: t.guest_folios?.guests?.name || null,
      }));

      return { payments, transactions };
    },
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptData: {
      payment_id: string;
      file: File;
    }) => {
      // Upload file to storage
      const fileName = `receipts/${receiptData.payment_id}/${Date.now()}_${receiptData.file.name}`;
      const { error: uploadError } = await sb.storage
        .from('rooms')
        .upload(fileName, receiptData.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = sb.storage
        .from('rooms')
        .getPublicUrl(fileName);

      // Update payment with receipt URL
      const { data: result, error } = await sb
        .from('payments')
        .update({ receipt_image_url: urlData.publicUrl })
        .eq('id', receiptData.payment_id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
