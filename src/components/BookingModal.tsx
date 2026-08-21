import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Users, Loader2, CheckCircle2 } from 'lucide-react';
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
  const [numAdults, setNumAdults] = useState(2);
  const [numChildren, setNumChildren] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  if (!room) return null;

  const typeName = room.room_types?.name || 'Single';
  const basePrice = Number(room.room_types?.base_rate || room.base_price);
  const breakfastPrice = Number(room.room_types?.breakfast_price || 0);

  const pricing = checkIn && checkOut
    ? calculateBookingPrice(basePrice, breakfastPrice, checkIn, checkOut, numAdults, false)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkIn || !checkOut || !guestName || !guestEmail) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createBooking.mutateAsync({
        room_type_id: room.room_type_id,
        check_in: checkIn,
        check_out: checkOut,
        num_adults: numAdults,
        num_children: numChildren,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        special_requests: specialRequests || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setSpecialRequests('');
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
              Your reservation has been submitted. We'll send a confirmation to <strong className="text-charcoal">{guestEmail}</strong>.
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
            {getRoomTypeLabel(typeName)} · {formatCurrency(basePrice)}/night
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-brass/60" />
                Adults
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={numAdults}
                onChange={(e) => setNumAdults(parseInt(e.target.value) || 1)}
                className="rounded-full border-charcoal/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Children</Label>
              <Input
                type="number"
                min={0}
                max={4}
                value={numChildren}
                onChange={(e) => setNumChildren(parseInt(e.target.value) || 0)}
                className="rounded-full border-charcoal/10"
              />
            </div>
          </div>

          {/* Guest Info */}
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Guest Information</Label>
            <Input
              placeholder="Full Name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              className="rounded-full border-charcoal/10"
            />
            <Input
              type="email"
              placeholder="Email Address"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
              className="rounded-full border-charcoal/10"
            />
            <Input
              type="tel"
              placeholder="Phone Number"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="rounded-full border-charcoal/10"
            />
            <Input
              placeholder="Special Requests (optional)"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="rounded-full border-charcoal/10"
            />
          </div>

          {/* Price Summary */}
          {pricing && (
            <div className="rounded-xl bg-cream/60 p-4 space-y-2">
              <div className="flex justify-between text-sm text-charcoal/60">
                <span>Room ({pricing.nights} nights)</span>
                <span>{formatCurrency(pricing.base_cost)}</span>
              </div>
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
