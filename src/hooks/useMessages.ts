import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ===== Get channels for current user =====
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return [];

      const { data, error } = await sb
        .from('channel_members')
        .select('channel_id, role, last_read_at, message_channels(id, name, type, description)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || [])
        .filter((m: any) => m.message_channels)
        .map((m: any) => ({
          ...m.message_channels,
          myRole: m.role,
          lastReadAt: m.last_read_at,
        }));
    },
  });
}

// ===== Get messages for a channel =====
export function useChannelMessages(channelId?: string) {
  return useQuery({
    queryKey: ['messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data, error } = await sb
        .from('messages')
        .select('*, sender:sender_id(full_name, email, role)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    enabled: !!channelId,
    refetchInterval: 5000, // Poll every 5s as fallback
  });
}

// ===== Send a message =====
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, content, replyTo }: {
      channelId: string;
      content: string;
      replyTo?: string;
    }) => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await sb
        .from('messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content,
          reply_to: replyTo || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['messages', variables.channelId] });
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ===== Mark channel as read =====
export function useMarkChannelRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const { error } = await sb
        .from('channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ===== Get unread count for a channel =====
export function useUnreadCount(channelId?: string) {
  return useQuery({
    queryKey: ['unread', channelId],
    queryFn: async () => {
      if (!channelId) return 0;

      const { data: { user } } = await sb.auth.getUser();
      if (!user) return 0;

      // Get last read time
      const { data: member } = await sb
        .from('channel_members')
        .select('last_read_at')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();

      if (!member) return 0;

      // Count messages after last read
      const { count, error } = await sb
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .neq('sender_id', user.id)
        .gt('created_at', member.last_read_at);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!channelId,
    refetchInterval: 10000,
  });
}

// ===== Real-time subscription for messages =====
export function useRealtimeMessages(channelId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['messages', channelId] });
          qc.invalidateQueries({ queryKey: ['channels'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, qc]);
}

// ===== Create a DM channel =====
export function useCreateDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if DM already exists
      const { data: existingDM } = await sb
        .from('message_channels')
        .select('id, channel_members!inner(user_id)')
        .eq('type', 'direct')
        .filter('channel_members.user_id', 'in', `(${user.id},${otherUserId})`);

      // Find a DM that includes both users
      if (existingDM) {
        for (const ch of existingDM) {
          const memberIds = ch.channel_members?.map((m: any) => m.user_id) || [];
          if (memberIds.includes(user.id) && memberIds.includes(otherUserId)) {
            return ch.id;
          }
        }
      }

      // Create new DM channel
      const { data: channel, error: chError } = await sb
        .from('message_channels')
        .insert({
          name: 'direct',
          type: 'direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (chError) throw chError;

      // Add both members
      await sb.from('channel_members').insert([
        { channel_id: channel.id, user_id: user.id, role: 'owner' },
        { channel_id: channel.id, user_id: otherUserId, role: 'member' },
      ]);

      return channel.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
