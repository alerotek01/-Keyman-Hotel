import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Activity, BedDouble, UtensilsCrossed, CreditCard, Users, LogIn, LogOut, Clock, Search } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ACTION_ICONS: Record<string, any> = {
  INSERT: Activity, UPDATE: Users, DELETE: Activity,
  check_in: LogIn, check_out: LogOut, created: Activity, status_change: Clock,
};

const TABLE_COLORS: Record<string, string> = {
  reservations: 'bg-blue-100 text-blue-700',
  folio_transactions: 'bg-orange-100 text-orange-700',
  folio_payments: 'bg-green-100 text-green-700',
  restaurant_orders: 'bg-purple-100 text-purple-700',
  housekeeping_tasks: 'bg-amber-100 text-amber-700',
  rooms: 'bg-cyan-100 text-cyan-700',
  guests: 'bg-pink-100 text-pink-700',
};

export default function ManagerOperations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('all');

  // Today's summary
  const { data: todayStats } = useQuery({
    queryKey: ['mgr-ops-today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [res, txn, pay, orders, hk] = await Promise.all([
        sb.from('reservations').select('id, status').gte('created_at', today.toISOString()),
        sb.from('folio_transactions').select('id, amount').gte('created_at', today.toISOString()),
        sb.from('folio_payments').select('id, amount').gte('created_at', today.toISOString()),
        sb.from('restaurant_orders').select('id, status').gte('created_at', today.toISOString()),
        sb.from('housekeeping_tasks').select('id, status').gte('created_at', today.toISOString()),
      ]);
      return {
        bookings: res.data?.length || 0,
        charges: txn.data?.length || 0,
        payments: pay.data?.length || 0,
        orders: orders.data?.length || 0,
        housekeeping: hk.data?.length || 0,
        revenue: (txn.data || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
        collected: (pay.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      };
    },
  });

  // Audit log feed
  const { data: logs, isLoading } = useQuery({
    queryKey: ['mgr-ops-logs', tableFilter],
    queryFn: async () => {
      const { data, error } = await sb
        .from('audit_logs')
        .select('*, users:user_id(full_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (logs || []).filter((log: any) => {
    const matchesStatus = tableFilter === 'all' || log.table_name === tableFilter;
    const matchesSearch = !searchQuery ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-brass" />
          Operations Overview
        </h1>
        <p className="text-muted-foreground mt-1">Real-time activity across the property</p>
      </div>

      {/* Stats */}
      {todayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { value: todayStats.bookings, label: 'Bookings', color: 'text-blue-600' },
            { value: todayStats.charges, label: 'Charges', color: 'text-orange-600' },
            { value: todayStats.payments, label: 'Payments', color: 'text-green-600' },
            { value: todayStats.orders, label: 'Orders', color: 'text-purple-600' },
            { value: todayStats.housekeeping, label: 'Housekeeping', color: 'text-amber-600' },
            { value: formatCurrency(todayStats.revenue), label: 'Revenue', color: 'text-brass' },
            { value: formatCurrency(todayStats.collected), label: 'Collected', color: 'text-emerald-600' },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search activity..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="reservations">Reservations</SelectItem>
            <SelectItem value="folio_transactions">Charges</SelectItem>
            <SelectItem value="folio_payments">Payments</SelectItem>
            <SelectItem value="restaurant_orders">Orders</SelectItem>
            <SelectItem value="housekeeping_tasks">Housekeeping</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8"><Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">No activity recorded</p></div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filtered.map((log: any) => {
                const Icon = ACTION_ICONS[log.action] || Activity;
                const colorClass = TABLE_COLORS[log.table_name] || 'bg-gray-100 text-gray-700';
                return (
                  <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{log.users?.full_name || 'System'}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{log.users?.role}</Badge>
                        <span className="text-xs text-muted-foreground">{log.action?.toLowerCase()} on {log.table_name}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
