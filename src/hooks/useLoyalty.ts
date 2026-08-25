import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoyaltySettings {
  enabled: boolean;
  points_value_kes: number;
  earn_rate: number;
  direct_booking_bonus: number;
  restaurant_earn_rate: number;
  review_bonus: number;
  birthday_multiplier: number;
  returning_guest_multiplier: number;
  referral_bonus_points: number;
  referral_discount_percent: number;
  tier_regular_threshold: number;
  tier_vip_threshold: number;
  tier_regular_multiplier: number;
  tier_vip_multiplier: number;
  points_expiry_months: number;
}

export function useLoyaltySettings() {
  return useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: async (): Promise<LoyaltySettings> => {
      const { data, error } = await supabase.rpc('get_loyalty_settings');
      if (error) throw error;
      const s = data?.[0];
      if (!s) throw new Error('No loyalty settings found');
      return {
        enabled: s.enabled ?? true,
        points_value_kes: s.points_value_kes ?? 0.20,
        earn_rate: s.earn_rate ?? 10,
        direct_booking_bonus: s.direct_booking_bonus ?? 50,
        restaurant_earn_rate: s.restaurant_earn_rate ?? 20,
        review_bonus: s.review_bonus ?? 100,
        birthday_multiplier: s.birthday_multiplier ?? 2,
        returning_guest_multiplier: s.returning_guest_multiplier ?? 1.5,
        referral_bonus_points: s.referral_bonus_points ?? 200,
        referral_discount_percent: s.referral_discount_percent ?? 15,
        tier_regular_threshold: s.tier_regular_threshold ?? 500,
        tier_vip_threshold: s.tier_vip_threshold ?? 2500,
        tier_regular_multiplier: s.tier_regular_multiplier ?? 1.1,
        tier_vip_multiplier: s.tier_vip_multiplier ?? 1.3,
        points_expiry_months: s.points_expiry_months ?? 12,
      };
    },
  });
}

export function useUpdateLoyaltySetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.rpc('update_loyalty_setting', {
        p_key: key,
        p_value: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-settings'] });
    },
  });
}

export function useGuestLoyalty(guestId?: string) {
  return useQuery({
    queryKey: ['guest-loyalty', guestId],
    queryFn: async () => {
      if (!guestId) return null;
      const { data, error } = await supabase
        .from('guests')
        .select('id, name, email, loyalty_points_balance, loyalty_tier, referral_code, total_stays, total_spent')
        .eq('id', guestId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!guestId,
  });
}

export function useGuestLoyaltyHistory(guestId?: string) {
  return useQuery({
    queryKey: ['loyalty-history', guestId],
    queryFn: async () => {
      if (!guestId) return [];
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!guestId,
  });
}

export function useAllGuestsLoyalty() {
  return useQuery({
    queryKey: ['all-guests-loyalty'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('id, name, email, loyalty_points_balance, loyalty_tier, referral_code, total_stays, total_spent')
        .order('loyalty_points_balance', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
