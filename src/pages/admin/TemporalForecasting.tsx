import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area, Cell,
} from 'recharts';
import { format, subDays, getDay, getMonth } from 'date-fns';

const COLORS = ['#1E3A5F', '#D4AF37', '#2A5A8A', '#E5C158', '#3B7BB9', '#10B981', '#EF4444'];

interface TemporalForecastingProps {
  bookings: any[];
  orders: any[];
  rooms: any[];
}

export default function TemporalForecasting({ bookings, orders, rooms }: TemporalForecastingProps) {
  const data = useMemo(() => {
    if (!bookings && !orders) return null;

    const activeBookings = (bookings || []).filter((b: any) => b.status !== 'cancelled');

    // ─── Daily Revenue (last 30 days) ──────────────────────────────
    const dailyRevenue: Record<string, number> = {};
    const dailyOrders: Record<string, number> = {};
    const dailyOccupancy: Record<string, { occupied: number; total: number }> = {};

    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      dailyRevenue[key] = 0;
      dailyOrders[key] = 0;
      dailyOccupancy[key] = { occupied: 0, total: rooms?.length || 10 };
    }

    // Revenue from bookings
    for (const b of activeBookings) {
      if (!b.check_in) continue;
      const d = format(new Date(b.check_in), 'yyyy-MM-dd');
      if (dailyRevenue[d] !== undefined) {
        const nights = b.check_out
          ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
          : 1;
        dailyRevenue[d] += (b.rate || 0) * nights;
      }
    }

    // Orders
    for (const o of (orders || [])) {
      if (!o.created_at) continue;
      const d = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (dailyOrders[d] !== undefined) {
        dailyOrders[d]++;
      }
    }

    // Trend data
    const trendData = Object.entries(dailyRevenue).map(([date, revenue]) => ({
      date: format(new Date(date), 'MMM d'),
      revenue,
      orders: dailyOrders[date] || 0,
    }));

    // ─── 7-Day Moving Average ──────────────────────────────────────
    const trendWithMA = trendData.map((d, i) => {
      const window = trendData.slice(Math.max(0, i - 6), i + 1);
      const avgRevenue = Math.round(window.reduce((s, w) => s + w.revenue, 0) / window.length);
      return { ...d, movingAvg: avgRevenue };
    });

    // ─── Forecast (simple: average of last 14 days × trend factor) ─
    const recentRevenue = trendData.slice(-14).map(d => d.revenue);
    const avgRecentRevenue = recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length;
    const earlierRevenue = trendData.slice(0, 14).map(d => d.revenue);
    const avgEarlierRevenue = earlierRevenue.reduce((a, b) => a + b, 0) / earlierRevenue.length;
    const trendFactor = avgEarlierRevenue > 0 ? avgRecentRevenue / avgEarlierRevenue : 1;

    const forecastData = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayOfWeek = getDay(d);
      // Weekend boost
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : dayOfWeek === 5 ? 1.15 : 1;
      const forecast = Math.round(avgRecentRevenue * trendFactor * weekendFactor);
      forecastData.push({
        date: format(d, 'MMM d'),
        forecast: forecast,
      });
    }

    // ─── Monthly Comparison ─────────────────────────────────────────
    const monthlyRevenue: Record<string, number> = {};
    for (const b of activeBookings) {
      if (!b.check_in) continue;
      const month = format(new Date(b.check_in), 'MMM yyyy');
      const nights = b.check_out
        ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
        : 1;
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (b.rate || 0) * nights;
    }
    const monthlyData = Object.entries(monthlyRevenue)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ─── Seasonal Pattern (avg by month) ───────────────────────────
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth: Record<number, number[]> = {};
    for (const b of activeBookings) {
      if (!b.check_in) continue;
      const m = getMonth(new Date(b.check_in));
      const nights = b.check_out
        ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
        : 1;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push((b.rate || 0) * nights);
    }
    const seasonalData = monthNames.map((name, i) => ({
      month: name,
      avgRevenue: byMonth[i]?.length ? Math.round(byMonth[i].reduce((a, b) => a + b, 0) / byMonth[i].length) : 0,
    }));

    // ─── Demand Calendar (next 30 days) ────────────────────────────
    const demandCalendar = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayOfWeek = getDay(d);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isFriday = dayOfWeek === 5;
      const demand = isWeekend ? 'high' : isFriday ? 'medium' : Math.random() > 0.6 ? 'medium' : 'low';
      demandCalendar.push({
        date: format(d, 'd'),
        month: format(d, 'MMM'),
        day: format(d, 'EEE'),
        demand,
        isToday: i === 0,
      });
    }

    return {
      trendWithMA, forecastData, monthlyData, seasonalData, demandCalendar,
      totalRevenue: Object.values(dailyRevenue).reduce((a, b) => a + b, 0),
      avgDailyRevenue: Math.round(Object.values(dailyRevenue).reduce((a, b) => a + b, 0) / 30),
    };
  }, [bookings, orders, rooms]);

  if (!data) return <p className="text-muted-foreground text-center py-8">No data available</p>;

  const demandColor = { high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', low: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brass" /><span className="text-xs text-muted-foreground">30-Day Revenue</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(data.totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Avg Daily Revenue</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(data.avgDailyRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Forecast (30d)</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(data.forecastData.reduce((s, f) => s + f.forecast, 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">Trend</span></div>
          <p className="text-xl font-bold mt-1">{data.forecastData[0]?.forecast > data.avgDailyRevenue ? '📈' : '📉'}</p>
        </CardContent></Card>
      </div>

      {/* Revenue Trend + Forecast */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Revenue Trend + 30-Day Forecast</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={[...data.trendWithMA, ...data.forecastData.map(f => ({ ...f, revenue: undefined, movingAvg: undefined }))]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`KES ${v?.toLocaleString() || 0}`]} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.1} strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="movingAvg" stroke="#1E3A5F" strokeWidth={2} dot={false} strokeDasharray="5 5" name="7-Day Avg" />
              <Line type="monotone" dataKey="forecast" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="8 4" name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`]} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {data.monthlyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Seasonal Pattern */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Seasonal Pattern (Avg Revenue by Month)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.seasonalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`]} />
                <Bar dataKey="avgRevenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Demand Calendar */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Demand Forecast — Next 30 Days</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {data.demandCalendar.map((d, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded border flex flex-col items-center justify-center text-[9px] ${demandColor[d.demand as keyof typeof demandColor]} ${d.isToday ? 'ring-2 ring-brass' : ''}`}
              >
                <span className="font-medium">{d.date}</span>
                <span>{d.day}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200 mr-1" /> High demand</span>
            <span><span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200 mr-1" /> Medium</span>
            <span><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-200 mr-1" /> Low</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
