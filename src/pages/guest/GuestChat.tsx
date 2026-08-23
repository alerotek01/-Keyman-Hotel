import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Send, Hash, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const CHANNEL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  reception: { label: 'Reception', icon: '🔑', color: 'bg-blue-100 text-blue-800' },
  cafe: { label: 'Cafeteria', icon: '🍽️', color: 'bg-orange-100 text-orange-800' },
  house: { label: 'Housekeeping', icon: '🧹', color: 'bg-green-100 text-green-800' },
};

export default function GuestChat() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadChannels();
  }, [user]);

  useEffect(() => {
    if (!selectedChannel) return;
    loadMessages();
    const sub = supabase
      .channel(`guest-msg-${selectedChannel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${selectedChannel}` }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const { data } = await sb
        .from('channel_members')
        .select('channel_id, message_channels(id, name, type, description)')
        .eq('user_id', user?.id);
      const chs = (data || []).filter((m: any) => m.message_channels && (m.message_channels?.name?.includes('guest') || m.message_channels?.name?.includes('reception')));
      setChannels(chs.map((m: any) => m.message_channels));
      if (chs.length > 0 && !selectedChannel) setSelectedChannel(chs[0].message_channels.id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadMessages = async () => {
    if (!selectedChannel) return;
    const { data } = await sb
      .from('messages')
      .select('*, sender:sender_id(full_name, role)')
      .eq('channel_id', selectedChannel)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedChannel) return;
    const content = messageText.trim();
    setMessageText('');
    try {
      await sb.from('messages').insert({
        channel_id: selectedChannel,
        sender_id: user?.id,
        content,
        message_type: 'text',
      });
    } catch (e) { console.error(e); }
  };

  const getChannelConfig = (name: string) => {
    for (const [key, config] of Object.entries(CHANNEL_CONFIG)) {
      if (name.includes(key)) return config;
    }
    return { label: name, icon: '💬', color: 'bg-gray-100 text-gray-800' };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brass border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-navy text-white px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/guest"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="font-display text-xl font-bold">Messages</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {/* Channel Tabs */}
        <div className="flex gap-2 p-3 overflow-x-auto shrink-0">
          {channels.map(ch => {
            const cfg = getChannelConfig(ch.name);
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  selectedChannel === ch.id ? 'bg-brass text-white' : 'bg-white border hover:bg-muted'
                )}
              >
                <span>{cfg.icon}</span>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Start a conversation</p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isOwn = msg.sender_id === user?.id;
              const senderName = msg.sender?.full_name || 'Staff';
              return (
                <div key={msg.id} className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', isOwn ? 'bg-brass text-white' : 'bg-navy text-white')}>
                    {senderName[0]?.toUpperCase()}
                  </div>
                  <div className={cn('max-w-[75%]', isOwn && 'text-right')}>
                    <p className="text-[10px] text-muted-foreground mb-1">{senderName} · {format(new Date(msg.created_at), 'h:mm a')}</p>
                    <div className={cn('px-3 py-2 rounded-2xl text-sm', isOwn ? 'bg-brass text-white rounded-tr-none' : 'bg-white border rounded-tl-none')}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-white shrink-0">
          <div className="flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button onClick={handleSend} disabled={!messageText.trim()} variant="brass" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
