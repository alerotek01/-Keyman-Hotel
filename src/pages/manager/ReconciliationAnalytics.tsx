import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, differenceInHours, differenceInMinutes } from 'date-fns';
import {
  Loader2, TrendingUp, TrendingDown, AlertTriangle, Clock,
  DollarSign, BarChart3, Calendar, Download
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const CHART_COLORS = ['#1E3A5F', '#D4AF37', '#2A5A8A', '#E5C158', '#3B7BB9', '#4CAF50'];

const DEPT_COLORS: Record<string, string> = {
  'Restaurant': '#D4AF37',
  'Kitchen': '#8B5CF6',
  'Front Office': '#10B981',
  'Housekeeping': '#F59E0B',
};

export default function ReconciliationAnalytics() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch all reconciliations with shift info
  const { data: recons, isLoading } = useQuery({
    queryKey: ['recon-analytics', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(
            shift_date, shift_name, start_time, end_time,
            users:user_id(full_name, role),
            departments:department_id(name)
          )
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!recons) return [];
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    return recons.filter((r: any) => {
      const d = r.staff_shifts?.shift_date || '';
      return d >= fromStr && d <= toStr;
    });
  }, [recons, dateRange]);

  // ─── Computed Metrics ───────────────────────────────────────────────

  const metrics = useMemo(() => {
    if (!filtered.length) return null;

    const totalShifts = filtered.length;
    const totalSales = filtered.reduce((s: number, r: any) => s + (r.sales_total || 0), 0);
    const totalCash = filtered.reduce((s: number, r: any) => s + (r.cash_total || 0), 0);
    const totalMpesa = filtered.reduce((s: number, r: any) => s + (r.mpesa_total || 0), 0);
    const totalVariance = filtered.reduce((s: number, r: any) => s + (r.variance || 0), 0);
    const shortShifts = filtered.filter((r: any) => r.variance < 0).length;
    const overShifts = filtered.filter((r: any) => r.variance > 0).length;
    const balancedShifts = filtered.filter((r: any) => r.variance === 0).length;

    // Resolution time (from submission to reconciled)
    const resolved = filtered.filter((r: any) => ['reconciled', 'closed', 'approved'].includes(r.status));
    const resolutionTimes = resolved
      .filter((r: any) => r.created_at && r.reconciled_by)
      .map((r: any) => differenceInHours(new Date(r.created_at), new Date(r.created_at)));
    const avgResolutionHours = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a: number, b: number) => a + b, 0) / resolutionTimes.length
      : 0;

    // Variance rate
    const varianceRate = totalShifts > 0
      ? ((shortShifts + overShifts) / totalShifts * 100).toFixed(1)
      : '0';

    return {
      totalShifts, totalSales, totalCash, totalMpesa,
      totalVariance, shortShifts, overShifts, balancedShifts,
      avgResolutionHours, varianceRate,
    };
  }, [filtered]);

  // ─── Chart Data ─────────────────────────────────────────────────────

  // 1. Variance trend over time (daily aggregation)
  const varianceTrend = useMemo(() => {
    if (!filtered.length) return [];
    const byDate: Record<string, { date: string; variance: number; count: number; short: number; over: number }> = {};

    filtered.forEach((r: any) => {
      const d = r.staff_shifts?.shift_date || 'unknown';
      if (!byDate[d]) byDate[d] = { date: d, variance: 0, count: 0, short: 0, over: 0 };
      byDate[d].variance += r.variance || 0;
      byDate[d].count++;
      if (r.variance < 0) byDate[d].short++;
      if (r.variance > 0) byDate[d].over++;
    });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, date: format(new Date(d.date), 'MMM d') }));
  }, [filtered]);

  // 2. Department comparison
  const deptComparison = useMemo(() => {
    if (!filtered.length) return [];
    const byDept: Record<string, { dept: string; shifts: number; totalSales: number; totalVariance: number; avgVariance: number }> = {};

    filtered.forEach((r: any) => {
      const dept = r.staff_shifts?.departments?.name || 'Unknown';
      if (!byDept[dept]) byDept[dept] = { dept, shifts: 0, totalSales: 0, totalVariance: 0, avgVariance: 0 };
      byDept[dept].shifts++;
      byDept[dept].totalSales += r.sales_total || 0;
      byDept[dept].totalVariance += r.variance || 0;
    });

    return Object.values(byDept).map(d => ({
      ...d,
      avgVariance: d.shifts > 0 ? Math.round(d.totalVariance / d.shifts) : 0,
    }));
  }, [filtered]);

  // 3. Payment method distribution
  const paymentMethods = useMemo(() => {
    if (!filtered.length) return [];
    const cash = filtered.reduce((s: number, r: any) => s + (r.cash_total || 0), 0);
    const mpesa = filtered.reduce((s: number, r: any) => s + (r.mpesa_total || 0), 0);
    return [
      { name: 'Cash', value: cash, color: '#1E3A5F' },
      { name: 'M-Pesa', value: mpesa, color: '#D4AF37' },
    ];
  }, [filtered]);

  // 4. Role breakdown
  const roleBreakdown = useMemo(() => {
    if (!filtered.length) return [];
    const byRole: Record<string, { role: string; shifts: number; totalVariance: number }> = {};

    filtered.forEach((r: any) => {
      const role = r.staff_shifts?.users?.role || 'Unknown';
      if (!byRole[role]) byRole[role] = { role, shifts: 0, totalVariance: 0 };
      byRole[role].shifts++;
      byRole[role].totalVariance += r.variance || 0;
    });

    return Object.values(byRole);
  }, [filtered]);

  // 5. Status distribution
  const statusDist = useMemo(() => {
    if (!filtered.length) return [];
    const byStatus: Record<string, number> = {};
    filtered.forEach((r: any) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    const colors: Record<string, string> = {
      submitted: '#F59E0B', explained: '#3B82F6', flagged: '#EF4444',
      approved: '#10B981', reconciled: '#6B7280', closed: '#374151',
    };
    return Object.entries(byStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name] || '#9CA3AF',
    }));
  }, [filtered]);

  // ─── Export ──────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const lines = [
      'Keyman Hotel — Reconciliation Analytics Report',
      `Period: ${format(dateRange.from, 'MMM d, yyyy')} to ${format(dateRange.to, 'MMM d, yyyy')}`,
      '',
      'Summary',
      `Total Shifts,${metrics?.totalShifts || 0}`,
      `Total Sales,KES ${metrics?.totalSales || 0}`,
      `Total Cash,KES ${metrics?.totalCash || 0}`,
      `Total M-Pesa,KES ${metrics?.totalMpesa || 0}`,
      `Total Variance,KES ${metrics?.totalVariance || 0}`,
      `Variance Rate,${metrics?.varianceRate || 0}%`,
      '',
      'Department Comparison',
      'Department,Shifts,Total Sales,Avg Variance',
      ...deptComparison.map(d => `${d.dept},${d.shifts},KES ${d.totalSales},KES ${d.avgVariance}`),
      '',
      'Role Breakdown',
      'Role,Shifts,Total Variance',
      ...roleBreakdown.map(r => `${r.role},${r.shifts},KES ${r.totalVariance}`),
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-analytics-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Reconciliation Analytics</h1>
          <p className="text-muted-foreground">Variance trends, department performance, and resolution metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={format(dateRange.from, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              value={format(dateRange.to, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          {/* Quick Presets */}
          <div className="flex gap-1">
            {[
              { label: '7d', days: 7 },
              { label: '14d', days: 14 },
              { label: '30d', days: 30 },
            ].map(p => (
              <Button
                key={p.days}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setDateRange({ from: subDays(new Date(), p.days), to: new Date() })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brass" />
                <span className="text-xs text-muted-foreground">Total Shifts</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.totalShifts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Total Sales</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalSales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Short Shifts</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-600">{metrics.shortShifts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Over Shifts</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-600">{metrics.overShifts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Variance Rate</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.varianceRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Avg Resolution</span>
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.avgResolutionHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Variance Trend — Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Variance Trend (Daily)</CardTitle>
          </CardHeader>
          <CardContent>
            {varianceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={varianceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Variance']}
                  />
                  <Area type="monotone" dataKey="variance" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data for selected period</p>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution — Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} shifts`]} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Department Comparison — Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Department Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {deptComparison.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number, name: string) => [
                      name === 'totalSales' ? `KES ${value.toLocaleString()}` : value,
                      name === 'totalSales' ? 'Total Sales' : name === 'shifts' ? 'Shifts' : 'Avg Variance'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="shifts" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Shifts" />
                  <Bar dataKey="avgVariance" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Avg Variance" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods — Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {paymentMethods.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Role Variance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {roleBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={roleBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="role" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Total Variance']}
                  />
                  <Bar dataKey="totalVariance" radius={[0, 4, 4, 0]}>
                    {roleBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.totalVariance < 0 ? '#EF4444' : entry.totalVariance > 0 ? '#F59E0B' : '#10B981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Variance Staff */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Staff with Most Variances</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length > 0 ? (() => {
              const byStaff: Record<string, { name: string; role: string; variances: number; count: number; total: number }> = {};
              filtered.forEach((r: any) => {
                const name = r.staff_shifts?.users?.full_name || 'Unknown';
                const role = r.staff_shifts?.users?.role || '';
                if (!byStaff[name]) byStaff[name] = { name, role, variances: 0, count: 0, total: 0 };
                byStaff[name].count++;
                byStaff[name].total += r.variance || 0;
                if (r.variance !== 0) byStaff[name].variances++;
              });
              const sorted = Object.values(byStaff)
                .sort((a, b) => b.variances - a.variances)
                .slice(0, 8);

              return (
                <div className="space-y-2">
                  {sorted.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s.role} · {s.count} shifts</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={s.total < 0 ? 'destructive' : s.total > 0 ? 'default' : 'secondary'}>
                          {s.variances} variances
                        </Badge>
                        <p className={cn('text-xs mt-1', s.total < 0 ? 'text-red-600' : s.total > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                          {s.total >= 0 ? '+' : ''}KES {s.total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : (
              <p className="text-muted-foreground text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
