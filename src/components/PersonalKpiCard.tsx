import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { computeStaffKpis, getStarRating } from '@/lib/kpi';
import { format, subDays } from 'date-fns';
import { Loader2, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function PersonalKpiCard() {
  const { user, displayName, role } = useAuth();

  const { data: kpi, isLoading } = useQuery({
    queryKey: ['personal-kpi', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const fromStr = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      const { data: recons } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(
            shift_date, shift_name, start_time, end_time, user_id,
            users:user_id(id, full_name, role),
            departments:department_id(name)
          )
        `)
        .gte('staff_shifts.shift_date', fromStr);

      const { data: shifts } = await sb
        .from('staff_shifts')
        .select('id, user_id, shift_name, shift_date, start_time, end_time, status')
        .gte('shift_date', fromStr);

      const kpis = computeStaffKpis(recons || [], shifts || []);
      return kpis.find(k => k.staffId === user.id) || null;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="p-3 bg-muted/50 rounded-xl border flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-brass" />
      </div>
    );
  }

  if (!kpi) return null;

  const { stars, label } = getStarRating(kpi.compositeScore);
  const trend = kpi.compositeScore >= 80 ? 'up' : kpi.compositeScore >= 60 ? 'stable' : 'down';

  // Mini radar SVG
  const size = 60;
  const cx = size / 2;
  const cy = size / 2;
  const r = 22;
  const angles = [0, 120, 240].map(a => (a - 90) * Math.PI / 180);
  const values = [kpi.revenueScore, kpi.varianceScore, kpi.punctualityScore];
  const points = angles.map((a, i) => `${cx + r * (values[i] / 100) * Math.cos(a)},${cy + r * (values[i] / 100) * Math.sin(a)}`).join(' ');

  return (
    <div className="p-3 bg-gradient-to-br from-brass/5 to-amber-50 rounded-xl border border-brass/20">
      <div className="flex items-center gap-3">
        {/* Mini Radar */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circles */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />
          <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />
          <circle cx={cx} cy={cy} r={r * 0.33} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />
          {/* Axes */}
          {angles.map((a, i) => (
            <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#e5e7eb" strokeWidth={0.5} />
          ))}
          {/* Data polygon */}
          <polygon points={points} fill="#D4AF37" fillOpacity={0.2} stroke="#D4AF37" strokeWidth={1.5} />
          {/* Labels */}
          <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize={6} fill="#6b7280">R</text>
          <text x={cx + r * Math.cos(angles[1]) + 8} y={cy + r * Math.sin(angles[1]) + 2} fontSize={6} fill="#6b7280">V</text>
          <text x={cx + r * Math.cos(angles[2]) - 8} y={cy + r * Math.sin(angles[2]) + 2} fontSize={6} fill="#6b7280">P</text>
        </svg>

        {/* Score */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold text-brass">{kpi.compositeScore}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn('h-3 w-3', i < stars ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
              ))}
            </div>
            {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
            {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            {trend === 'stable' && <Minus className="h-3.5 w-3.5 text-amber-500" />}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label} · Last 30 days</p>
          <div className="flex gap-2 mt-1 text-[9px] text-muted-foreground">
            <span>R:{kpi.revenueScore}</span>
            <span>V:{kpi.varianceScore}</span>
            <span>P:{kpi.punctualityScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
