import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDailyReport } from '@/hooks/useDailyReport';
import { formatCurrency } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  BedDouble, CalendarCheck, TrendingUp, Users, Loader2, ArrowRight,
  BarChart3, UtensilsCrossed, Sparkles, DollarSign, CreditCard,
  ShoppingCart, CheckCircle2, Clock, AlertCircle, Home, XCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function ManagerDashboard() {
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfDay(now) };
      case 'all':
        return { from: new Date('2024-01-01'), to: endOfDay(now) };
      default:
        if (customFrom && customTo) {
          return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
        }
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  };

  const { from, to } = getDateRange();
  const { data: report, isLoading } = useDailyReport(from, to);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load daily report</p>
      </div>
    );
  }

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">
            {format(from, 'MMM d')} — {format(to, 'MMM d, yyyy')} · Keyman Hotel overview
          </p>
        </div>
        <Link to="/manager/reports">
          <Button variant="brass">
            <BarChart3 className="mr-2 h-4 w-4" />
            Full Reports
          </Button>
        </Link>
      </div>

      {/* Date Preset Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Button
            key={p.key}
            variant={datePreset === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset(p.key)}
            className={datePreset === p.key ? 'bg-navy text-white' : ''}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setDatePreset('today'); }}
            className="border rounded px-2 py-1 text-sm"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setDatePreset('today'); }}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* OCCUPANCY SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-brass" />
          Occupancy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{report.occupancyRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Occupancy Rate</p>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-brass h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, report.occupancyRate)}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{report.occupiedRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">Occupied</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{report.availableRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{report.dirtyRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">Needs Cleaning</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{report.outOfOrderRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">Out of Order</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* REVENUE SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-500" />
          Revenue & Payments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-brass" />
                  <span className="text-sm">Room Charges</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.roomCharges)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Restaurant</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.restaurantCharges)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Services</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.serviceCharges)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-semibold">Total Charges</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(report.totalCharges)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">M-Pesa</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.mpesaPayments)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Cash</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.cashPayments)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <span className="text-sm">Card</span>
                </div>
                <span className="font-mono font-semibold">{formatCurrency(report.cardPayments)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-semibold">Total Collected</span>
                <span className="font-mono font-bold text-lg text-green-600">{formatCurrency(report.totalPayments)}</span>
              </div>
              {report.totalCharges > report.totalPayments && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                  <p className="text-sm font-medium text-red-800">
                    Outstanding: {formatCurrency(report.totalCharges - report.totalPayments)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOOKINGS & ORDERS SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-500" />
            Bookings
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-0">
                <div className="p-4 text-center border-r border-b">
                  <p className="text-2xl font-bold">{report.totalReservations}</p>
                  <p className="text-xs text-muted-foreground">Total Reservations</p>
                </div>
                <div className="p-4 text-center border-b">
                  <p className="text-2xl font-bold text-green-600">{report.newBookings}</p>
                  <p className="text-xs text-muted-foreground">New Bookings</p>
                </div>
                <div className="p-4 text-center border-r">
                  <p className="text-2xl font-bold text-blue-600">{report.checkedInToday}</p>
                  <p className="text-xs text-muted-foreground">Checked In</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{report.checkedOutToday}</p>
                  <p className="text-xs text-muted-foreground">Checked Out</p>
                </div>
              </div>
              {report.cancellations > 0 && (
                <div className="p-3 border-t bg-red-50/50 text-center">
                  <p className="text-sm text-red-700">
                    <XCircle className="inline h-4 w-4 mr-1" />
                    {report.cancellations} cancellation{report.cancellations > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Restaurant Orders */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-orange-500" />
            Restaurant Orders
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-0">
                <div className="p-4 text-center border-r border-b">
                  <p className="text-2xl font-bold">{report.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
                <div className="p-4 text-center border-b">
                  <p className="text-2xl font-bold text-green-600">{report.ordersDelivered}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="p-4 text-center border-r">
                  <p className="text-2xl font-bold text-amber-600">{report.ordersPending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(report.restaurantRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
              {report.ordersCancelled > 0 && (
                <div className="p-3 border-t bg-red-50/50 text-center">
                  <p className="text-sm text-red-700">
                    <XCircle className="inline h-4 w-4 mr-1" />
                    {report.ordersCancelled} cancelled
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HOUSEKEEPING SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Housekeeping
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{report.totalTasks}</p>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">{report.pendingTasks}</p>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Loader2 className="h-4 w-4 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600">{report.inProgressTasks}</p>
              </div>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-2xl font-bold text-green-600">{report.completedTasks}</p>
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 7-DAY TREND */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brass" />
          7-Day Trend
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Occupancy Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Occupancy Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {report.dailyOccupancy.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-brass/80 rounded-t"
                      style={{ height: `${Math.max(4, day.rate)}%` }}
                      title={`${day.occupied}/${day.total} rooms (${day.rate.toFixed(0)}%)`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(day.date), 'EEE')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {report.dailyRevenue.map((day) => {
                  const maxRev = Math.max(...report.dailyRevenue.map(d => d.charges), 1);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-emerald-500/80 rounded-t"
                        style={{ height: `${Math.max(4, (day.charges / maxRev) * 100)}%` }}
                        title={`Charges: ${formatCurrency(day.charges)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(day.date), 'EEE')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Orders Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {report.dailyOrders.map((day) => {
                  const maxOrders = Math.max(...report.dailyOrders.map(d => d.count), 1);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-orange-500/80 rounded-t"
                        style={{ height: `${Math.max(4, (day.count / maxOrders) * 100)}%` }}
                        title={`${day.count} orders`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(day.date), 'EEE')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
