import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookings } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import { useHousekeepingStats } from '@/hooks/useHousekeeping';
import { formatCurrency } from '@/lib/utils';
import { BedDouble, CalendarCheck, DollarSign, TrendingUp, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();
  const { data: hkStats } = useHousekeepingStats();

  const isLoading = bookingsLoading || roomsLoading;

  const stats = {
    totalRooms: rooms?.filter(r => r.is_active).length || 0,
    totalBookings: bookings?.length || 0,
    confirmedBookings: bookings?.filter(b => b.status === 'confirmed').length || 0,
    pendingBookings: bookings?.filter(b => b.status === 'pending').length || 0,
    totalRevenue: bookings
      ?.filter(b => b.status === 'confirmed')
      .reduce((acc, b) => acc + Number(b.rate), 0) || 0,
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
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your hotel performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Rooms</CardTitle>
            <BedDouble className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalRooms}</div>
            <p className="text-xs text-muted-foreground mt-1">Room types available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingBookings} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.confirmedBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.confirmedBookings / (stats.totalBookings || 1)) * 100).toFixed(0)}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-brass" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">From confirmed bookings</p>
          </CardContent>
        </Card>
      </div>

      {/* Housekeeping Overview */}
      {hkStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-amber-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">Dirty Rooms</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1">{hkStats.dirtyRooms}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">Being Cleaned</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">{hkStats.cleaningRooms}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-muted-foreground">Clean (Pending Insp.)</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{hkStats.cleanRooms}</p>
            </CardContent>
          </Card>
          <Card className="bg-brass/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-brass" />
                <span className="text-sm font-medium text-muted-foreground">Available</span>
              </div>
              <p className="text-2xl font-bold text-brass mt-1">{hkStats.availableRooms}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet</p>
          ) : (
            <div className="space-y-4">
              {bookings?.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{booking.guests?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Room {booking.rooms?.room_number} • {booking.check_in} to {booking.check_out}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(booking.rate))}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {booking.status}
                    </span>
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
