import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { useBookings, useUpdateBookingStatus } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import { formatCurrency, formatDate, getStatusColor, getRoomTypeLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import BookingCalendar from '@/components/BookingCalendar';
import type { BookingStatus } from '@/lib/types';
import { Loader2, Check, X, Clock, Calendar, TableIcon } from 'lucide-react';

export default function AdminBookings() {
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const { data: bookings, isLoading } = useBookings();
  const { data: rooms } = useAllRooms();
  const updateStatus = useUpdateBookingStatus();
  const { toast } = useToast();

  const handleStatusChange = async (bookingId: string, status: BookingStatus) => {
    try {
      if (status === 'no_show') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await (supabase as any).rpc('mark_reservation_no_show', { p_reservation_id: bookingId });
        if (error) throw error;
        toast({
          title: '⚠️ No-Show Marked',
          description: `Room released, breakfast cancelled${data?.deposit_forfeited ? ', deposit forfeited' : ''}.`
        });
      } else {
        await updateStatus.mutateAsync({ id: bookingId, status });
        toast({
          title: 'Status Updated',
          description: `Booking has been marked as ${status}.`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status.',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">View and manage all reservations</p>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-4"
            onClick={() => setView('calendar')}
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Calendar
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-4"
            onClick={() => setView('table')}
          >
            <TableIcon className="h-4 w-4 mr-1.5" />
            Table
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="mb-8">
          <BookingCalendar
            bookings={bookings || []}
            rooms={rooms || []}
          />
        </div>
      )}

      {/* Stats Cards */}
      {view === 'table' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {bookings?.filter(b => b.status === 'pending').length || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {bookings?.filter(b => b.status === 'confirmed').length || 0}
                </p>
              </div>
              <Check className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">
                  {bookings?.filter(b => b.status === 'cancelled').length || 0}
                </p>
              </div>
              <X className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Bookings Table */}
      {view === 'table' && (
      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No bookings found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{booking.guests?.name}</p>
                        <p className="text-sm text-muted-foreground">{booking.guests?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">Room {booking.rooms?.room_number}</p>
                        <p className="text-sm text-muted-foreground">{getRoomTypeLabel(booking.room_types?.name || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(booking.check_in)}</TableCell>
                    <TableCell>{formatDate(booking.check_out)}</TableCell>
                    <TableCell>{booking.num_adults + booking.num_children}</TableCell>
                    <TableCell>
                      {booking.plate_number ? (
                        <Badge variant="outline" className="font-mono text-xs">{booking.plate_number}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(Number(booking.rate))}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={booking.status}
                        onValueChange={(value) => handleStatusChange(booking.id, value as BookingStatus)}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          {booking.status === 'confirmed' && (
                            <SelectItem value="no_show">⚠️ No-Show</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
