import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Calendar, Clock, Users, Monitor, CheckCircle2, XCircle, Plus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function ConferenceManagement() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: '', hourly_rate: '', daily_rate: '', description: '', equipment: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        sb.from('conference_bookings').select('*, room:conference_rooms(name, capacity, hourly_rate)').order('booking_date', { ascending: false }),
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
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteRoom = async (id: string) => {
    if (!confirm('Delete this conference room?')) return;
    try {
      await sb.from('conference_rooms').delete().eq('id', id);
      toast.success('Room deleted');
      await loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addRoom = async () => {
    if (!newRoom.name || !newRoom.capacity || !newRoom.hourly_rate) {
      toast.error('Name, capacity, and hourly rate required');
      return;
    }
    try {
      await sb.from('conference_rooms').insert({
        name: newRoom.name,
        capacity: parseInt(newRoom.capacity),
        hourly_rate: parseInt(newRoom.hourly_rate),
        daily_rate: newRoom.daily_rate ? parseInt(newRoom.daily_rate) : null,
        description: newRoom.description || null,
        equipment: newRoom.equipment ? newRoom.equipment.split(',').map(e => e.trim()) : [],
        is_active: true,
      });
      toast.success('Room added');
      setNewRoom({ name: '', capacity: '', hourly_rate: '', daily_rate: '', description: '', equipment: '' });
      setShowAddRoom(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleRoomActive = async (id: string, current: boolean) => {
    try {
      await sb.from('conference_rooms').update({ is_active: !current }).eq('id', id);
      await loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredBookings = bookings.filter((b: any) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Conference Bookings</h1>
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
              <div className="space-y-2"><Label>Hourly Rate (KES) *</Label><Input type="number" value={newRoom.hourly_rate} onChange={e => setNewRoom({ ...newRoom, hourly_rate: e.target.value })} /></div>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" /> Conference Rooms ({rooms.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rooms.map((room: any) => (
            <div key={room.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{room.name}</p>
                  <Badge className={room.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}>
                    {room.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {room.capacity} pax · {formatCurrency(room.hourly_rate)}/hr {room.daily_rate ? `· ${formatCurrency(room.daily_rate)}/day` : ''}
                </p>
                {room.equipment?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">📦 {room.equipment.join(', ')}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggleRoomActive(room.id, room.is_active)}>
                  {room.is_active ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteRoom(room.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bookings Filter */}
      <div className="flex gap-2">
        {['all', 'confirmed', 'checked_in', 'completed', 'cancelled'].map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="grid gap-3">
        {filteredBookings.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No conference bookings found</CardContent></Card>
        ) : filteredBookings.map((booking: any) => (
          <Card key={booking.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{booking.room?.name || 'Unknown Room'}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.booking_date} · {booking.start_time?.slice(0, 5)} ({booking.duration_hours}h)
                  </p>
                  {booking.attendee_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">👥 {booking.attendee_count} attendees</p>
                  )}
                  {booking.special_requests && (
                    <p className="text-xs text-muted-foreground mt-1">📝 {booking.special_requests}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge className={
                    booking.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    booking.status === 'checked_in' ? 'bg-blue-100 text-blue-800' :
                    booking.status === 'confirmed' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }>
                    {booking.status}
                  </Badge>
                  <p className="text-sm font-bold mt-1">{formatCurrency(booking.total_amount)}</p>
                </div>
              </div>
              {booking.status === 'confirmed' && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'checked_in')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Check In
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'cancelled')}>
                    <XCircle className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}
              {booking.status === 'checked_in' && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'completed')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
