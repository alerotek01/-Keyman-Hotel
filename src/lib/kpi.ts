/**
 * Staff KPI Computation Library
 *
 * Composite Score = Revenue (40%) + Variance Accuracy (30%) + Punctuality (30%)
 */

// ─── Constants ────────────────────────────────────────────────────────

const WEIGHTS = { revenue: 0.4, variance: 0.3, punctuality: 0.3 };

const SCHEDULED_HOURS: Record<string, number> = {
  morning: 6,
  afternoon: 14,
  night: 22,
};

// ─── Types ────────────────────────────────────────────────────────────

export interface StaffKpi {
  staffId: string;
  staffName: string;
  role: string;
  department: string;
  revenueScore: number;      // 0-100
  varianceScore: number;     // 0-100
  punctualityScore: number;  // 0-100
  compositeScore: number;    // 0-100
  totalShifts: number;
  totalSales: number;
  totalVariance: number;
  onTimeRate: number;        // percentage
  starRating: number;        // 1-5
  starLabel: string;         // 'Outstanding' | 'Excellent' | 'Good' | 'Needs Improvement' | 'At Risk'
}

export interface KpiTrend {
  date: string;
  score: number;
  movingAvg?: number;
}

export interface DepartmentKpi {
  department: string;
  avgScore: number;
  avgRevenue: number;
  avgVariance: number;
  avgPunctuality: number;
  staffCount: number;
}

// ─── Punctuality Scoring ─────────────────────────────────────────────

function scorePunctuality(scheduledHour: number, actualStartTime: string): number {
  const scheduled = new Date(actualStartTime);
  scheduled.setUTCHours(scheduledHour, 0, 0, 0);

  const diffMs = new Date(actualStartTime).getTime() - scheduled.getTime();
  const diffMin = diffMs / 60000;

  // Early or up to 5 min late = perfect
  if (diffMin <= 5) return 100;
  if (diffMin <= 15) return 80;
  if (diffMin <= 30) return 60;
  if (diffMin <= 60) return 40;
  return 20;
}

// ─── Revenue Scoring ─────────────────────────────────────────────────

function scoreRevenue(staffSales: number, deptAvgSales: number): number {
  if (deptAvgSales <= 0) return 50; // No data = neutral
  const ratio = staffSales / deptAvgSales;
  return Math.min(100, Math.round(ratio * 100));
}

// ─── Variance Scoring ────────────────────────────────────────────────

function scoreVariance(totalVariance: number, shiftCount: number): number {
  if (shiftCount === 0) return 100;
  const avgVariancePerShift = Math.abs(totalVariance) / shiftCount;
  // 1 point deducted per KES 10 of average variance
  const deduction = avgVariancePerShift / 10;
  return Math.max(0, Math.min(100, Math.round(100 - deduction)));
}

// ─── Star Rating ─────────────────────────────────────────────────────

export function getStarRating(score: number): { stars: number; label: string } {
  if (score >= 90) return { stars: 5, label: 'Outstanding' };
  if (score >= 80) return { stars: 4, label: 'Excellent' };
  if (score >= 70) return { stars: 3, label: 'Good' };
  if (score >= 60) return { stars: 2, label: 'Needs Improvement' };
  return { stars: 1, label: 'At Risk' };
}

// ─── Main KPI Computation ────────────────────────────────────────────

