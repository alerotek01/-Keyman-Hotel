import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isWithinInterval, parseISO, differenceInCalendarDays
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Calendar, LayoutGrid,
  BedDouble, User, Clock, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  guest_name: string;
  room_number: string | number;
  room_type?: string;
  check_in: string;
  check_out: string;
  status: string;
  rate: number;
  num_adults: number;
  num_children: number;
  plate_number?: string;
  special_requests?: string;
  guests?: { name: string; email?: string; phone?: string };
  rooms?: { room_number: string | number; room_types?: { name: string } };
}

interface BookingCalendarProps {
  bookings: Booking[];
  rooms?: Array<{ id: string; room_number: string | number; room_type_id: string; status: string; room_types?: { name: string } }>;
  onBookingClick?: (booking: Booking) => void;
}

type ViewMode = 'month' | 'rooms';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  checked_in: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  checked_out: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

function getBookingColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.confirmed;
}

function getBookingsForDay(bookings: Booking[], day: Date): Booking[] {
  return bookings.filter((b) => {
    const checkIn = parseISO(b.check_in);
    const checkOut = parseISO(b.check_out);
    return isWithinInterval(day, { start: checkIn, end: addDays(checkOut, -1) }) ||
           isSameDay(day, checkIn) || isSameDay(day, checkOut);
  });
}

