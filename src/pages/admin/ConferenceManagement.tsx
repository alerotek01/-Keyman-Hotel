import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { sendEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Clock, Users, CheckCircle2, XCircle, Plus, Trash2, Send, Building2, Mail, Phone, FileText } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const AMENITY_LABELS: Record<string, string> = {
  projector: '📽️ Projector & Screen', whiteboard: '📝 Whiteboard / Flipchart', microphone: '🎤 Microphone & PA',
  wifi: '📶 Wi-Fi', notepads: '📋 Notepads & Pens', water: '💧 Water & Refreshments',
  name_tags: '🏷️ Name Tags', live_stream: '📹 Live Streaming', recording: '🎥 Recording', stage: '🎤 Stage / Podium',
};
const CATERING_LABELS: Record<string, string> = {
  tea_coffee: '☕ Tea & Coffee', breakfast_only: '🥐 Breakfast', breakfast_lunch: '🍽️ Breakfast & Lunch',
  lunch_only: '🥗 Lunch Only', full_day_catering: '🍽️ Full Day Catering', half_day_catering: '🍽️ Half Day',
  evening_cocktail: '🥂 Evening Cocktail', baked_goods: '🥐 Pastries & Baked Goods',
};
const EVENT_LABELS: Record<string, string> = {
  meeting: 'Business Meeting', workshop: 'Workshop', conference: 'Conference',
  corporate_event: 'Corporate Event', product_launch: 'Product Launch', interview: 'Interview',
  celebration: 'Celebration', other: 'Other',
};

