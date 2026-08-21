import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { RoomCard } from '@/components/RoomCard';
import { BookingModal } from '@/components/BookingModal';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoomAvailability } from '@/hooks/useRooms';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomWithAvailability } from '@/lib/types';

const GUEST_ROOM_TYPES = ['Single', 'Twin', 'Studio'];

export default function RoomsPage() {
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(new Date(), 1));
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(new Date(), 3));
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<RoomWithAvailability | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data: rooms, isLoading } = useRoomAvailability(checkIn ?? null, checkOut ?? null);

  // Only show guest rooms (Single, Twin, Studio) — not Conference/Cafeteria
  const guestRooms = rooms?.filter(r =>
    GUEST_ROOM_TYPES.includes(r.room_types?.name || r.room_type || '')
  );

  const filteredRooms = guestRooms?.filter((room) => {
    if (roomTypeFilter === 'all') return true;
    return (room.room_types?.name || room.room_type) === roomTypeFilter;
  });

  const handleBookRoom = (room: RoomWithAvailability) => {
    setSelectedRoom(room);
    setBookingOpen(true);
  };

  return (
    <Layout>
      {/* Header */}
      <section className="bg-charcoal py-12 sm:py-16 md:py-20 mt-[72px]">
        <div className="container text-center px-4">
          <span className="eyebrow text-brass-light/70">Mwatate, Taita Taveta</span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-cream mt-3">
            Our Rooms
          </h1>
          <p className="text-cream/40 max-w-lg mx-auto mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed">
            Clean, quiet rooms at the foot of the Taita Hills.
            From KES 91/night — single, twin, and studio.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-4 sm:py-6 border-b border-charcoal/[0.04] bg-white sticky top-[72px] z-40">
        <div className="container px-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-between">
            <p className="text-xs text-charcoal/40 font-medium">
              {filteredRooms?.length ?? 0} rooms found
            </p>

            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal rounded-full border-charcoal/10 text-xs sm:text-sm",
                      !checkIn && "text-charcoal/40"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5" />
                    {checkIn ? format(checkIn, "MMM d") : "Check-in"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkIn}
                    onSelect={(date) => {
                      setCheckIn(date);
                      if (date && (!checkOut || checkOut <= date)) {
                        setCheckOut(addDays(date, 1));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal rounded-full border-charcoal/10 text-xs sm:text-sm",
                      !checkOut && "text-charcoal/40"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5" />
                    {checkOut ? format(checkOut, "MMM d") : "Check-out"}
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

              <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                <SelectTrigger className="w-[130px] sm:w-[150px] rounded-full border-charcoal/10 text-xs sm:text-sm">
                  <SelectValue placeholder="Room Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Twin">Twin</SelectItem>
                  <SelectItem value="Studio">Studio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Rooms Grid */}
      <section className="py-8 sm:py-12">
        <div className="container px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-brass" />
            </div>
          ) : filteredRooms?.length === 0 ? (
            <div className="text-center py-16 sm:py-20">
              <h3 className="font-display text-xl sm:text-2xl text-charcoal mb-2">No rooms available</h3>
              <p className="text-charcoal/40 text-sm">Try adjusting your dates or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredRooms?.map((room) => (
                <RoomCard key={room.id} room={room} onBook={handleBookRoom} />
              ))}
            </div>
          )}
        </div>
      </section>

      <BookingModal
        room={selectedRoom}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
      />
    </Layout>
  );
}
