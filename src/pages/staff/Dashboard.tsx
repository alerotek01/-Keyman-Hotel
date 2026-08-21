import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBookings } from '@/hooks/useBookings';
import { useGuestRequests } from '@/hooks/useGuestRequests';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  CalendarCheck, 
  ClipboardList, 
  CheckCircle2, 
  Clock,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StaffDashboard() {
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: guestRequests, isLoading: requestsLoading } = useGuestRequests();

  const isLoading = bookingsLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
  const todayCheckIns = bookings?.filter(b => b.check_in === format(new Date(), 'yyyy-MM-dd')) || [];
  const todayCheckOuts = bookings?.filter(b => b.check_out === format(new Date(), 'yyyy-MM-dd')) || [];
  
  const pendingRequests = guestRequests?.filter(r => r.status === 'pending') || [];
  const inProgressRequests = guestRequests?.filter(r => r.status === 'in_progress') || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Staff Dashboard</h1>
        <p className="text-muted-foreground">Welcome! Here's what needs your attention today.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingBookings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting confirmation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Check-ins</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayCheckIns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{format(new Date(), 'MMM d, yyyy')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Check-outs</CardTitle>
            <Clock className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayCheckOuts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{format(new Date(), 'MMM d, yyyy')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Requests</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingRequests.length + inProgressRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{pendingRequests.length} pending, {inProgressRequests.length} in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Bookings</CardTitle>
            <Link to="/staff/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingBookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending bookings</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{booking.guests?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Room {booking.rooms?.room_number} • {format(new Date(booking.check_in), 'MMM d')} - {format(new Date(booking.check_out), 'MMM d')}
                      </p>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(booking.rate))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guest Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Open Guest Requests</CardTitle>
            <Link to="/staff/requests">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 && inProgressRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No open requests</p>
            ) : (
              <div className="space-y-3">
                {[...pendingRequests, ...inProgressRequests].slice(0, 5).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium capitalize">{request.request_type.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.bookings?.guests?.name} • Room {request.bookings?.rooms?.room_number}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      request.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    )}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule - {format(new Date(), 'MMMM d, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Check-ins
              </h3>
              {todayCheckIns.length === 0 ? (
                <p className="text-muted-foreground text-sm">No check-ins today</p>
              ) : (
                <div className="space-y-2">
                  {todayCheckIns.map((booking) => (
                    <div key={booking.id} className="p-3 rounded-lg bg-emerald-50 text-emerald-900">
                      <p className="font-medium">{booking.guests?.name}</p>
                      <p className="text-sm">Room {booking.rooms?.room_number} • {booking.num_adults + booking.num_children} guest(s)</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brass" />
                Check-outs
              </h3>
              {todayCheckOuts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No check-outs today</p>
              ) : (
                <div className="space-y-2">
                  {todayCheckOuts.map((booking) => (
                    <div key={booking.id} className="p-3 rounded-lg bg-amber-50 text-amber-900">
                      <p className="font-medium">{booking.guests?.name}</p>
                      <p className="text-sm">Room {booking.rooms?.room_number}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
