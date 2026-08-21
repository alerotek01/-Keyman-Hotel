import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Users, Utensils, Car, Loader2, CheckCircle2 } from 'lucide-react';
import { cn, formatCurrency, calculateBookingPrice, getRoomTypeLabel } from '@/lib/utils';
import { useCreateBooking } from '@/hooks/useBookings';
import type { RoomWithAvailability } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface BookingModalProps {
  room: RoomWithAvailability | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingModal({ room, open, onOpenChange }: BookingModalProps) {
  const { toast } = useToast();
  const createBooking = useCreateBooking();
  const [success, setSuccess] = useState(false);
  
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(new Date(), 1));
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(new Date(), 3));
  const [guestsCount, setGuestsCount] = useState(2);
  const [breakfast, setBreakfast] = useState(false);
  const [vehicle, setVehicle] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  if (!room) return null;

  const pricing = checkIn && checkOut
    ? calculateBookingPrice(
        Number(room.base_price),
        Number(room.breakfast_price),
        checkIn,
        checkOut,
        guestsCount,
        breakfast
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkIn || !checkOut || !customerName || !customerEmail) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createBooking.mutateAsync({
        room_id: room.id,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guestsCount,
        breakfast,
        vehicle,
        customer_name: customerName,
        customer_email: customerEmail,
      });
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        setCustomerName('');
        setCustomerEmail('');
        setBreakfast(false);
        setVehicle(false);
      }, 3000);
    } catch (error) {
      toast({
        title: 'Booking Failed',
        description: 'There was an error processing your booking. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-14 w-14 rounded-full bg-brass/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-brass" />
            </div>
            <DialogTitle className="font-display text-2xl text-charcoal mb-2">Booking Confirmed</DialogTitle>
            <DialogDescription className="text-charcoal/50">
              Your reservation has been submitted. We'll send a confirmation to <strong className="text-charcoal">{customerEmail}</strong>.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-charcoal">
            Book Room {room.room_number}
          </DialogTitle>
          <DialogDescription className="text-charcoal/50">
            {getRoomTypeLabel(room.room_type)} · {formatCurrency(Number(room.base_price))}/night
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Check-in</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-full border-charcoal/10",
                      !checkIn && "text-charcoal/40"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {checkIn ? format(checkIn, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkIn}
                    onSelect={setCheckIn}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Check-out</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-full border-charcoal/10",
                      !checkOut && "text-charcoal/40"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {checkOut ? format(checkOut, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOut}
                    onSelect={setCheckOut}
                    disabled={(date) => date <= (checkIn || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-brass/60" />
              Number of Guests
            </Label>
            <Input
              type="number"
              min={1}
              max={4}
              value={guestsCount}
              onChange={(e) => setGuestsCount(parseInt(e.target.value) || 1)}
              className="rounded-full border-charcoal/10"
            />
          </div>

          {/* Extras */}
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Extras</Label>
            <div className="flex items-center justify-between rounded-xl border border-charcoal/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brass/10 flex items-center justify-center">
                  <Utensils className="h-4 w-4 text-brass" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">Breakfast</p>
                  <p className="text-xs text-charcoal/40">
                    {formatCurrency(Number(room.breakfast_price))} per person/night
                  </p>
                </div>
              </div>
              <Switch checked={breakfast} onCheckedChange={setBreakfast} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-charcoal/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brass/10 flex items-center justify-center">
                  <Car className="h-4 w-4 text-brass" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">Parking</p>
                  <p className="text-xs text-charcoal/40">Free parking included</p>
                </div>
              </div>
              <Switch checked={vehicle} onCheckedChange={setVehicle} />
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Guest Information</Label>
            <Input
              placeholder="Full Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="rounded-full border-charcoal/10"
            />
            <Input
              type="email"
              placeholder="Email Address"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
              className="rounded-full border-charcoal/10"
            />
          </div>

          {/* Price Summary */}
          {pricing && (
            <div className="rounded-xl bg-cream/60 p-4 space-y-2">
              <div className="flex justify-between text-sm text-charcoal/60">
                <span>Base rate ({pricing.nights} nights)</span>
                <span>{formatCurrency(pricing.base_cost)}</span>
              </div>
              {breakfast && (
                <div className="flex justify-between text-sm text-charcoal/60">
                  <span>Breakfast ({guestsCount} × {pricing.nights})</span>
                  <span>{formatCurrency(pricing.breakfast_cost)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-charcoal/60">
                <span>Parking</span>
                <span className="text-brass">Free</span>
              </div>
              <div className="flex justify-between font-display text-lg text-charcoal pt-2 border-t border-charcoal/[0.06]">
                <span>Total</span>
                <span className="text-brass">{formatCurrency(pricing.total)}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="brass"
            size="xl"
            className="w-full"
            disabled={createBooking.isPending}
          >
            {createBooking.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm Booking · ${pricing ? formatCurrency(pricing.total) : ''}`
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
