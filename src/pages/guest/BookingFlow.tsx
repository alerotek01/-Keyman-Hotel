import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Calendar, CreditCard, CheckCircle2, AlertTriangle, Clock, Minus, Plus, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface BreakfastMenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
}

interface DaySelection {
  date: string;
  items: { menuItem: BreakfastMenuItem; quantity: number }[];
}

export default function BookingFlow() {
  const { user } = useAuth();
  const [step, setStep] = useState<'dates' | 'mealplan' | 'breakfast' | 'payment' | 'confirm'>('dates');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [numAdults, setNumAdults] = useState('1');
  const [numChildren, setNumChildren] = useState('0');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentRule, setPaymentRule] = useState<any>(null);
  const [depositPercent, setDepositPercent] = useState(50);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // B&B state
  const [mealPlan, setMealPlan] = useState<'room_only' | 'b&b'>('room_only');
  const [breakfastItems, setBreakfastItems] = useState<BreakfastMenuItem[]>([]);
  const [daySelections, setDaySelections] = useState<DaySelection[]>([]);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [rt, settings, cats, items] = await Promise.all([
        sb.from('room_types').select('*').eq('is_active', true).order('base_rate'),
        sb.from('site_settings').select('*'),
        sb.from('menu_categories').select('id').eq('name', 'Breakfast').single(),
        sb.from('menu_items').select('id, name, price, description, image_url').eq('is_available', true).order('price'),
      ]);
      setRoomTypes(rt.data || []);
      const depSetting = settings.data?.find((s: any) => s.key === 'reservation_deposit_percent');
      if (depSetting) setDepositPercent(parseInt(depSetting.value) || 50);
      if (user?.email) setGuestName(user.email.split('@')[0]);

      // Filter breakfast items
      if (cats.data && items.data) {
        setBreakfastItems(items.data.filter((i: any) => i.category_id === cats.data.id));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Calculate nights
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  }, [checkIn, checkOut]);

  // Generate dates array for the stay
  const stayDates = useMemo(() => {
    if (!checkIn || nights <= 0) return [];
    const dates: string[] = [];
    const start = new Date(checkIn);
    for (let i = 0; i < nights; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [checkIn, nights]);

  // Initialize day selections when dates change
  useEffect(() => {
    if (mealPlan !== 'b&b' || stayDates.length === 0) return;
    setDaySelections(prev => {
      // Preserve existing selections for dates that still exist
      const newSelections = stayDates.map(date => {
        const existing = prev.find(s => s.date === date);
        return existing || { date, items: [] };
      });
      return newSelections;
    });
  }, [stayDates, mealPlan]);

  // Calculate breakfast total
  const breakfastTotal = useMemo(() => {
    if (mealPlan !== 'b&b') return 0;
    const pax = parseInt(numAdults) || 1;
    let total = 0;
    for (const day of daySelections) {
      for (const sel of day.items) {
        total += sel.menuItem.price * sel.quantity * pax;
      }
    }
    return total;
  }, [daySelections, mealPlan, numAdults]);

  // Room total
  const roomTotal = useMemo(() => {
    const rt = roomTypes.find((r: any) => r.id === selectedRoomType);
    if (!rt) return 0;
    return Number(rt.base_rate) * nights;
  }, [selectedRoomType, nights, roomTypes]);

  // Grand total
  const grandTotal = roomTotal + breakfastTotal;

  useEffect(() => {
    if (!checkIn || !checkOut || !selectedRoomType) return;
    const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3600000;

    let rule, amount;
    if (hoursUntil < 12) {
      rule = 'pay_now';
      amount = grandTotal;
    } else if (nights >= 2) {
      rule = 'deposit';
      amount = Math.round(grandTotal * depositPercent / 100);
    } else {
      rule = 'pay_on_arrival';
      amount = 0;
    }

    setPaymentRule({ rule, total: grandTotal, nights, hoursUntil: Math.round(hoursUntil) });
    setPaymentAmount(amount);
  }, [checkIn, checkOut, selectedRoomType, depositPercent, grandTotal, nights]);

  const toggleItem = (dayIdx: number, menuItem: BreakfastMenuItem) => {
    setDaySelections(prev => {
      const next = [...prev];
      const day = { ...next[dayIdx] };
      const existingIdx = day.items.findIndex(i => i.menuItem.id === menuItem.id);
      if (existingIdx >= 0) {
        day.items = day.items.filter((_, i) => i !== existingIdx);
      } else {
        day.items = [...day.items, { menuItem, quantity: 1 }];
      }
      next[dayIdx] = day;
      return next;
    });
  };

  const updateQuantity = (dayIdx: number, menuItemId: string, delta: number) => {
    setDaySelections(prev => {
      const next = [...prev];
      const day = { ...next[dayIdx] };
      day.items = day.items.map(i => {
        if (i.menuItem.id === menuItemId) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      });
      next[dayIdx] = day;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedRoomType || !checkIn || !checkOut || !guestName) {
      toast.error('Fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const rt = roomTypes.find((r: any) => r.id === selectedRoomType);

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

      if (result?.reservation_id) {
        // Update payment type + meal plan + breakfast total
        const updateData: any = {
          payment_type: paymentRule?.rule || 'pay_on_arrival',
          deposit_amount: paymentAmount,
          meal_plan: mealPlan,
          breakfast_total: breakfastTotal,
        };
        await sb.from('reservations').update(updateData).eq('id', result.reservation_id);

        // Link guest user
        if (user?.id) {
          await sb.from('reservations').update({ guest_user_id: user.id }).eq('id', result.reservation_id);
        }

        // Save breakfast selections
        if (mealPlan === 'b&b' && daySelections.length > 0) {
          const pax = parseInt(numAdults) || 1;
          const selections = daySelections.flatMap(day =>
            day.items.flatMap(sel =>
              Array.from({ length: sel.quantity }, () => ({
                reservation_id: result.reservation_id,
                menu_item_id: sel.menuItem.id,
                item_name: sel.menuItem.name,
                item_price: sel.menuItem.price,
                quantity: 1,
                meal_date: day.date,
                pax,
              }))
            )
          );
          if (selections.length > 0) {
            await sb.from('breakfast_selections').insert(selections);
          }
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

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className={step === 'dates' ? 'font-bold text-primary' : ''}>1. Dates</span>
        <span>→</span>
        <span className={step === 'mealplan' ? 'font-bold text-primary' : ''}>2. Meal Plan</span>
        {mealPlan === 'b&b' && <><span>→</span><span className={step === 'breakfast' ? 'font-bold text-primary' : ''}>3. Breakfast</span></>}
        <span>→</span>
        <span className={step === 'payment' ? 'font-bold text-primary' : ''}>{mealPlan === 'b&b' ? '4' : '3'}. Pay</span>
      </div>

      {/* STEP 1: Dates */}
      {step === 'dates' && (
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

            <Button variant="brass" className="w-full" onClick={() => setStep('mealplan')} disabled={!selectedRoomType || !checkIn || !checkOut}>
              Continue to Meal Plan <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Meal Plan */}
      {step === 'mealplan' && (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Choose Your Meal Plan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setMealPlan('room_only')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mealPlan === 'room_only' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">🛏️ Room Only</p>
                      <p className="text-sm text-muted-foreground">Just the room — {formatCurrency(roomTotal)}</p>
                    </div>
                    {mealPlan === 'room_only' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                </button>

                <button
                  onClick={() => setMealPlan('b&b')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mealPlan === 'b&b' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">🍳 Bed & Breakfast</p>
                      <p className="text-sm text-muted-foreground">
                        Room + pick your breakfast from our menu ({nights} morning{nights !== 1 ? 's' : ''})
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Choose different items for each morning • {breakfastItems.length} items available
                      </p>
                    </div>
                    {mealPlan === 'b&b' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep('dates')}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button variant="brass" className="flex-1" onClick={() => setStep(mealPlan === 'b&b' ? 'breakfast' : 'payment')}>
              {mealPlan === 'b&b' ? 'Pick Breakfast' : 'Continue'} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}

      {/* STEP 3: Breakfast Picker (per day) */}
      {step === 'breakfast' && mealPlan === 'b&b' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                Pick Your Breakfast — Day {activeDay + 1} of {nights}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Day tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2">
                {stayDates.map((date, idx) => {
                  const dayItems = daySelections[idx]?.items ?? [];
                  const hasItems = dayItems.length > 0;
                  return (
                    <button
                      key={date}
                      onClick={() => setActiveDay(idx)}
                      className={`px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all ${
                        activeDay === idx
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : hasItems
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      Day {idx + 1}
                      <br />
                      <span className="text-[10px]">{new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      {hasItems && <span className="ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Items for this day */}
              <div className="space-y-2">
                {breakfastItems.map(item => {
                  const daySel = daySelections[activeDay];
                  const selItem = daySel?.items.find(i => i.menuItem.id === item.id);
                  const isSelected = !!selItem;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} per person</p>
                      </div>
                      {isSelected ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateQuantity(activeDay, item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-semibold w-6 text-center">{selItem.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateQuantity(activeDay, item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleItem(activeDay, item)}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Day summary */}
              {daySelections[activeDay]?.items.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium mb-1">Day {activeDay + 1} Selection:</p>
                  {daySelections[activeDay].items.map(sel => (
                    <p key={sel.menuItem.id} className="text-xs text-muted-foreground">
                      {sel.quantity}x {sel.menuItem.name} — {formatCurrency(sel.menuItem.price * sel.quantity)}
                    </p>
                  ))}
                  <Separator className="my-2" />
                  <p className="text-xs font-semibold">
                    Day total: {formatCurrency(daySelections[activeDay].items.reduce((sum, s) => sum + s.menuItem.price * s.quantity, 0))} × {numAdults} guest(s) = {formatCurrency(daySelections[activeDay].items.reduce((sum, s) => sum + s.menuItem.price * s.quantity, 0) * parseInt(numAdults || '1'))}
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-2">
                {activeDay > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setActiveDay(activeDay - 1)}>
                    <ChevronLeft className="h-3 w-3 mr-1" /> Previous Day
                  </Button>
                )}
                {activeDay < nights - 1 && (
                  <Button variant="outline" size="sm" onClick={() => setActiveDay(activeDay + 1)}>
                    Next Day <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Breakfast total summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Breakfast Total ({nights} days × {numAdults} guest(s))</p>
                  <p className="text-lg font-bold">{formatCurrency(breakfastTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Room ({nights} nights)</p>
                  <p className="text-sm">{formatCurrency(roomTotal)}</p>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <p className="font-semibold">Grand Total</p>
                <p className="text-xl font-bold">{formatCurrency(grandTotal)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep('mealplan')}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button variant="brass" className="flex-1" onClick={() => setStep('payment')}>
              Continue to Payment <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}

      {/* Payment Rule Display */}
      {(step === 'dates' || step === 'mealplan') && paymentRule && (
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

      {/* STEP 4: Payment */}
      {step === 'payment' && (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{rt?.name} · {nights} nights</span>
                  <span>{formatCurrency(roomTotal)}</span>
                </div>
                {mealPlan === 'b&b' && (
                  <div className="flex justify-between text-sm">
                    <span>🍳 Breakfast ({nights} days)</span>
                    <span>{formatCurrency(breakfastTotal)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {paymentAmount > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Amount to Pay (KES)</Label>
                    <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} min={0} max={grandTotal} />
                    <p className="text-xs text-muted-foreground">Minimum: {formatCurrency(paymentRule?.rule === 'deposit' ? grandTotal * depositPercent / 100 : grandTotal)}</p>
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
                <Button variant="outline" className="flex-1" onClick={() => setStep(mealPlan === 'b&b' ? 'breakfast' : 'mealplan')}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button variant="brass" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {paymentAmount > 0 ? 'Confirm & Pay' : 'Confirm Booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* STEP 5: Confirm */}
      {step === 'confirm' && (
        <Card className="text-center">
          <CardContent className="p-4 md:p-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-2">
              {mealPlan === 'b&b' ? '🍳 Bed & Breakfast' : '🛏️ Room Only'} · {nights} night{nights !== 1 ? 's' : ''}
            </p>
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
