import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/@typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: 'rooms' | 'kitchen' | 'both';
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ===== List all discount codes (manager/admin) =====
export function useDiscountCodes() {
  return useQuery({
    queryKey: ['discount-codes'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== List active discount codes (staff/guest) =====
export function useActiveDiscountCodes() {
  return useQuery({
    queryKey: ['discount-codes', 'active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await sb
        .from('discount_codes')
        .select('id, code, description, discount_type, discount_value, applies_to')
        .eq('is_active', true)
        .lte('valid_from', now)
        .or(`valid_until.is.null,valid_until.gte.${now}`);
      if (error) throw error;
      return data || [];
    },
  });
}

// ===== Create discount code =====
export function useCreateDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<DiscountCode, 'id' | 'used_count' | 'created_at'>) => {
      const { data: result, error } = await sb
        .from('discount_codes')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  });
}

// ===== Update discount code =====
export function useUpdateDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<DiscountCode>) => {
      const { data: result, error } = await sb
        .from('discount_codes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  });
}

// ===== Delete discount code =====
export function useDeleteDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  });
}

// ===== Validate a discount code =====
export function useValidateDiscount() {
  return useMutation({
    mutationFn: async ({ code, appliesTo, amount }: { code: string; appliesTo: string; amount: number }) => {
      const { data, error } = await sb.rpc('validate_discount_code', {
        p_code: code,
        p_applies_to: appliesTo,
        p_amount: amount,
      });
      if (error) throw error;
      return data as {
        valid: boolean;
        error?: string;
        discount_code_id?: string;
        code?: string;
        discount_type?: string;
        discount_value?: number;
        discount_amount?: number;
        original_amount?: number;
        final_amount?: number;
      };
    },
  });
}

// ===== Apply a discount code (increment usage) =====
export function useApplyDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await sb.rpc('apply_discount_code', { p_code: code });
      if (error) throw error;
      return data as { success: boolean; error?: string; discount_code_id?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  });
}