// ═══════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════
function MonthView({ bookings, currentDate, onBookingClick }: {
  bookings: Booking[];
  currentDate: Date;
  onBookingClick?: (b: Booking) => void;
}) {
  const [hoveredBooking, setHoveredBooking] = useState<Booking | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="relative">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekdays.map((wd) => (
          <div key={wd} className="p-2 text-center text-xs font-semibold text-muted-foreground">
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border/50 last:border-0">
          {week.map((d) => {
            const isCurrentMonth = isSameMonth(d, currentDate);
            const isToday = isSameDay(d, new Date());
            const dayBookings = getBookingsForDay(bookings, d);

            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'min-h-[100px] p-1.5 border-r border-border/30 last:border-r-0',
                  !isCurrentMonth && 'bg-muted/30',
                  isToday && 'bg-brass/5'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1',
                  isToday ? 'text-brass font-bold' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {format(d, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.slice(0, 3).map((b) => {
                    const colors = getBookingColor(b.status);
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer border',
                          colors.bg, colors.text, colors.border,
                          'hover:ring-1 hover:ring-brass/50 transition-all'
                        )}
                        onClick={() => onBookingClick?.(b)}
                        onMouseEnter={(e) => {
                          setHoveredBooking(b);
                          setHoverPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredBooking(null)}
                      >
                        {b.guests?.name || b.guest_name || 'Guest'}
                      </div>
                    );
                  })}
                  {dayBookings.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Hover tooltip */}
      {hoveredBooking && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-border p-3 w-64 pointer-events-none"
          style={{ left: hoverPos.x + 12, top: hoverPos.y - 10 }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{hoveredBooking.guests?.name || hoveredBooking.guest_name}</p>
            <Badge variant={hoveredBooking.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
              {hoveredBooking.status}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BedDouble className="h-3 w-3" />
              <span>Room {hoveredBooking.room_number} {hoveredBooking.room_type ? `(${hoveredBooking.room_type})` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{format(parseISO(hoveredBooking.check_in), 'MMM d')} — {format(parseISO(hoveredBooking.check_out), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span>{hoveredBooking.num_adults} adult{hoveredBooking.num_adults > 1 ? 's' : ''}{hoveredBooking.num_children ? `, ${hoveredBooking.num_children} child` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" />
              <span>{formatCurrency(Number(hoveredBooking.rate))}/night</span>
            </div>
            {hoveredBooking.plate_number && (
              <p className="text-brass font-medium">🚗 {hoveredBooking.plate_number}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ROOM TIMELINE VIEW
// ═══════════════════════════════════════════════
function RoomTimelineView({ bookings, rooms, currentDate, onBookingClick }: {
  bookings: Booking[];
  rooms: Array<{ id: string; room_number: string | number; room_types?: { name: string }; status: string }>;
  currentDate: Date;
  onBookingClick?: (b: Booking) => void;
}) {
  const [hoveredBooking, setHoveredBooking] = useState<Booking | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;

  const sortedRooms = [...rooms].sort((a, b) => {
    const numA = Number(a.room_number);
    const numB = Number(b.room_number);
    return numA - numB;
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Day headers */}
        <div className="flex border-b border-border sticky top-0 bg-white z-10">
          <div className="w-28 shrink-0 p-2 text-xs font-semibold text-muted-foreground border-r border-border">
            Room
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = addDays(monthStart, i);
              const isToday = isSameDay(d, new Date());
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 p-1 text-center text-[10px] border-r border-border/30 last:border-r-0 min-w-[28px]',
                    isToday ? 'bg-brass/10 font-bold text-brass' : 'text-muted-foreground'
                  )}
                >
                  <div>{format(d, 'EEE')}</div>
                  <div className="font-semibold">{format(d, 'd')}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Room rows */}
        {sortedRooms.map((room) => (
          <div key={room.id} className="flex border-b border-border/50 last:border-0 hover:bg-muted/30">
            <div className="w-28 shrink-0 p-2 border-r border-border flex flex-col justify-center">
              <p className="text-sm font-semibold">{room.room_number}</p>
              <p className="text-[10px] text-muted-foreground">{room.room_types?.name || ''}</p>
            </div>
            <div className="flex-1 flex relative" style={{ minHeight: '40px' }}>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = addDays(monthStart, i);
                const isToday = isSameDay(d, new Date());
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 border-r border-border/20 last:border-r-0 min-w-[28px]',
                      isToday && 'bg-brass/5'
                    )}
                  />
                );
              })}

              {/* Booking bars */}
              {bookings
                .filter((b) => {
                  const roomNum = b.room_number || b.rooms?.room_number;
                  return String(roomNum) === String(room.room_number);
                })
                .map((b) => {
                  const checkIn = parseISO(b.check_in);
                  const checkOut = parseISO(b.check_out);
                  const startDay = Math.max(0, differenceInCalendarDays(checkIn, monthStart));
                  const endDay = Math.min(daysInMonth - 1, differenceInCalendarDays(checkOut, monthStart));
                  const span = Math.max(1, endDay - startDay + 1);
                  const colors = getBookingColor(b.status);

                  return (
                    <div
                      key={b.id}
                      className={cn(
                        'absolute top-1 h-7 rounded-sm px-1 flex items-center cursor-pointer border',
                        colors.bg, colors.text, colors.border,
                        'hover:ring-2 hover:ring-brass/50 transition-all z-10'
                      )}
                      style={{
                        left: `${(startDay / daysInMonth) * 100}%`,
                        width: `${(span / daysInMonth) * 100}%`,
                      }}
                      onClick={() => onBookingClick?.(b)}
                      onMouseEnter={(e) => {
                        setHoveredBooking(b);
                        setHoverPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredBooking(null)}
                    >
                      <span className="text-[10px] font-medium truncate">
                        {b.guests?.name || b.guest_name}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredBooking && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-border p-3 w-64 pointer-events-none"
          style={{ left: hoverPos.x + 12, top: hoverPos.y - 10 }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{hoveredBooking.guests?.name || hoveredBooking.guest_name}</p>
            <Badge variant={hoveredBooking.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
              {hoveredBooking.status}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BedDouble className="h-3 w-3" />
              <span>Room {hoveredBooking.room_number}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{format(parseISO(hoveredBooking.check_in), 'MMM d')} — {format(parseISO(hoveredBooking.check_out), 'MMM d')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" />
              <span>{formatCurrency(Number(hoveredBooking.rate))}/night</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN CALENDAR COMPONENT
// ═══════════════════════════════════════════════
export default function BookingCalendar({ bookings, rooms, onBookingClick }: BookingCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const checkedInCount = bookings.filter((b) => b.status === 'checked_in').length;
  const totalRevenue = bookings
    .filter((b) => !['cancelled', 'no_show'].includes(b.status))
    .reduce((sum, b) => {
      const nights = differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in));
      return sum + Number(b.rate) * Math.max(1, nights);
    }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Booking Calendar</CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] bg-blue-50">{confirmedCount} confirmed</Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-50">{checkedInCount} in-house</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 rounded-none"
                onClick={() => setViewMode('month')}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Month
              </Button>
              <Button
                variant={viewMode === 'rooms' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 rounded-none"
                onClick={() => setViewMode('rooms')}
              >
                <BedDouble className="h-3.5 w-3.5 mr-1" />
                Rooms
              </Button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-3" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <span className="text-sm font-semibold min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {viewMode === 'month' ? (
          <MonthView bookings={bookings} currentDate={currentDate} onBookingClick={onBookingClick} />
        ) : (
          <RoomTimelineView
            bookings={bookings}
            rooms={rooms || []}
            currentDate={currentDate}
            onBookingClick={onBookingClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
