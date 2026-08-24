import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { computeStaffKpis, computeKpiTrends, computeDepartmentKpis, getStarRating, type StaffKpi } from '@/lib/kpi';
import { format, subDays } from 'date-fns';
import {
  Loader2, TrendingUp, TrendingDown, Users, Award, Clock,
  DollarSign, AlertTriangle, Star, BarChart3, Calendar
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const DEPT_COLORS: Record<string, string> = {
  'Restaurant': '#D4AF37',
  'Kitchen': '#8B5CF6',
  'Front Office': '#10B981',
  'Housekeeping': '#F59E0B',
  'Unknown': '#9CA3AF',
};

export default function KpiDashboard() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  // Fetch reconciliations
  const { data: recons, isLoading: reconsLoading } = useQuery({
    queryKey: ['kpi-recons', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(
            shift_date, shift_name, start_time, end_time, user_id,
            users:user_id(id, full_name, role),
            departments:department_id(name)
          )
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch shifts for punctuality
  const { data: shifts } = useQuery({
    queryKey: ['kpi-shifts', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await sb
        .from('staff_shifts')
        .select('id, user_id, shift_name, shift_date, start_time, end_time, status')
        .order('shift_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredRecons = useMemo(() => {
    if (!recons) return [];
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    return recons.filter((r: any) => {
      const d = r.staff_shifts?.shift_date || '';
      return d >= fromStr && d <= toStr;
    });
  }, [recons, dateRange]);

  const filteredShifts = useMemo(() => {
    if (!shifts) return [];
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    return shifts.filter((s: any) => {
      const d = s.shift_date || '';
      return d >= fromStr && d <= toStr;
    });
  }, [shifts, dateRange]);

  // Compute KPIs
  const staffKpis = useMemo(() => {
    const kpis = computeStaffKpis(filteredRecons, filteredShifts);
    if (deptFilter) return kpis.filter(k => k.department === deptFilter);
    return kpis;
  }, [filteredRecons, filteredShifts, deptFilter]);

  const deptKpis = useMemo(() => computeDepartmentKpis(staffKpis), [staffKpis]);
  const trends = useMemo(() => computeKpiTrends(filteredRecons, filteredShifts, 30), [filteredRecons, filteredShifts]);

  // Selected staff radar data
  const selectedKpi = staffKpis.find(k => k.staffId === selectedStaff);
  const radarData = selectedKpi ? [
    { metric: 'Revenue', value: selectedKpi.revenueScore, fullMark: 100 },
    { metric: 'Variance', value: selectedKpi.varianceScore, fullMark: 100 },
    { metric: 'Punctuality', value: selectedKpi.punctualityScore, fullMark: 100 },
  ] : [];

  // Overview stats
  const avgScore = staffKpis.length > 0
    ? Math.round(staffKpis.reduce((s, k) => s + k.compositeScore, 0) / staffKpis.length)
    : 0;
  const topPerformer = staffKpis[0];
  const atRisk = staffKpis.filter(k => k.compositeScore < 60);

  // Unique departments
  const departments = useMemo(() => {
    const depts = new Set(staffKpis.map(k => k.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [staffKpis]);

  if (reconsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Staff Performance KPIs</h1>
          <p className="text-muted-foreground">Revenue, variance accuracy, and punctuality metrics</p>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex gap-1">
            {[7, 14, 30].map(d => (
              <Button key={d} variant="outline" size="sm" className="h-8 text-xs"
                onClick={() => setDateRange({ from: subDays(new Date(), d), to: new Date() })}>
                {d}d
              </Button>
            ))}
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brass" />
              <span className="text-xs text-muted-foreground">Staff Members</span>
            </div>
            <p className="text-2xl font-bold mt-1">{staffKpis.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Avg Score</span>
            </div>
            <p className="text-2xl font-bold mt-1">{avgScore}</p>
          </CardContent>
        </Card>
        <Card className={topPerformer ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Top Performer</span>
            </div>
            <p className="text-lg font-bold mt-1">{topPerformer?.staffName || '—'}</p>
            <p className="text-xs text-muted-foreground">{topPerformer?.compositeScore || 0} pts</p>
          </CardContent>
        </Card>
        <Card className={atRisk.length > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">At Risk</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{atRisk.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Radar Chart (Selected Staff or Top Performer) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Performance Radar</span>
              {selectedKpi && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedStaff(null)}>
                  Clear selection
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedKpi ? (
              <>
                <div className="text-center mb-3">
                  <p className="font-semibold">{selectedKpi.staffName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedKpi.role} · {selectedKpi.department}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('h-4 w-4', i < selectedKpi.starRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
                    ))}
                    <span className="text-sm font-bold ml-1">{selectedKpi.compositeScore}</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-bold">{selectedKpi.revenueScore}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Variance</p>
                    <p className="font-bold">{selectedKpi.varianceScore}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Punctuality</p>
                    <p className="font-bold">{selectedKpi.punctualityScore}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Click a staff member to view their radar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Score Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.some(t => t.score > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => format(new Date(d), 'MMM d')}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    labelFormatter={(d) => format(new Date(d), 'MMM d, yyyy')}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#D4AF37" strokeWidth={2} dot={false} name="Daily Score" />
                  <Line type="monotone" dataKey="movingAvg" stroke="#1E3A5F" strokeWidth={2} dot={false} strokeDasharray="5 5" name="7-Day Avg" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No trend data for selected period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Staff Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {staffKpis.length > 0 ? (
              <div className="space-y-2">
                {staffKpis.map((kpi, i) => (
                  <div
                    key={kpi.staffId}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50',
                      selectedStaff === kpi.staffId && 'ring-2 ring-brass bg-brass/5'
                    )}
                    onClick={() => setSelectedStaff(kpi.staffId === selectedStaff ? null : kpi.staffId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{kpi.staffName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{kpi.role} · {kpi.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star key={si} className={cn('h-3 w-3', si < kpi.starRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
                        ))}
                      </div>
                      <Badge variant={kpi.compositeScore >= 80 ? 'default' : kpi.compositeScore >= 60 ? 'secondary' : 'destructive'}>
                        {kpi.compositeScore}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No staff data for selected period</p>
            )}
          </CardContent>
        </Card>

        {/* Department Averages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Department Averages</CardTitle>
          </CardHeader>
          <CardContent>
            {deptKpis.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptKpis} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="department" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => [`${value}`, 'Avg Score']}
                  />
                  <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                    {deptKpis.map((entry) => (
                      <Cell key={entry.department} fill={DEPT_COLORS[entry.department] || '#9CA3AF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No department data</p>
            )}

            {/* Department Details */}
            {deptKpis.length > 0 && (
              <div className="mt-4 space-y-2">
                {deptKpis.map(d => (
                  <div key={d.department} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">{d.department}</p>
                      <p className="text-muted-foreground">{d.staffCount} staff</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{d.avgScore}</p>
                      <p className="text-muted-foreground">R:{d.avgRevenue} V:{d.avgVariance} P:{d.avgPunctuality}</p>
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
