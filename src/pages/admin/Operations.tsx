import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2, Activity, Users, Shield, Eye, Search,
  BedDouble, UtensilsCrossed, CreditCard, LogIn, LogOut,
  ClipboardCheck, UserCog, AlertTriangle, ChevronDown,
  Clock, Wifi, WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ACTION_ICONS: Record<string, any> = {
  INSERT: Activity,
  UPDATE: UserCog,
  DELETE: AlertTriangle,
  check_in: LogIn,
  check_out: LogOut,
  created: Activity,
  status_change: ClipboardCheck,
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

export default function Operations() {
  const { user, isImpersonating, impersonatedName, displayRole, displayEmail, stopImpersonating } = useAuth();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [impersonateDialog, setImpersonateDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isLive, setIsLive] = useState(true);

  // Fetch staff members
  const { data: staff } = useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('id, full_name, email, role, is_active')
        .order('role');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch audit logs with user info
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs-detailed', tableFilter],
    queryFn: async () => {
      const { data, error } = await sb
        .from('audit_logs')
        .select('*, users:user_id(full_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: isLive ? 10000 : false,
  });

  // Fetch today's activity summary
  const { data: todayStats } = useQuery({
    queryKey: ['today-activity'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [reservations, folioTxns, folioPayments, orders, housekeeping] = await Promise.all([
        sb.from('reservations').select('id, status').gte('created_at', today.toISOString()),
        sb.from('folio_transactions').select('id, type, amount').gte('created_at', today.toISOString()),
        sb.from('folio_payments').select('id, method, amount').gte('created_at', today.toISOString()),
        sb.from('restaurant_orders').select('id, status').gte('created_at', today.toISOString()),
        sb.from('housekeeping_tasks').select('id, status').gte('created_at', today.toISOString()),
      ]);

      return {
        reservations: reservations.data?.length || 0,
        folioCharges: folioTxns.data?.length || 0,
        payments: folioPayments.data?.length || 0,
        orders: orders.data?.length || 0,
        housekeeping: housekeeping.data?.length || 0,
        revenue: (folioTxns.data || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
        collected: (folioPayments.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      };
    },
    refetchInterval: isLive ? 30000 : false,
  });

  // Filter logs
  const filteredLogs = (logs || []).filter((log: any) => {
    const matchesSearch = !searchQuery ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.users?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTable = tableFilter === 'all' || log.table_name === tableFilter;
    return matchesSearch && matchesTable;
  });

  // Impersonate mutation (stores in localStorage for demo — in production would use a server-side session)
  const handleImpersonate = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setImpersonateDialog(true);
  };

  const confirmImpersonate = () => {
    if (!selectedStaff) return;
    // Store impersonation session
    localStorage.setItem('impersonate', JSON.stringify({
      targetUser: selectedStaff,
      adminUser: user,
      startedAt: new Date().toISOString(),
    }));
    setImpersonateDialog(false);
    toast.success(`Now acting as ${selectedStaff.full_name || selectedStaff.email}`);
    // Reload to apply impersonation
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">
              You are acting as {impersonatedName || displayEmail}
              <span className="text-amber-100 ml-2">({displayRole})</span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="text-white border-white hover:bg-white/20" onClick={stopImpersonating}>
            <Shield className="h-4 w-4 mr-1" />
            Stop Impersonating
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Operations Center</h1>
          <p className="text-muted-foreground mt-1">Real-time staff activity and admin overrides</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={isLive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="gap-2"
          >
            {isLive ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isLive ? 'Live' : 'Paused'}
          </Button>
        </div>
      </div>

      {/* Today's Activity Summary */}
      {todayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{todayStats.reservations}</p>
              <p className="text-xs text-muted-foreground">Bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{todayStats.folioCharges}</p>
              <p className="text-xs text-muted-foreground">Charges</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{todayStats.payments}</p>
              <p className="text-xs text-muted-foreground">Payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{todayStats.orders}</p>
              <p className="text-xs text-muted-foreground">Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{todayStats.housekeeping}</p>
              <p className="text-xs text-muted-foreground">Housekeeping</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">KSH {todayStats.revenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">KSH {todayStats.collected.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Collected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Staff Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-2">
                {staff?.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
                    onClick={() => handleImpersonate(s)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold',
                        s.role === 'admin' ? 'bg-red-100 text-red-700' :
                        s.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                        s.role === 'receptionist' ? 'bg-green-100 text-green-700' :
                        s.role === 'chef' ? 'bg-orange-100 text-orange-700' :
                        s.role === 'waiter' ? 'bg-purple-100 text-purple-700' :
                        s.role === 'housekeeper' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {(s.full_name || s.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.full_name || s.email}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{s.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Activity Feed */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity Feed
                  {isLive && <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search activity..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-48 text-sm"
                    />
                  </div>
                  <Select value={tableFilter} onValueChange={setTableFilter}>
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tables</SelectItem>
                      <SelectItem value="reservations">Reservations</SelectItem>
                      <SelectItem value="folio_transactions">Charges</SelectItem>
                      <SelectItem value="folio_payments">Payments</SelectItem>
                      <SelectItem value="restaurant_orders">Orders</SelectItem>
                      <SelectItem value="housekeeping_tasks">Housekeeping</SelectItem>
                      <SelectItem value="rooms">Rooms</SelectItem>
                      <SelectItem value="guests">Guests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brass" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredLogs.map((log: any) => {
                    const Icon = ACTION_ICONS[log.action] || Activity;
                    const colorClass = TABLE_COLORS[log.table_name] || 'bg-gray-100 text-gray-700';
                    const staffName = log.users?.full_name || log.users?.email || 'System';
                    const staffRole = log.users?.role || '';

                    return (
                      <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{staffName}</p>
                            {staffRole && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {staffRole}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {log.action?.toLowerCase()} on {log.table_name}
                            </span>
                          </div>
                          {log.new_value && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {typeof log.new_value === 'object' ? (
                                Object.entries(log.new_value).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="mr-2">
                                    <span className="text-muted-foreground/70">{k}:</span>{' '}
                                    <span className="font-medium">{String(v)}</span>
                                  </span>
                                ))
                              ) : String(log.new_value)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground">
                            {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {log.created_at ? format(new Date(log.created_at), 'h:mm a') : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Impersonate Dialog */}
      <Dialog open={impersonateDialog} onOpenChange={setImpersonateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Impersonate Staff
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  You are about to act as <strong>{selectedStaff.full_name || selectedStaff.email}</strong> ({selectedStaff.role}).
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  You will see their PDA view and can perform actions on their behalf. A red banner will remind you that you are impersonating.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{selectedStaff.full_name || selectedStaff.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{selectedStaff.role}</p>
                <p className="text-xs text-muted-foreground">{selectedStaff.email}</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setImpersonateDialog(false)}>Cancel</Button>
                <Button variant="default" onClick={confirmImpersonate} className="bg-amber-600 hover:bg-amber-700">
                  <Eye className="mr-2 h-4 w-4" />
                  Start Impersonating
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