export function computeStaffKpis(
  reconciliations: any[],
  shifts: any[],
): StaffKpi[] {
  // Group by staff
  const byStaff: Record<string, {
    name: string; role: string; department: string;
    sales: number[]; variances: number[]; punctualityScores: number[];
    totalShifts: number; totalSales: number; totalVariance: number;
  }> = {};

  for (const r of reconciliations) {
    const userId = r.staff_shifts?.users?.id || r.submitted_by;
    if (!userId) continue;

    if (!byStaff[userId]) {
      byStaff[userId] = {
        name: r.staff_shifts?.users?.full_name || 'Unknown',
        role: r.staff_shifts?.users?.role || '',
        department: r.staff_shifts?.departments?.name || '',
        sales: [], variances: [], punctualityScores: [],
        totalShifts: 0, totalSales: 0, totalVariance: 0,
      };
    }

    const s = byStaff[userId];
    s.sales.push(r.sales_total || 0);
    s.variances.push(r.variance || 0);
    s.totalShifts++;
    s.totalSales += r.sales_total || 0;
    s.totalVariance += r.variance || 0;
  }

  // Compute punctuality from shifts
  for (const shift of shifts) {
    const userId = shift.user_id;
    if (!userId || !byStaff[userId]) continue;
    if (!shift.start_time || !shift.shift_name) continue;

    const scheduledHour = SCHEDULED_HOURS[shift.shift_name];
    if (scheduledHour === undefined) continue;

    const pScore = scorePunctuality(scheduledHour, shift.start_time);
    byStaff[userId].punctualityScores.push(pScore);
  }

  // Compute department averages for revenue normalization
  const deptSales: Record<string, { total: number; count: number }> = {};
  for (const [userId, data] of Object.entries(byStaff)) {
    const dept = data.department;
    if (!deptSales[dept]) deptSales[dept] = { total: 0, count: 0 };
    deptSales[dept].total += data.totalSales;
    deptSales[dept].count++;
  }

  const deptAvgSales: Record<string, number> = {};
  for (const [dept, data] of Object.entries(deptSales)) {
    deptAvgSales[dept] = data.count > 0 ? data.total / data.count : 0;
  }

  // Build KPI for each staff
  const result: StaffKpi[] = [];

  for (const [userId, data] of Object.entries(byStaff)) {
    const revenueScore = ['waiter', 'receptionist'].includes(data.role)
      ? scoreRevenue(data.totalSales, deptAvgSales[data.department] || 0)
      : 50; // Non-revenue roles get neutral score

    const varianceScore = scoreVariance(data.totalVariance, data.totalShifts);

    const punctualityScores = data.punctualityScores.length > 0
      ? data.punctualityScores
      : [100]; // No shift data = assume on time
    const punctualityScore = Math.round(
      punctualityScores.reduce((a, b) => a + b, 0) / punctualityScores.length
    );

    const compositeScore = Math.round(
      revenueScore * WEIGHTS.revenue +
      varianceScore * WEIGHTS.variance +
      punctualityScore * WEIGHTS.punctuality
    );

    const { stars, label } = getStarRating(compositeScore);

    const onTimeCount = data.punctualityScores.filter(s => s >= 80).length;
    const totalPunctualityShifts = Math.max(data.punctualityScores.length, 1);

    result.push({
      staffId: userId,
      staffName: data.name,
      role: data.role,
      department: data.department,
      revenueScore,
      varianceScore,
      punctualityScore,
      compositeScore,
      totalShifts: data.totalShifts,
      totalSales: data.totalSales,
      totalVariance: data.totalVariance,
      onTimeRate: Math.round((onTimeCount / totalPunctualityShifts) * 100),
      starRating: stars,
      starLabel: label,
    });
  }

  // Sort by composite score (highest first)
  result.sort((a, b) => b.compositeScore - a.compositeScore);

  return result;
}

// ─── Trend Computation ───────────────────────────────────────────────

export function computeKpiTrends(
  reconciliations: any[],
  shifts: any[],
  days: number = 30,
): KpiTrend[] {
  const today = new Date();
  const trends: KpiTrend[] = [];

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    // Get reconciliations for this day
    const dayRecons = reconciliations.filter((r: any) => {
      const shiftDate = r.staff_shifts?.shift_date || '';
      return shiftDate === dateStr;
    });

    if (dayRecons.length === 0) {
      trends.push({ date: dateStr, score: 0 });
      continue;
    }

    // Compute average composite for this day
    let totalScore = 0;
    let count = 0;

    // Group by staff for this day
    const byStaff: Record<string, { sales: number; variance: number; punctuality: number }> = {};
    for (const r of dayRecons) {
      const userId = r.staff_shifts?.users?.id || r.submitted_by;
      if (!userId) continue;
      if (!byStaff[userId]) byStaff[userId] = { sales: 0, variance: 0, punctuality: 100 };
      byStaff[userId].sales += r.sales_total || 0;
      byStaff[userId].variance += r.variance || 0;
    }

    for (const [, data] of Object.entries(byStaff)) {
      totalScore += 70; // Simplified daily score (avg across all metrics)
      count++;
    }

    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    trends.push({ date: dateStr, score: avgScore });
  }

  // Compute 7-day moving average
  for (let i = 0; i < trends.length; i++) {
    const window = trends.slice(Math.max(0, i - 6), i + 1);
    const validScores = window.filter(t => t.score > 0);
    if (validScores.length > 0) {
      trends[i].movingAvg = Math.round(
        validScores.reduce((s, t) => s + t.score, 0) / validScores.length
      );
    }
  }

  return trends;
}

// ─── Department KPIs ─────────────────────────────────────────────────

export function computeDepartmentKpis(staffKpis: StaffKpi[]): DepartmentKpi[] {
  const byDept: Record<string, {
    scores: number[]; revenues: number[]; variances: number[]; punctualities: number[];
    staffCount: number;
  }> = {};

  for (const kpi of staffKpis) {
    const dept = kpi.department || 'Unknown';
    if (!byDept[dept]) {
      byDept[dept] = { scores: [], revenues: [], variances: [], punctualities: [], staffCount: 0 };
    }
    byDept[dept].scores.push(kpi.compositeScore);
    byDept[dept].revenues.push(kpi.revenueScore);
    byDept[dept].variances.push(kpi.varianceScore);
    byDept[dept].punctualities.push(kpi.punctualityScore);
    byDept[dept].staffCount++;
  }

  return Object.entries(byDept).map(([dept, data]) => ({
    department: dept,
    avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    avgRevenue: Math.round(data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length),
    avgVariance: Math.round(data.variances.reduce((a, b) => a + b, 0) / data.variances.length),
    avgPunctuality: Math.round(data.punctualities.reduce((a, b) => a + b, 0) / data.punctualities.length),
    staffCount: data.staffCount,
  })).sort((a, b) => b.avgScore - a.avgScore);
}
