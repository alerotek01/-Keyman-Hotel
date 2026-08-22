import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type?: string;
  related_id?: string;
  related_table?: string;
  read: boolean;
  created_at: string;
}

// ===== Fetch current user's notifications =====
export function useNotifications() {
  const qc = useQueryClient();
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data: { user } } = await sb.auth.getUser();
      return user;
    },
  });

  const query = useQuery({
    queryKey: ['notifications', authUser?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!authUser?.id) return [];
      const { data, error } = await sb
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id,
    refetchInterval: 30000, // Poll every 30s as fallback
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = sb
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['notifications', authUser.id] });
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [authUser?.id, qc]);

  const unreadCount = query.data?.filter((n) => !n.read).length || 0;

  return { ...query, unreadCount };
}

// ===== Mark notification as read =====
export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ===== Mark all as read =====
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await sb
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ===== Create notification (used by components) =====
export async function createNotification(params: {
  userId: string;
  title: string;
  message?: string;
  type?: string;
  relatedId?: string;
  relatedTable?: string;
}): Promise<void> {
  const { error } = await sb.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    message: params.message || null,
    type: params.type || 'info',
    related_id: params.relatedId || null,
    related_table: params.relatedTable || null,
    read: false,
  });
  if (error) throw error;
}

// ===== Get all staff user IDs (for broadcasting notifications) =====
export async function getAllStaffUserIds(): Promise<string[]> {
  const { data, error } = await sb
    .from('users')
    .select('id')
    .in('role', ['admin', 'receptionist', 'manager', 'chef', 'waiter', 'housekeeper', 'accountant']);
  if (error) throw error;
  return (data || []).map((u: { id: string }) => u.id);
}

// ===== Broadcast notification to all staff =====
export async function broadcastNotification(params: {
  title: string;
  message?: string;
  type?: string;
  relatedId?: string;
  relatedTable?: string;
}): Promise<void> {
  const userIds = await getAllStaffUserIds();
  if (userIds.length === 0) return;

  const inserts = userIds.map((userId) => ({
    user_id: userId,
    title: params.title,
    message: params.message || null,
    type: params.type || 'info',
    related_id: params.relatedId || null,
    related_table: params.relatedTable || null,
    read: false,
  }));

  const { error } = await sb.from('notifications').insert(inserts);
  if (error) throw error;
}
