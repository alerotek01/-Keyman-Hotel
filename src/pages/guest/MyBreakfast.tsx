import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useGuestBreakfastOrders, useGuestAlerts, useUnreadAlertCount, useMarkAlertsRead, useBreakfastMenuItems, useBreakfastSelections } from '@/hooks/useBreakfast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Clock, ChefHat, CheckCircle2, AlertTriangle, Bell, Utensils, ArrowRight, Calendar } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Pending' },
  preparing: { color: 'bg-blue-100 text-blue-800', icon: ChefHat, label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Ready!' },
  served: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'Served' },
  skipped: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, label: 'No-Show' },
};

export default function MyBreakfast() {
  const { user } = useAuth();
  const [showAlerts, setShowAlerts] = useState(false);

  // Get guest ID
  const [guestId, setGuestId] = useState<string | null>(null);
  useState(() => {
    if (user?.id) {
      sb.from('guests').select('id').eq('user_id', user.id).single().then(({ data }: any) => {
        if (data) setGuestId(data.id);
      });
    }
  });

  const { data: orders, isLoading: ordersLoading } = useGuestBreakfastOrders(guestId ?? undefined);
  const { data: alerts, isLoading: alertsLoading } = useGuestAlerts(guestId ?? undefined);
  const { data: unreadCount } = useUnreadAlertCount(guestId ?? undefined);
  const markRead = useMarkAlertsRead();

  const today = new Date().toISOString().split('T')[0];

  // Group orders by date
  const byDate = (orders ?? []).reduce((acc: any, order: any) => {
    if (!acc[order.meal_date]) acc[order.meal_date] = [];
    acc[order.meal_date].push(order);
    return acc;
  }, {} as Record<string, any[]>);

  const handleMarkRead = () => {
    if (guestId) {
      markRead.mutate(guestId);
    }
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No breakfast orders yet</p>
            <p className="text-sm mt-2">Select B&B when booking to see your breakfast orders here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header with alerts badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🍳 My Breakfast</h1>
          <p className="text-sm text-muted-foreground">Track your breakfast orders and kitchen updates</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAlerts(!showAlerts)}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Alerts Panel */}
      {showAlerts && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Notifications</CardTitle>
              {(unreadCount ?? 0) > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkRead} className="text-xs h-7">
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {alerts?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No notifications</p>
            ) : (
              alerts?.map(alert => (
                <div
                  key={alert.id}
                  className={`p-2 rounded text-xs ${alert.read ? 'bg-muted/30' : 'bg-primary/5 border border-primary/20'}`}
                >
                  <p className={`font-medium ${!alert.read ? 'text-primary' : ''}`}>{alert.title}</p>
                  <p className="text-muted-foreground mt-0.5">{alert.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders by date */}
      {Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, items]) => {
          const isToday = date === today;
          const isPast = date < today;
          const allReady = items.every((i: any) => i.kitchen_status === 'ready' || i.kitchen_status === 'served');
          const anyPreparing = items.some((i: any) => i.kitchen_status === 'preparing');

          return (
            <Card key={date} className={isToday ? 'border-primary/30' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                    {isToday && <Badge className="bg-primary text-primary-foreground text-[10px]">Today</Badge>}
                  </CardTitle>
                  {isToday && anyPreparing && (
                    <Badge className="bg-blue-100 text-blue-800 animate-pulse">
                      <ChefHat className="h-3 w-3 mr-1" />
                      Kitchen working
                    </Badge>
                  )}
                  {isToday && allReady && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      All ready
                    </Badge>
                  )}
                  {isPast && (
                    <Badge variant="secondary">Past</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item: any) => {
                  const config = statusConfig[item.kitchen_status] || statusConfig.pending;
                  const StatusIcon = config.icon;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        item.kitchen_status === 'ready' ? 'bg-green-50 dark:bg-green-950 border-green-200' :
                        item.kitchen_status === 'preparing' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200' :
                        'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${config.color}`}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.quantity}x {item.item_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Room {item.room_number}</span>
                            <span>•</span>
                            <span className="font-mono">{item.verification_code}</span>
                          </div>
                          {item.kitchen_status === 'preparing' && item.kitchen_started_at && (
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              Started {new Date(item.kitchen_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {item.kitchen_status === 'ready' && item.kitchen_ready_at && (
                            <p className="text-[10px] text-green-600 mt-0.5">
                              Ready since {new Date(item.kitchen_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={config.color}>
                        {config.label}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

      {/* Verification code reminder */}
      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">📋 How it works</p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-1">
            <li>• When your meal is <strong>being prepared</strong>, you'll see a notification</li>
            <li>• When it's <strong>ready</strong>, go to the cafeteria with your code</li>
            <li>• Show your <strong>KB-XXXX code</strong> to the chef/waiter</li>
            <li>• You can change your order up to 5 hours before breakfast</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
