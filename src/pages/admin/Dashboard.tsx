import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookings } from '@/hooks/useBookings';
import { useAllRooms } from '@/hooks/useRooms';
import { useHousekeepingStats } from '@/hooks/useHousekeeping';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  BedDouble, CalendarCheck, DollarSign, TrendingUp, Loader2, Sparkles,
  AlertTriangle, Users, UtensilsCrossed, Globe, Shield, Clock,
  ChevronRight, Receipt, Building2
} from 'lucide-react';

export default function AdminDashboard() {
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: rooms, isLoading: roomsLoading } = useAllRooms();
  const { data: hkStats } = useHousekeepingStats();
  const { displayName } = useAuth();

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
    <div className="p-4 md:p-8">
      {/* ═══ MOBILE: Compact summary cards ═══ */}
      <div className="md:hidden">
        <div className="mb-4">
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Hotel overview at a glance</p>
        </div>

        {/* Stats — compact 2x2 colored cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link to="/admin/bookings">
            <div className="bg-gradient-to-br from-navy to-navy/80 rounded-xl p-3 text-white">
              <CalendarCheck className="h-4 w-4 text-brass mb-1" />
              <p className="text-2xl font-bold">{stats.totalBookings}</p>
              <p className="text-[10px] text-white/60">Bookings · {stats.pendingBookings} pending</p>
            </div>
          </Link>
          <Link to="/admin/rooms">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-3 text-white">
              <BedDouble className="h-4 w-4 text-emerald-200 mb-1" />
              <p className="text-2xl font-bold">{stats.totalRooms}</p>
              <p className="text-[10px] text-white/60">Active rooms</p>
            </div>
          </Link>
          <Link to="/admin/reports">
            <div className="bg-gradient-to-br from-brass to-brass-dark rounded-xl p-3 text-navy">
              <DollarSign className="h-4 w-4 mb-1" />
              <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-[10px] opacity-60">Revenue</p>
            </div>
          </Link>
          <Link to="/admin/reports">
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-3 text-white">
              <TrendingUp className="h-4 w-4 text-purple-200 mb-1" />
              <p className="text-2xl font-bold">
                {((stats.confirmedBookings / (stats.totalBookings || 1)) * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-white/60">Conversion</p>
            </div>
          </Link>
        </div>

        {/* Housekeeping — horizontal scroll pills */}
        {hkStats && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
            <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">{hkStats.dirtyRooms} dirty</span>
            </div>
            <div className="shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">{hkStats.cleaningRooms} cleaning</span>
            </div>
            <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">{hkStats.cleanRooms} clean</span>
            </div>
            <div className="shrink-0 bg-brass/10 border border-brass/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <BedDouble className="h-3.5 w-3.5 text-brass" />
              <span className="text-xs font-medium text-brass">{hkStats.availableRooms} ready</span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <CalendarCheck className="h-5 w-5" />, label: 'Bookings', path: '/admin/bookings', color: 'bg-navy text-white' },
              { icon: <Users className="h-5 w-5" />, label: 'Users', path: '/admin/users', color: 'bg-emerald-600 text-white' },
              { icon: <Receipt className="h-5 w-5" />, label: 'Folios', path: '/admin/folios', color: 'bg-brass text-navy' },
              { icon: <Building2 className="h-5 w-5" />, label: 'Conf.', path: '/admin/conference', color: 'bg-purple-600 text-white' },
            ].map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl ${action.color} active:scale-95 transition-transform`}
              >
                {action.icon}
                <span className="text-[10px] font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Bookings — compact list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Bookings</h2>
            <Link to="/admin/bookings" className="text-xs text-brass flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 text-sm">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {bookings?.slice(0, 4).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-navy">
                        {booking.guests?.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{booking.guests?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Room {booking.rooms?.room_number} · {booking.check_in}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-semibold">{formatCurrency(Number(booking.rate))}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                      booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP: Full grid layout ═══ */}
      <div className="hidden md:block">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your hotel performance</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
    </div>
  );
}
