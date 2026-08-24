import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { BedDouble, TrendingUp, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const COLORS = ['#1E3A5F', '#D4AF37', '#2A5A8A', '#E5C158', '#3B7BB9'];

interface RoomPerformanceProps {
  bookings: any[];
  rooms: any[];
}

export default function RoomPerformance({ bookings, rooms }: RoomPerformanceProps) {
  const metrics = useMemo(() => {
    if (!bookings?.length || !rooms?.length) return null;

    const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');
    const cancelledBookings = bookings.filter((b: any) => b.status === 'cancelled');
    const noShowBookings = bookings.filter((b: any) => b.status === 'no_show');
    const checkedIn = bookings.filter((b: any) => b.status === 'checked_in' || b.status === 'checked_out');

    // Total revenue
    const totalRevenue = activeBookings.reduce((sum: number, b: any) => {
      const nights = b.check_in && b.check_out
        ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
        : 1;
      return sum + (b.rate || 0) * nights;
    }, 0);

    // Revenue by room type
    const byType: Record<string, { revenue: number; count: number; totalNights: number }> = {};
    for (const b of activeBookings) {
      const typeName = b.room_types?.name || b.rooms?.room_types?.name || 'Unknown';
      if (!byType[typeName]) byType[typeName] = { revenue: 0, count: 0, totalNights: 0 };
      const nights = b.check_in && b.check_out
        ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
        : 1;
      byType[typeName].revenue += (b.rate || 0) * nights;
      byType[typeName].count++;
      byType[typeName].totalNights += nights;
    }

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'occupied').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // ADR & RevPAR
    const totalNightsSold = checkedIn.reduce((sum: number, b: any) => {
      const nights = b.check_in && b.check_out
        ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
        : 1;
      return sum + nights;
    }, 0);
    const adr = totalNightsSold > 0 ? Math.round(totalRevenue / totalNightsSold) : 0;
    const revpar = totalRooms > 0 ? Math.round(totalRevenue / (totalRooms * 30)) : 0; // monthly

    // Avg length of stay
    const avgLos = checkedIn.length > 0
      ? Math.round(totalNightsSold / checkedIn.length)
      : 0;

    // Booking sources
    const sources: Record<string, number> = {};
    for (const b of bookings) {
      const src = b.booking_source || 'direct';
      sources[src] = (sources[src] || 0) + 1;
    }

    // Cancellation rate
    const cancelRate = bookings.length > 0
      ? Math.round((cancelledBookings.length / bookings.length) * 100)
      : 0;
    const noShowRate = bookings.length > 0
      ? Math.round((noShowBookings.length / bookings.length) * 100)
      : 0;

    return {
      totalRevenue, occupancyRate, adr, revpar, avgLos,
      totalBookings: bookings.length, cancelRate, noShowRate,
      byType, sources, totalRooms, occupiedRooms,
    };
  }, [bookings, rooms]);

  if (!metrics) return <p className="text-muted-foreground text-center py-8">No room data available</p>;

  const typeRevenue = Object.entries(metrics.byType).map(([name, data]) => ({
    name, revenue: data.revenue, count: data.count, adr: data.count > 0 ? Math.round(data.revenue / data.totalNights) : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const sourceData = Object.entries(metrics.sources).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Total Revenue</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Occupancy</span></div>
          <p className="text-xl font-bold mt-1">{metrics.occupancyRate}%</p>
          <p className="text-[10px] text-muted-foreground">{metrics.occupiedRooms}/{metrics.totalRooms} rooms</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brass" /><span className="text-xs text-muted-foreground">ADR</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.adr)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">RevPAR</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.revpar)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Avg Stay</span></div>
          <p className="text-xl font-bold mt-1">{metrics.avgLos} nights</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Cancel Rate</span></div>
          <p className="text-xl font-bold mt-1">{metrics.cancelRate}%</p>
          <p className="text-[10px] text-muted-foreground">No-show: {metrics.noShowRate}%</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Room Type */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Room Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {typeRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Booking Sources */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Booking Sources</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} bookings`]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ADR by Type */}
        <Card>
          <CardHeader><CardTitle className="text-sm">ADR by Room Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'ADR']} />
                <Bar dataKey="adr" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bookings by Type */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Bookings by Room Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