export default function ConferenceManagement() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [quoteModal, setQuoteModal] = useState<any>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: '', hourly_rate: '', daily_rate: '', description: '', equipment: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        sb.from('conference_bookings').select('*, room:conference_rooms(name, capacity, hourly_rate, equipment)').order('created_at', { ascending: false }),
        sb.from('conference_rooms').select('*').order('hourly_rate'),
      ]);
      setBookings(bookingsRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await sb.from('conference_bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      toast.success(`Booking ${status}`);
      await loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const submitQuote = async () => {
    if (!quoteModal || !quoteAmount) { toast.error('Enter quote amount'); return; }
    setQuoting(true);
    try {
      await sb.from('conference_bookings').update({
        quote_status: 'quoted',
        quoted_amount: parseFloat(quoteAmount),
        quote_notes: quoteNotes || null,
        quoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', quoteModal.id);

      // Send quote email to client
      if (quoteModal.contact_email) {
        try {
          await sendEmail({
            to: quoteModal.contact_email,
            subject: `🏢 Your Conference Quote — Keyman Hotel`,
            html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
              <h2 style="color:#1a2744;">Your Conference Quote</h2>
              <p>Dear ${quoteModal.contact_name},</p>
              <p>Thank you for your conference request. Here is our official quote:</p>
              <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
                <p><strong>Venue:</strong> ${quoteModal.room?.name}</p>
                <p><strong>Date:</strong> ${quoteModal.booking_date}</p>
                <p><strong>Time:</strong> ${quoteModal.start_time?.slice(0, 5)} (${quoteModal.duration_hours}h)</p>
                <p><strong>Guests:</strong> ${quoteModal.guest_count}</p>
                <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;">
                <p style="font-size:20px;font-weight:bold;color:#1a2744;">Total: KES ${parseFloat(quoteAmount).toLocaleString()}</p>
              </div>
              ${quoteNotes ? `<p><strong>Notes:</strong> ${quoteNotes}</p>` : ''}
              <p>To proceed, please confirm and make payment via M-Pesa or at reception.</p>
              <p>Best regards,<br><strong>Keyman Hotel Events Team</strong></p>
            </div>`,
          });
        } catch (e) { console.error('Quote email failed:', e); }
      }

      toast.success('Quote sent to client!');
      setQuoteModal(null);
      setQuoteAmount('');
      setQuoteNotes('');
      await loadData();
    } catch (err: any) { toast.error(err.message); }
    setQuoting(false);
  };

  const addRoom = async () => {
    if (!newRoom.name || !newRoom.capacity) { toast.error('Name and capacity required'); return; }
    try {
      await sb.from('conference_rooms').insert({
        name: newRoom.name, capacity: parseInt(newRoom.capacity),
        hourly_rate: newRoom.hourly_rate ? parseInt(newRoom.hourly_rate) : 0,
        daily_rate: newRoom.daily_rate ? parseInt(newRoom.daily_rate) : null,
        description: newRoom.description || null,
        equipment: newRoom.equipment ? newRoom.equipment.split(',').map(e => e.trim()) : [],
        is_active: true,
      });
      toast.success('Room added');
      setNewRoom({ name: '', capacity: '', hourly_rate: '', daily_rate: '', description: '', equipment: '' });
      setShowAddRoom(false);
      await loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteRoom = async (id: string) => {
    if (!confirm('Delete this conference room?')) return;
    try {
      await sb.from('conference_rooms').delete().eq('id', id);
      toast.success('Room deleted');
      await loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleRoomActive = async (id: string, current: boolean) => {
    await sb.from('conference_rooms').update({ is_active: !current }).eq('id', id);
    await loadData();
  };

  const filtered = bookings.filter((b: any) => {
    if (filter === 'all') return true;
    if (filter === 'pending_quote') return b.quote_status === 'pending';
    return b.status === filter;
  });

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="space-y-6">
      {/* Quote Modal */}
      {quoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-brass" /> Send Quote — {quoteModal.room?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p><strong>Contact:</strong> {quoteModal.contact_name} {quoteModal.company_name && `(${quoteModal.company_name})`}</p>
                <p><strong>Date:</strong> {quoteModal.booking_date} · {quoteModal.start_time?.slice(0, 5)} ({quoteModal.duration_hours}h)</p>
                <p><strong>Guests:</strong> {quoteModal.guest_count}</p>
                {quoteModal.amenities?.length > 0 && <p><strong>Amenities:</strong> {quoteModal.amenities.join(', ')}</p>}
                {quoteModal.catering?.length > 0 && <p><strong>Catering:</strong> {quoteModal.catering.join(', ')}</p>}
              </div>
              <div className="space-y-2">
                <Label>Quote Amount (KES) *</Label>
                <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} placeholder="e.g., 45000" />
              </div>
              <div className="space-y-2">
                <Label>Notes to Client</Label>
                <Textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} placeholder="Payment terms, validity, included services..." rows={3} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setQuoteModal(null)}>Cancel</Button>
                <Button variant="brass" className="flex-1" onClick={submitQuote} disabled={quoting || !quoteAmount}>
                  {quoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Quote ({quoteAmount ? formatCurrency(parseFloat(quoteAmount)) : '—'})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Conference & Events</h1>
        <Button variant="brass" size="sm" onClick={() => setShowAddRoom(!showAddRoom)}>
          <Plus className="h-4 w-4 mr-1" /> {showAddRoom ? 'Cancel' : 'Add Room'}
        </Button>
      </div>

      {/* Add Room Form */}
      {showAddRoom && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Add Conference Room</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Room Name *</Label><Input value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Capacity *</Label><Input type="number" value={newRoom.capacity} onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Hourly Rate (KES)</Label><Input type="number" value={newRoom.hourly_rate} onChange={e => setNewRoom({ ...newRoom, hourly_rate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Daily Rate (KES)</Label><Input type="number" value={newRoom.daily_rate} onChange={e => setNewRoom({ ...newRoom, daily_rate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input value={newRoom.description} onChange={e => setNewRoom({ ...newRoom, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Equipment (comma separated)</Label><Input value={newRoom.equipment} onChange={e => setNewRoom({ ...newRoom, equipment: e.target.value })} placeholder="projector, whiteboard, wifi" /></div>
            <Button variant="brass" size="sm" onClick={addRoom}>Save Room</Button>
          </CardContent>
        </Card>
      )}

      {/* Rooms */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Venues ({rooms.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rooms.map((room: any) => (
            <div key={room.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{room.name}</p>
                  <Badge className={room.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}>{room.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{room.capacity} pax {room.hourly_rate > 0 ? `· ${formatCurrency(room.hourly_rate)}/hr` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggleRoomActive(room.id, room.is_active)}>{room.is_active ? 'Disable' : 'Enable'}</Button>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteRoom(room.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending_quote', label: '⏳ Pending Quote' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'checked_in', label: 'Checked In' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ].map(f => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} onClick={() => setFilter(f.value)}>{f.label}</Button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No conference bookings found</CardContent></Card>
        ) : filtered.map((b: any) => (
          <Card key={b.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{b.room?.name || 'Unknown'}</p>
                    <Badge className={
                      b.quote_status === 'quoted' ? 'bg-emerald-100 text-emerald-800' :
                      b.quote_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {b.quote_status === 'pending' ? '⏳ Quote Pending' : b.quote_status === 'quoted' ? '💰 Quoted' : b.quote_status}
                    </Badge>
                    <Badge className={
                      b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      b.status === 'checked_in' ? 'bg-blue-100 text-blue-800' :
                      b.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }>{b.status}</Badge>
                  </div>
                </div>
                {b.quoted_amount > 0 && (
                  <p className="text-lg font-bold text-brass">{formatCurrency(b.quoted_amount)}</p>
                )}
              </div>

              {/* Event Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {b.booking_date} · {b.start_time?.slice(0, 5)} ({b.duration_hours}h)</div>
                <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.guest_count} guests · {EVENT_LABELS[b.event_type] || b.event_type}</div>
                {b.contact_name && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {b.contact_name} {b.company_name && `(${b.company_name})`}</div>}
                {b.contact_phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.contact_phone}</div>}
              </div>

              {/* Amenities & Catering */}
              {b.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {b.amenities.map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{AMENITY_LABELS[a] || a}</Badge>)}
                </div>
              )}
              {b.catering?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {b.catering.map((c: string) => <Badge key={c} variant="secondary" className="text-[10px]">{CATERING_LABELS[c] || c}</Badge>)}
                </div>
              )}
              {b.special_requirements && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">📝 {b.special_requirements}</p>
              )}
              {b.quote_notes && (
                <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded">💬 {b.quote_notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {b.quote_status === 'pending' && (
                  <Button size="sm" variant="brass" onClick={() => { setQuoteModal(b); setQuoteAmount(''); setQuoteNotes(''); }}>
                    <Send className="h-3 w-3 mr-1" /> Send Quote
                  </Button>
                )}
                {b.quote_status === 'quoted' && b.status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, 'confirmed')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                  </Button>
                )}
                {b.status === 'confirmed' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, 'checked_in')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Check In
                  </Button>
                )}
                {b.status === 'checked_in' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, 'completed')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                  </Button>
                )}
                {b.status !== 'completed' && b.status !== 'cancelled' && (
                  <Button size="sm" variant="outline" className="text-red-500" onClick={() => updateStatus(b.id, 'cancelled')}>
                    <XCircle className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
