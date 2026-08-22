import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useChannels, useChannelMessages, useSendMessage,
  useMarkChannelRead, useUnreadCount, useRealtimeMessages,
  useCreateDM
} from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import {
  MessageSquare, Hash, Send, Users, Circle, Search,
  ChevronDown, Plus, User, AtSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

function getChannelIcon(type: string, name: string) {
  if (type === 'direct') return <User className="h-4 w-4" />;
  const icons: Record<string, any> = {
    general: MessageSquare,
    reception: AtSign,
    kitchen: Hash,
    housekeeping: Hash,
    payments: Hash,
  };
  const Icon = icons[name] || Hash;
  return <Icon className="h-4 w-4" />;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  receptionist: 'bg-green-100 text-green-700',
  chef: 'bg-orange-100 text-orange-700',
  waiter: 'bg-purple-100 text-purple-700',
  housekeeper: 'bg-amber-100 text-amber-700',
  accountant: 'bg-cyan-100 text-cyan-700',
};

export default function MessageCenter() {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels } = useChannels();
  const { data: messages } = useChannelMessages(selectedChannel || undefined);
  const { data: unreadCounts } = useUnreadCounts();
  const sendMessage = useSendMessage();
  const markRead = useMarkChannelRead();
  const createDM = useCreateDM();

  // Get all staff for DM creation
  const { data: allStaff } = useQuery({
    queryKey: ['staff-for-dm'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .neq('id', user?.id)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: showNewDM,
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels, selectedChannel]);

  // Mark as read when selecting a channel
  useEffect(() => {
    if (selectedChannel) {
      markRead.mutate(selectedChannel);
      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedChannel, messages]);

  // Real-time subscription
  useRealtimeMessages(selectedChannel);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedChannel) return;
    const content = messageText.trim();
    setMessageText('');
    try {
      await sendMessage.mutateAsync({ channelId: selectedChannel, content });
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  const handleCreateDM = async (staffId: string) => {
    try {
      const channelId = await createDM.mutateAsync(staffId);
      setSelectedChannel(channelId);
      setShowNewDM(false);
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  const selectedChannelData = channels?.find((c: any) => c.id === selectedChannel);

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      <div className="flex h-full gap-0 rounded-lg border overflow-hidden">
        {/* Sidebar — Channels */}
        <div className="w-64 bg-white border-r flex flex-col shrink-0">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold">Messages</h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowNewDM(!showNewDM)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* New DM panel */}
          {showNewDM && (
            <div className="p-3 border-b bg-muted/30 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Start a conversation</p>
              {allStaff?.map((s: any) => (
                <button
                  key={s.id}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                  onClick={() => handleCreateDM(s.id)}
                >
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                    {(s.full_name || s.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{s.full_name || s.email}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Channel list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                Channels
              </p>
              {channels?.filter((c: any) => c.type === 'group').map((ch: any) => {
                const unread = unreadCounts?.[ch.id] || 0;
                return (
                  <button
                    key={ch.id}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                      selectedChannel === ch.id
                        ? 'bg-brass/10 text-brass font-medium'
                        : 'hover:bg-muted text-foreground'
                    )}
                    onClick={() => setSelectedChannel(ch.id)}
                  >
                    <span className="text-muted-foreground">
                      {getChannelIcon(ch.type, ch.name)}
                    </span>
                    <span className="flex-1 text-sm truncate">{ch.name}</span>
                    {unread > 0 && (
                      <Badge className="h-5 min-w-5 text-[10px] bg-red-500 text-white px-1">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-2 border-t">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                Direct Messages
              </p>
              {channels?.filter((c: any) => c.type === 'direct').map((ch: any) => {
                const unread = unreadCounts?.[ch.id] || 0;
                return (
                  <button
                    key={ch.id}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                      selectedChannel === ch.id
                        ? 'bg-brass/10 text-brass font-medium'
                        : 'hover:bg-muted text-foreground'
                    )}
                    onClick={() => setSelectedChannel(ch.id)}
                  >
                    <span className="text-muted-foreground">
                      <User className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm truncate">{ch.name}</span>
                    {unread > 0 && (
                      <Badge className="h-5 min-w-5 text-[10px] bg-red-500 text-white px-1">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
              {channels?.filter((c: any) => c.type === 'direct').length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  No direct messages yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedChannel ? (
            <>
              {/* Channel header */}
              <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {getChannelIcon(selectedChannelData?.type || 'group', selectedChannelData?.name || '')}
                  </span>
                  <h3 className="font-semibold">{selectedChannelData?.name}</h3>
                  {selectedChannelData?.description && (
                    <span className="text-xs text-muted-foreground">· {selectedChannelData.description}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMembers(!showMembers)}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.map((msg: any) => {
                  const isOwn = msg.sender_id === user?.id;
                  const senderName = msg.sender?.full_name || msg.sender?.email || 'Unknown';
                  const senderRole = msg.sender?.role || '';

                  return (
                    <div key={msg.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                        ROLE_COLORS[senderRole] || 'bg-gray-100 text-gray-700'
                      )}>
                        {senderName[0].toUpperCase()}
                      </div>
                      <div className={cn('max-w-[70%]', isOwn && 'text-right')}>
                        <div className="flex items-center gap-2 mb-1" style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                          <span className="text-xs font-semibold">{senderName}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">{senderRole}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatMessageTime(msg.created_at)}
                          </span>
                        </div>
                        <div className={cn(
                          'px-3 py-2 rounded-lg text-sm',
                          isOwn
                            ? 'bg-brass text-white rounded-tr-none'
                            : 'bg-muted rounded-tl-none'
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-4 border-t shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message #${selectedChannelData?.name || ''}...`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sendMessage.isPending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMessage.isPending}
                    variant="brass"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a channel to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {/* Members panel */}
        {showMembers && selectedChannel && (
          <ChannelMembersPanel channelId={selectedChannel} onClose={() => setShowMembers(false)} />
        )}
      </div>
    </div>
  );
}

function ChannelMembersPanel({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { data: members } = useQuery({
    queryKey: ['channel-members', channelId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('channel_members')
        .select('role, user:user_id(id, full_name, email, role)')
        .eq('channel_id', channelId);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="w-56 bg-white border-l flex flex-col shrink-0">
      <div className="p-3 border-b flex items-center justify-between">
        <p className="text-xs font-semibold">Members</p>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          ×
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {members?.map((m: any) => (
          <div key={m.user?.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
            <div className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
              ROLE_COLORS[m.user?.role] || 'bg-gray-100 text-gray-700'
            )}>
              {(m.user?.full_name || m.user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium">{m.user?.full_name || m.user?.email}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{m.user?.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper hook to get unread counts for all channels
function useUnreadCounts() {
  const { data: channels } = useChannels();
  const { data: { user } } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await sb.auth.getUser();
      return data;
    },
  });

  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!channels || !user) return;

    const fetchCounts = async () => {
      const newCounts: Record<string, number> = {};
      for (const ch of channels) {
        try {
          const { data: member } = await sb
            .from('channel_members')
            .select('last_read_at')
            .eq('channel_id', ch.id)
            .eq('user_id', user.id)
            .single();

          if (member) {
            const { count } = await sb
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('channel_id', ch.id)
              .neq('sender_id', user.id)
              .gt('created_at', member.last_read_at);

            newCounts[ch.id] = count || 0;
          }
        } catch {
          // Skip errors
        }
      }
      setCounts(newCounts);
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [channels, user]);

  return { data: counts };
}
