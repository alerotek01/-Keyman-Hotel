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
import { Loader2, Calendar, CreditCard, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function BookingFlow() {
  const { user } = useAuth();
  const [step, setStep] = useState<'dates' | 'payment' | 'confirm'>('dates');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [numAdults, setNumAdults] = useState('2');
  const [numChildren, setNumChildren] = useState('0');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentRule, setPaymentRule] = useState<any>(null);
  const [depositPercent, setDepositPercent] = useState(50);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [rt, settings] = await Promise.all([
        sb.from('room_types').select('*').eq('is_active', true).order('base_rate'),
        sb.from('site_settings').select('*'),
      ]);
      setRoomTypes(rt.data || []);
      const depSetting = settings.data?.find((s: any) => s.key === 'reservation_deposit_percent');
      if (depSetting) setDepositPercent(parseInt(depSetting.value) || 50);
      // Pre-fill guest name from user
      if (user?.email) setGuestName(user.email.split('@')[0]);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!checkIn || !checkOut || !selectedRoomType) return;
    const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
    const rt = roomTypes.find((r: any) => r.id === selectedRoomType);
    if (!rt) return;
    const total = Number(rt.base_rate) * nights;
    
    const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3600000;
    
    let rule, amount;
    if (hoursUntil < 12) {
      rule = 'pay_now';
      amount = total;
    } else if (nights >= 2) {
      rule = 'deposit';
      amount = Math.round(total * depositPercent / 100);
    } else {
      rule = 'pay_on_arrival';
      amount = 0;
    }
    
    setPaymentRule({ rule, total, nights, hoursUntil: Math.round(hoursUntil) });
    setPaymentAmount(amount);
  }, [checkIn, checkOut, selectedRoomType, depositPercent, roomTypes]);

  const handleSubmit = async () => {
    if (!selectedRoomType || !checkIn || !checkOut || !guestName) {
      toast.error('Fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const rt = roomTypes.find((r: any) => r.id === selectedRoomType);
      const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
      const total = Number(rt.base_rate) * nights;

      // Create reservation via DB function
      const { data: result, error } = await sb.rpc('create_booking_safe', {
        p_guest_name: guestName,
        p_guest_email: user?.email || null,
        p_guest_phone: guestPhone || null,
        p_room_type_id: selectedRoomType,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_num_adults: parseInt(numAdults),
        p_num_children: parseInt(numChildren),
        p_special_requests: specialRequests || null,
        p_rate_override: Number(rt.base_rate),
      });
      if (error) throw error;

      // Update payment type
      if (result?.reservation_id) {
        await sb.from('reservations').update({
          payment_type: paymentRule?.rule || 'pay_on_arrival',
          deposit_amount: paymentAmount,
        }).eq('id', result.reservation_id);

        // Link guest user
        if (user?.id) {
          await sb.from('reservations').update({ guest_user_id: user.id }).eq('id', result.reservation_id);
        }

        // If deposit required, create pending payment
        if (paymentAmount > 0) {
          await sb.from('booking_payments').insert({
            reservation_id: result.reservation_id,
            amount: paymentAmount,
            method: 'mpesa',
            payment_type: paymentRule?.rule === 'deposit' ? 'deposit' : 'full',
            status: 'pending',
          });
        }
      }

      toast.success('Booking confirmed!');
      setStep('confirm');
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  const rt = roomTypes.find((r: any) => r.id === selectedRoomType);
  const total = rt ? Number(rt.base_rate) * Math.max(1, Math.ceil((new Date(checkOut || Date.now()).getTime() - new Date(checkIn || Date.now()).getTime()) / 86400000)) : 0;

  return (
    <div className="p-4 space-y-4">
        {step === 'dates' && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Select Room & Dates</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Room Type *</Label>
                  <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                    <SelectTrigger><SelectValue placeholder="Choose room type" /></SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name} — {formatCurrency(r.base_rate)}/night</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Check-In *</Label><Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
                  <div className="space-y-2"><Label>Check-Out *</Label><Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} min={checkIn || new Date().toISOString().split('T')[0]} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Adults</Label><Input type="number" min={1} value={numAdults} onChange={e => setNumAdults(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Children</Label><Input type="number" min={0} value={numChildren} onChange={e => setNumChildren(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Guest Name *</Label><Input value={guestName} onChange={e => setGuestName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Special Requests</Label><Input value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="e.g., extra pillows" /></div>
              </CardContent>
            </Card>

            {/* Payment Rule Display */}
            {paymentRule && (
              <Card className={`border-2 ${paymentRule.rule === 'pay_now' ? 'border-red-300 bg-red-50' : paymentRule.rule === 'deposit' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {paymentRule.rule === 'pay_now' ? <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" /> :
                     paymentRule.rule === 'deposit' ? <Clock className="h-5 w-5 text-amber-600 mt-0.5" /> :
                     <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />}
                    <div>
                      <p className="font-semibold text-sm">
                        {paymentRule.rule === 'pay_now' ? '⚡ Pay Now Required' :
                         paymentRule.rule === 'deposit' ? `💰 Deposit Required (${depositPercent}%)` :
                         '✅ Pay on Arrival'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {paymentRule.rule === 'pay_now'
                          ? `Check-in is within ${paymentRule.hoursUntil} hours. Full payment of ${formatCurrency(paymentAmount)} required now.`
                          : paymentRule.rule === 'deposit'
                          ? `${paymentRule.nights}-night stay. Deposit of ${formatCurrency(paymentAmount)} required now.`
                          : `${paymentRule.nights}-night stay. Pay ${formatCurrency(paymentRule.total)} at check-in.`
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Total */}
            {total > 0 && (
              <Card>
                <CardContent className="p-4 flex justify-between items-center">
                  <div><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold">{formatCurrency(total)}</p></div>
                  <Button variant="brass" onClick={() => setStep('payment')} disabled={!selectedRoomType || !checkIn || !checkOut}>Continue to Payment</Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {step === 'payment' && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payment</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">{rt?.name} · {paymentRule?.nights} nights</p>
                  <p className="text-lg font-bold">{formatCurrency(total)}</p>
                </div>

                {paymentAmount > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>Amount to Pay (KES)</Label>
                      <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} min={0} max={total} />
                      <p className="text-xs text-muted-foreground">Minimum: {formatCurrency(paymentRule?.rule === 'deposit' ? total * depositPercent / 100 : total)}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>M-Pesa Phone Number</Label>
                      <Input type="tel" placeholder="0712345678" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">📱 M-Pesa Payment</p>
                      <p className="text-xs text-blue-600 mt-1">Send {formatCurrency(paymentAmount)} to Paybill. Your booking will be confirmed after manual verification.</p>
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('dates')}>Back</Button>
                  <Button variant="brass" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {paymentAmount > 0 ? 'Confirm & Pay' : 'Confirm Booking'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === 'confirm' && (
          <Card className="text-center">
            <CardContent className="p-4 md:p-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-6">
                {paymentAmount > 0
                  ? `Deposit of ${formatCurrency(paymentAmount)} pending confirmation.`
                  : 'Pay at check-in.'
                }
              </p>
              <div className="flex gap-3 justify-center">
                <Link to="/guest"><Button variant="brass">Go to Dashboard</Button></Link>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
