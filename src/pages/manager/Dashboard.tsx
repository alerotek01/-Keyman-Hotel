import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBookings } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import { formatCurrency, getRoomTypeLabel } from '@/lib/utils';
import { calculateOccupancy, calculateRevenue, calculateGuestInsights } from '@/lib/reportUtils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  CalendarCheck,
  TrendingUp,
  Users,
  Loader2,
  ArrowRight,
  BarChart3
} from 'lucide-react';

export default function ManagerDashboard() {
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();

  const isLoading = bookingsLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const thisMonth = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  };

  const occupancyData = calculateOccupancy(bookings || [], rooms || [], thisMonth.from, thisMonth.to);
  const revenueData = calculateRevenue(bookings || [], 'monthly');
  const guestInsights = calculateGuestInsights(bookings || []);

  const avgOccupancy = occupancyData.reduce((acc, d) => acc + d.occupancyRate, 0) / (occupancyData.length || 1);
  const totalRevenue = revenueData.reduce((acc, d) => acc + d.totalRevenue, 0);
  const thisMonthRevenue = revenueData.find(r => r.period === format(new Date(), 'yyyy-MM'))?.totalRevenue || 0;

  const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
  const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your hotel overview.</p>
        </div>

        <Link to="/manager/reports">
          <Button variant="brass">
            <BarChart3 className="mr-2 h-4 w-4" />
            View Full Reports
          </Button>
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month Occupancy</CardTitle>
            <BedDouble className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgOccupancy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">{format(new Date(), 'MMMM yyyy')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(thisMonthRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total: {formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingBookings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Guests</CardTitle>
            <Users className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{guestInsights.totalGuests}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Guest Insights Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Guest Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <BedDouble className="h-5 w-5 text-brass" />
                <span>Average Stay</span>
              </div>
              <span className="font-bold">{guestInsights.averageStayLength.toFixed(1)} nights</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Bookings</CardTitle>
            <Link to="/manager/bookings">
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
                {pendingBookings.slice(0, 4).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{booking.guests?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Room {booking.rooms?.room_number} • {format(new Date(booking.check_in), 'MMM d')}
                      </p>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(booking.rate))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Room Type Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(guestInsights.roomTypeDistribution).map(([type, count]) => (
              <div key={type} className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{getRoomTypeLabel(type)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
