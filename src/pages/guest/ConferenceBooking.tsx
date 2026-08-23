import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sendConferenceQuoteRequest, sendConferenceConfirmation } from '@/lib/email';
import { toast } from 'sonner';
import { Loader2, Calendar, Clock, Users, Building2, ArrowLeft, CheckCircle2, ClipboardList, Coffee, Monitor, Mic, Wifi, FileText } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// Hospitality-standard amenities checklist
const AMENITIES_OPTIONS = [
  { id: 'projector', label: 'Projector & Screen', icon: Monitor },
  { id: 'whiteboard', label: 'Whiteboard / Flipchart', icon: FileText },
  { id: 'microphone', label: 'Microphone & PA System', icon: Mic },
  { id: 'wifi', label: 'High-Speed Wi-Fi', icon: Wifi },
  { id: 'notepads', label: 'Notepads & Pens', icon: ClipboardList },
  { id: 'water', label: 'Water & Refreshments', icon: Coffee },
  { id: 'name_tags', label: 'Name Tags / Badges', icon: Users },
  { id: 'live_stream', label: 'Live Streaming / Video Conf', icon: Monitor },
  { id: 'recording', label: 'Session Recording', icon: Monitor },
  { id: 'stage', label: 'Stage / Podium', icon: Building2 },
];

const CATERING_OPTIONS = [
  { id: 'tea_coffee', label: 'Tea & Coffee Break' },
  { id: 'breakfast_only', label: 'Breakfast Only' },
  { id: 'breakfast_lunch', label: 'Breakfast & Lunch Buffet' },
  { id: 'lunch_only', label: 'Lunch Only' },
  { id: 'full_day_catering', label: 'Full Day Catering (B+L+Snacks)' },
  { id: 'half_day_catering', label: 'Half Day Catering (Tea + Lunch)' },
  { id: 'evening_cocktail', label: 'Evening Cocktail / Networking' },
  { id: 'baked_goods', label: 'Pastries & Baked Goods' },
];

const EVENT_TYPES = [
  { value: 'meeting', label: 'Business Meeting' },
  { value: 'workshop', label: 'Workshop / Training' },
  { value: 'conference', label: 'Conference / Seminar' },
  { value: 'corporate_event', label: 'Corporate Event' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'interview', label: 'Interview Panel' },
  { value: 'celebration', label: 'Celebration / Party' },
  { value: 'other', label: 'Other' },
];

