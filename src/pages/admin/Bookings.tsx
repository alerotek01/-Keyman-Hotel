import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBookings, useUpdateBookingStatus } from '@/hooks/useBookings';
import { formatCurrency, formatDate, getStatusColor, getRoomTypeLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { BookingStatus } from '@/lib/types';
import { Loader2, Check, X, Clock } from 'lucide-react';

export default function AdminBookings() {
  const { data: bookings, isLoading } = useBookings();
  const updateStatus = useUpdateBookingStatus();
  const { toast } = useToast();

  const handleStatusChange = async (bookingId: string, status: BookingStatus) => {
    try {
      await updateStatus.mutateAsync({ id: bookingId, status });
      toast({ 
        title: 'Status Updated', 
        description: `Booking has been marked as ${status}.`
      });
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">View and manage all reservations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {bookings?.filter(b => b.status === 'Pending').length || 0}
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
                  {bookings?.filter(b => b.status === 'Confirmed').length || 0}
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
                  {bookings?.filter(b => b.status === 'Cancelled').length || 0}
                </p>
              </div>
              <X className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Table */}
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
                  <TableHead>Extras</TableHead>
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
                        <p className="font-medium">{booking.customers?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customers?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">Room {booking.rooms?.room_number}</p>
                        <p className="text-sm text-muted-foreground">{getRoomTypeLabel(booking.rooms?.room_type || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(booking.check_in)}</TableCell>
                    <TableCell>{formatDate(booking.check_out)}</TableCell>
                    <TableCell>{booking.guests_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {booking.breakfast && <Badge variant="outline" className="text-xs">Breakfast</Badge>}
                        {booking.vehicle && <Badge variant="outline" className="text-xs">Parking</Badge>}
                        {!booking.breakfast && !booking.vehicle && <span className="text-muted-foreground text-xs">None</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(Number(booking.total_amount))}
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
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Confirmed">Confirmed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
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
    </div>
  );
}
