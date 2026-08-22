import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface NotificationPreferences {
  id: string;
  user_id: string;
  new_booking: boolean;
  check_in: boolean;
  check_out: boolean;
  housekeeping: boolean;
  restaurant_order: boolean;
  payment_received: boolean;
  guest_request: boolean;
  system_announcement: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFS: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  new_booking: true,
  check_in: true,
  check_out: true,
  housekeeping: true,
  restaurant_order: true,
  payment_received: true,
  guest_request: true,
  system_announcement: true,
};

export const NOTIFICATION_EVENTS = [
  { key: 'new_booking', label: 'New Booking', description: 'When a guest books a room (online or walk-in)', icon: 'calendar' },
  { key: 'check_in', label: 'Guest Check-In', description: 'When a guest checks into their room', icon: 'log-in' },
  { key: 'check_out', label: 'Guest Check-Out', description: 'When a guest checks out', icon: 'log-out' },
  { key: 'housekeeping', label: 'Housekeeping Tasks', description: 'New or updated room cleaning requests', icon: 'sparkles' },
  { key: 'restaurant_order', label: 'Restaurant Orders', description: 'New food orders placed by guests', icon: 'utensils' },
  { key: 'payment_received', label: 'Payments', description: 'When a payment is recorded on a folio', icon: 'credit-card' },
  { key: 'guest_request', label: 'Guest Requests', description: 'Service requests from guests (maintenance, concierge)', icon: 'clipboard' },
  { key: 'system_announcement', label: 'System Announcements', description: 'General admin announcements and alerts', icon: 'bell' },
] as const;

export function useNotificationPreferences() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;

      const { data, error } = await sb
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If no preferences exist, create defaults
      if (!data) {
        const { data: created, error: createError } = await sb
          .from('notification_preferences')
          .insert({ user_id: user.id, ...DEFAULT_PREFS })
          .select()
          .single();

        if (createError) throw createError;
        return created as NotificationPreferences;
      }

      return data as NotificationPreferences;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await sb
        .from('notification_preferences')
        .update({ ...prefs, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}
