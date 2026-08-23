import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Calendar, Clock, Users, Monitor, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function ConferenceBooking() {
  const { user } = useAuth();
  const [step, setStep] = useState<'select' | 'details' | 'payment' | 'confirm'>('select');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('2');
  const [attendeeCount, setAttendeeCount] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        sb.from('conference_rooms').select('*').eq('is_active', true).order('hourly_rate'),
        sb.from('conference_bookings').select('*').in('status', ['confirmed', 'checked_in']),
      ]);
      setRooms(roomsRes.data || []);
      setExistingBookings(bookingsRes.data || []);
      if (user?.email) setGuestName(user.email.split('@')[0]);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Check availability for selected room, date, and time
  const isAvailable = (roomId: string, date: string, start: string, dur: number): boolean => {
    if (!date) return true;
    const startH = parseInt(start.split(':')[0]);
    const endH = startH + dur;

    return !existingBookings.some((b: any) => {
      if (b.conference_room_id !== roomId || b.booking_date !== date) return false;
      const bStart = parseInt(b.start_time.split(':')[0]);
      const bEnd = bStart + b.duration_hours;
      return startH < bEnd && endH > bStart;
    });
  };

  const totalCost = selectedRoom ? Number(selectedRoom.hourly_rate) * parseInt(duration) : 0;
  const dailyCost = selectedRoom?.daily_rate ? Number(selectedRoom.daily_rate) : null;
  const isFullDay = parseInt(duration) >= 8;

  const handleBook = async () => {
    if (!selectedRoom || !bookingDate || !startTime) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!isAvailable(selectedRoom.id, bookingDate, startTime, parseInt(duration))) {
      toast.error('This room is not available for the selected time');
      return;
    }
    setSubmitting(true);
    try {
      const amount = isFullDay && dailyCost ? dailyCost : totalCost;
      const { error } = await sb.from('conference_bookings').insert({
        conference_room_id: selectedRoom.id,
        booking_date: bookingDate,
        start_time: startTime,
        duration_hours: parseInt(duration),
        total_amount: amount,
        attendee_count: parseInt(attendeeCount) || 0,
        special_requests: specialRequests || null,
        status: 'confirmed',
        payment_type: 'pay_on_arrival',
      });
      if (error) throw error;
      toast.success('Conference room booked!');
      setStep('confirm');
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-navy text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/guest"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="font-display text-xl font-bold">Book Conference Room</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {step === 'select' && (
          <>
            <div className="grid gap-3">
              {rooms.map((room: any) => {
                const available = isAvailable(room.id, bookingDate || new Date().toISOString().split('T')[0], startTime, parseInt(duration));
                return (
                  <Card
                    key={room.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${selectedRoom?.id === room.id ? 'border-2 border-brass shadow-md' : 'border'}`}
                    onClick={() => { setSelectedRoom(room); setStep('details'); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{room.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {room.capacity} pax</span>
                            <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {room.equipment?.join(', ')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(room.hourly_rate)}/hr</p>
                          {room.daily_rate && <p className="text-xs text-muted-foreground">Day: {formatCurrency(room.daily_rate)}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {step === 'details' && selectedRoom && (
          <>
            <Card className="border-brass">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{selectedRoom.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedRoom.capacity} pax · {formatCurrency(selectedRoom.hourly_rate)}/hr</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep('select')}>Change</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Booking Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Time *</Label>
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 Hours</SelectItem>
                        <SelectItem value="4">4 Hours</SelectItem>
                        <SelectItem value="6">6 Hours</SelectItem>
                        <SelectItem value="8">Full Day (8h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Attendees</Label>
                    <Input type="number" min={1} max={selectedRoom.capacity} value={attendeeCount} onChange={e => setAttendeeCount(e.target.value)} placeholder={`Max ${selectedRoom.capacity}`} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="0712345678" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  <Input value={guestName} onChange={e => setGuestName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Special Requests</Label>
                  <Input value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="e.g., projector needed, catering" />
                </div>

                {/* Availability Check */}
                {bookingDate && !isAvailable(selectedRoom.id, bookingDate, startTime, parseInt(duration)) && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-700">Room is booked for this time slot. Please pick another.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Summary */}
            {bookingDate && isAvailable(selectedRoom.id, bookingDate, startTime, parseInt(duration)) && (
              <Card className="border-brass">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-xl font-bold">{formatCurrency(isFullDay && dailyCost ? dailyCost : totalCost)}</p>
                      <p className="text-xs text-muted-foreground">{duration}h × {formatCurrency(selectedRoom.hourly_rate)}/hr</p>
                    </div>
                    <Button variant="brass" onClick={() => setStep('payment')}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {step === 'payment' && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Confirm & Pay</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">{selectedRoom?.name} · {bookingDate} · {startTime} ({duration}h)</p>
                <p className="text-lg font-bold">{formatCurrency(isFullDay && dailyCost ? dailyCost : totalCost)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-800">📱 M-Pesa Payment</p>
                <p className="text-xs text-blue-600 mt-1">Pay at reception or via M-Pesa. Your booking will be confirmed after payment.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('details')}>Back</Button>
                <Button variant="brass" className="flex-1" onClick={handleBook} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Confirm Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'confirm' && (
          <Card className="text-center">
            <CardContent className="p-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Conference Booked!</h2>
              <p className="text-muted-foreground mb-6">{selectedRoom?.name} · {bookingDate} · {startTime} ({duration}h)</p>
              <Link to="/guest"><Button variant="brass">Go to Dashboard</Button></Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