export default function ConferenceBooking() {
  const { user } = useAuth();
  const [step, setStep] = useState<'details' | 'amenities' | 'review' | 'confirm'>('details');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    companyName: '',
    eventType: 'meeting',
    bookingDate: '',
    startTime: '09:00',
    duration: '4',
    guestCount: '',
    amenities: [] as string[],
    catering: [] as string[],
    specialRequirements: '',
    seatingLayout: 'boardroom',
  });

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const { data: roomsData } = await sb.from('conference_rooms').select('*').eq('is_active', true).order('capacity');
      setRooms(roomsData || []);
      if (user?.email) {
        setForm(f => ({ ...f, contactEmail: user.email || '' }));
      }
      // Try to pre-fill from guest record
      if (user?.id) {
        const { data: guest } = await sb.from('guests').select('name, email, phone').eq('user_id', user.id).single();
        if (guest) {
          setForm(f => ({
            ...f,
            contactName: guest.name || f.contactName,
            contactEmail: guest.email || f.contactEmail,
            contactPhone: guest.phone || f.contactPhone,
          }));
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateForm = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const toggleAmenity = (id: string) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(id) ? f.amenities.filter(a => a !== id) : [...f.amenities, id],
    }));
  };

  const toggleCatering = (id: string) => {
    setForm(f => ({
      ...f,
      catering: f.catering.includes(id) ? f.catering.filter(c => c !== id) : [...f.catering, id],
    }));
  };

  const selectedRoomData = rooms.find(r => r.id === selectedRoom);

  const handleSubmit = async () => {
    if (!selectedRoom || !form.bookingDate || !form.startTime || !form.contactName || !form.contactEmail) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await sb.from('conference_bookings').insert({
        conference_room_id: selectedRoom,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone || null,
        company_name: form.companyName || null,
        event_type: form.eventType,
        booking_date: form.bookingDate,
        start_time: form.startTime,
        duration_hours: parseInt(form.duration),
        guest_count: parseInt(form.guestCount) || 0,
        amenities: form.amenities,
        catering: form.catering,
        special_requirements: form.specialRequirements || null,
        status: 'pending',
        quote_status: 'pending',
        total_amount: 0,
      });
      if (error) throw error;

      // Send confirmation email to guest
      try {
        await sendConferenceConfirmation(form.contactEmail, {
          guestName: form.contactName,
          roomName: selectedRoomData?.name || '',
          date: form.bookingDate,
          time: form.startTime,
          duration: form.duration,
        });
      } catch (e) { console.error('Email failed:', e); }

      // Send quote request to manager
      try {
        await sendConferenceQuoteRequest({
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          companyName: form.companyName,
          roomName: selectedRoomData?.name || '',
          eventType: form.eventType,
          date: form.bookingDate,
          time: form.startTime,
          duration: form.duration,
          guestCount: form.guestCount,
          amenities: form.amenities,
          catering: form.catering,
          specialRequirements: form.specialRequirements,
        });
      } catch (e) { console.error('Manager email failed:', e); }

      toast.success('Conference request submitted! Manager will send you a quote.');
      setStep('confirm');
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-navy text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/guest"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="font-display text-xl font-bold">Conference & Events</h1>
            <p className="text-white/60 text-sm">Request a quote for your event</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {(['details', 'amenities', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-navy text-white' : i < ['details', 'amenities', 'review'].indexOf(step) ? 'bg-brass text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</div>
              <span className={`text-xs hidden sm:inline ${step === s ? 'font-semibold' : 'text-muted-foreground'}`}>
                {s === 'details' ? 'Details' : s === 'amenities' ? 'Amenities' : 'Review'}
              </span>
              {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Event Details */}
        {step === 'details' && (
          <>
            {/* Room Selection */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Select Venue</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {rooms.map((room: any) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedRoom === room.id ? 'border-brass bg-brass/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-sm">{room.name}</p>
                        <p className="text-xs text-muted-foreground">Capacity: {room.capacity} guests</p>
                        {room.equipment?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">📦 {room.equipment.join(', ')}</p>
                        )}
                      </div>
                      {selectedRoom === room.id && <CheckCircle2 className="h-5 w-5 text-brass" />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Contact & Event Info */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Event Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Contact Name *</Label><Input value={form.contactName} onChange={e => updateForm('contactName', e.target.value)} placeholder="Your name" /></div>
                  <div className="space-y-2"><Label>Company / Organization</Label><Input value={form.companyName} onChange={e => updateForm('companyName', e.target.value)} placeholder="e.g., Acme Corp" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.contactEmail} onChange={e => updateForm('contactEmail', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.contactPhone} onChange={e => updateForm('contactPhone', e.target.value)} placeholder="0712345678" /></div>
                </div>
                <div className="space-y-2">
                  <Label>Event Type *</Label>
                  <Select value={form.eventType} onValueChange={v => updateForm('eventType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Date *</Label><Input type="date" value={form.bookingDate} onChange={e => updateForm('bookingDate', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
                  <div className="space-y-2">
                    <Label>Start Time *</Label>
                    <Select value={form.startTime} onValueChange={v => updateForm('startTime', v)}>
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
                    <Select value={form.duration} onValueChange={v => updateForm('duration', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 Hours</SelectItem>
                        <SelectItem value="4">Half Day (4h)</SelectItem>
                        <SelectItem value="6">6 Hours</SelectItem>
                        <SelectItem value="8">Full Day (8h)</SelectItem>
                        <SelectItem value="multi">Multi-Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Expected Guests *</Label><Input type="number" min={1} max={selectedRoomData?.capacity || 200} value={form.guestCount} onChange={e => updateForm('guestCount', e.target.value)} placeholder={`Max ${selectedRoomData?.capacity || '—'}`} /></div>
                  <div className="space-y-2">
                    <Label>Seating Layout</Label>
                    <Select value={form.seatingLayout} onValueChange={v => updateForm('seatingLayout', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boardroom">Boardroom</SelectItem>
                        <SelectItem value="theatre">Theatre Style</SelectItem>
                        <SelectItem value="classroom">Classroom</SelectItem>
                        <SelectItem value="u_shape">U-Shape</SelectItem>
                        <SelectItem value="cabaret">Cabaret Rounds</SelectItem>
                        <SelectItem value="banquet">Banquet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button variant="brass" onClick={() => setStep('amenities')} disabled={!selectedRoom || !form.bookingDate || !form.contactName}>
                Next: Amenities & Catering →
              </Button>
            </div>
          </>
        )}

        {/* STEP 2: Amenities & Catering */}
        {step === 'amenities' && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" /> AV & Equipment</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITIES_OPTIONS.map(a => {
                    const Icon = a.icon;
                    const selected = form.amenities.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleAmenity(a.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          selected ? 'border-brass bg-brass/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${selected ? 'text-brass' : 'text-muted-foreground'}`} />
                        <span className={selected ? 'font-medium' : ''}>{a.label}</span>
                        {selected && <CheckCircle2 className="h-3 w-3 text-brass ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coffee className="h-4 w-4" /> Catering & Refreshments</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {CATERING_OPTIONS.map(c => {
                    const selected = form.catering.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCatering(c.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          selected ? 'border-brass bg-brass/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`h-4 w-4 flex items-center justify-center text-xs ${selected ? 'text-brass' : 'text-muted-foreground'}`}>🍽️</span>
                        <span className={selected ? 'font-medium' : ''}>{c.label}</span>
                        {selected && <CheckCircle2 className="h-3 w-3 text-brass ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Special Requirements</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={form.specialRequirements}
                  onChange={e => updateForm('specialRequirements', e.target.value)}
                  placeholder="e.g., Custom branding on screens, dietary restrictions, wheelchair access, specific timing for breaks..."
                  rows={3}
                />
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('details')}>← Back</Button>
              <Button variant="brass" onClick={() => setStep('review')}>Review Request →</Button>
            </div>
          </>
        )}

        {/* STEP 3: Review & Submit */}
        {step === 'review' && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">📋 Review Your Request</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Venue */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Venue</p>
                  <p className="font-semibold">{selectedRoomData?.name}</p>
                  <p className="text-sm text-muted-foreground">Capacity: {selectedRoomData?.capacity} guests</p>
                </div>

                {/* Event Details */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Event Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> {EVENT_TYPES.find(t => t.value === form.eventType)?.label}</div>
                    <div><span className="text-muted-foreground">Guests:</span> {form.guestCount}</div>
                    <div><span className="text-muted-foreground">Date:</span> {form.bookingDate}</div>
                    <div><span className="text-muted-foreground">Time:</span> {form.startTime} ({form.duration}h)</div>
                    <div><span className="text-muted-foreground">Layout:</span> {form.seatingLayout}</div>
                    {form.companyName && <div><span className="text-muted-foreground">Company:</span> {form.companyName}</div>}
                  </div>
                </div>

                {/* Contact */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Contact</p>
                  <p className="text-sm font-medium">{form.contactName} {form.companyName && `— ${form.companyName}`}</p>
                  <p className="text-xs text-muted-foreground">{form.contactEmail} {form.contactPhone && `· ${form.contactPhone}`}</p>
                </div>

                {/* Amenities */}
                {form.amenities.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Equipment & Amenities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.amenities.map(a => (
                        <Badge key={a} variant="secondary" className="text-xs">
                          {AMENITIES_OPTIONS.find(o => o.id === a)?.label || a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Catering */}
                {form.catering.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Catering</p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.catering.map(c => (
                        <Badge key={c} variant="secondary" className="text-xs">
                          {CATERING_OPTIONS.find(o => o.id === c)?.label || c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Requirements */}
                {form.specialRequirements && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Special Requirements</p>
                    <p className="text-sm">{form.specialRequirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-brass bg-brass/5">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-navy mb-1">📩 Quote Request</p>
                <p className="text-xs text-muted-foreground">
                  Submitting this form sends your requirements to our events manager.
                  You'll receive an official quote via email within 24 hours.
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('amenities')}>← Back</Button>
              <Button variant="brass" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Submit Quote Request
              </Button>
            </div>
          </>
        )}

        {/* STEP 4: Confirmation */}
        {step === 'confirm' && (
          <Card className="text-center">
            <CardContent className="p-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Request Submitted!</h2>
              <p className="text-muted-foreground mb-2">
                Thank you, {form.contactName}! Your conference request has been sent to our events team.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                📩 A confirmation has been sent to <strong>{form.contactEmail}</strong>.
                <br />Our manager will prepare an official quote and get back to you within 24 hours.
              </p>
              <div className="flex gap-3 justify-center">
                <Link to="/guest"><Button variant="brass">Go to Dashboard</Button></Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
