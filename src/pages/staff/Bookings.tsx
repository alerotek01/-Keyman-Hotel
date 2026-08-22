import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookings, useUpdateBookingStatus } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import BookingCalendar from '@/components/BookingCalendar';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/lib/types';

export default function StaffBookings() {
  const { data: bookings, isLoading } = useBookings();
  const { data: rooms } = useAllRooms();
  const updateStatus = useUpdateBookingStatus();
  const [filter, setFilter] = useState<string>('all');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const filteredBookings = bookings?.filter(b => {
    if (filter === 'all') return true;
    return b.status === filter;
  }) || [];

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await updateStatus.mutateAsync({ id: bookingId, status: newStatus });
      toast.success(`Booking ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update booking status');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage and confirm guest bookings</p>
        </div>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Booking Calendar */}
      <BookingCalendar
        bookings={bookings || []}
        rooms={rooms || []}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>{filteredBookings.length} booking(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings found</p>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{booking.guests?.name}</h3>
                        <Badge className={cn(getStatusColor(booking.status))}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Room</p>
                          <p className="font-medium">Room {booking.rooms?.room_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Check-in</p>
                          <p className="font-medium">{format(new Date(booking.check_in), 'MMM d, yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Check-out</p>
                          <p className="font-medium">{format(new Date(booking.check_out), 'MMM d, yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">{formatCurrency(Number(booking.rate))}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{booking.num_adults + booking.num_children} guest(s)</span>
                      </div>
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleStatusChange(booking.id, 'confirmed')}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
