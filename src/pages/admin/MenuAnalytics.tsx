import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { UtensilsCrossed, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend,
} from 'recharts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const COLORS = ['#1E3A5F', '#D4AF37', '#2A5A8A', '#E5C158', '#3B7BB9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function MenuAnalytics() {
  const { data: orders } = useQuery({
    queryKey: ['menu-analytics-orders'],
    queryFn: async () => {
      const { data } = await sb
        .from('restaurant_orders')
        .select('id, total, created_at, status, restaurant_order_items(quantity, menu_items(name, price, cost))')
        .eq('status', 'delivered');
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    if (!orders?.length) return null;

    // Item stats
    const itemStats: Record<string, { name: string; count: number; revenue: number; cost: number; price: number }> = {};
    const combos: Record<string, number> = {};
    const hourlyOrders: Record<number, number> = {};
    const dayOrders: Record<string, number> = {};

    for (const order of orders) {
      const items = order.restaurant_order_items || [];
      const itemNames: string[] = [];

      for (const item of items) {
        const mi = item.menu_items;
        if (!mi) continue;
        const name = mi.name;
        if (!itemStats[name]) itemStats[name] = { name, count: 0, revenue: 0, cost: 0, price: mi.price || 0 };
        itemStats[name].count += item.quantity || 1;
        itemStats[name].revenue += (mi.price || 0) * (item.quantity || 1);
        itemStats[name].cost += (mi.cost || 0) * (item.quantity || 1);
        itemNames.push(name);
      }

      // Combos (items in same order)
      for (let i = 0; i < itemNames.length; i++) {
        for (let j = i + 1; j < itemNames.length; j++) {
          const key = [itemNames[i], itemNames[j]].sort().join(' + ');
          combos[key] = (combos[key] || 0) + 1;
        }
      }

      // Hour of day
      if (order.created_at) {
        const hour = new Date(order.created_at).getUTCHours();
        hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
      }

      // Day of week
      if (order.created_at) {
        const day = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        dayOrders[day] = (dayOrders[day] || 0) + 1;
      }
    }

    const totalOrders = orders.length;
    const totalRevenue = Object.values(itemStats).reduce((s, i) => s + i.revenue, 0);
    const totalCost = Object.values(itemStats).reduce((s, i) => s + i.cost, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Top items by revenue
    const topByRevenue = Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top items by volume
    const topByVolume = Object.values(itemStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Profitability (scatter: price vs cost, size = count)
    const profitability = Object.values(itemStats)
      .filter(i => i.count > 0)
      .map(i => ({
        name: i.name,
        price: i.price,
        cost: i.cost,
        margin: i.price > 0 ? Math.round(((i.price - i.cost) / i.price) * 100) : 0,
        count: i.count,
      }));

    // Top combos
    const topCombos = Object.entries(combos)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Hourly distribution
    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}:00`,
      orders: hourlyOrders[h] || 0,
    }));

    // Daily distribution
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyData = dayOrder.map(d => ({ day: d, orders: dayOrders[d] || 0 }));

    return {
      totalOrders, totalRevenue, totalCost, avgOrderValue,
      topByRevenue, topByVolume, profitability, topCombos,
      hourlyData, dailyData, profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0,
    };
  }, [orders]);

  if (!metrics) return <p className="text-muted-foreground text-center py-8">No order data available</p>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-brass" /><span className="text-xs text-muted-foreground">Total Orders</span></div>
          <p className="text-xl font-bold mt-1">{metrics.totalOrders}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Total Revenue</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brass" /><span className="text-xs text-muted-foreground">Avg Order Value</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.avgOrderValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">Profit Margin</span></div>
          <p className="text-xl font-bold mt-1">{metrics.profitMargin}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Total Cost</span></div>
          <p className="text-xl font-bold mt-1">{formatCurrency(metrics.totalCost)}</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Items by Revenue */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Items by Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.topByRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {metrics.topByRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Items by Volume */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Items by Orders</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.topByVolume} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#D4AF37" radius={[0, 4, 4, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profitability Scatter */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Item Profitability (Price vs Cost)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="cost" name="Cost" tick={{ fontSize: 10 }} label={{ value: 'Cost (KES)', position: 'bottom', fontSize: 10 }} />
                <YAxis dataKey="price" name="Price" tick={{ fontSize: 10 }} label={{ value: 'Price (KES)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, name: string) => [`KES ${v}`, name]} />
                <Scatter data={metrics.profitability} fill="#D4AF37">
                  {metrics.profitability.map((entry, i) => (
                    <Cell key={i} fill={entry.margin > 50 ? '#10B981' : entry.margin > 30 ? '#F59E0B' : '#EF4444'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Day of Week */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders by Day of Week</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Orders by Hour of Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#D4AF37" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Combos */}
        {metrics.topCombos.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Frequently Ordered Together</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.topCombos.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.count}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
