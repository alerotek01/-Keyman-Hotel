import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, Clock, Phone, MapPin, CheckCircle2, UtensilsCrossed,
  Package, RefreshCw, Timer, Truck, ArrowRight, Coffee
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-700', icon: '⏳', step: 0 },
  payment_submitted: { label: 'Payment Submitted', color: 'bg-blue-100 text-blue-700', icon: '💰', step: 1 },
  kitchen_accepted: { label: 'Kitchen Accepted', color: 'bg-purple-100 text-purple-700', icon: '👨‍🍳', step: 2 },
  preparing: { label: 'Being Prepared', color: 'bg-amber-100 text-amber-700', icon: '🔥', step: 3 },
  ready: { label: 'Ready for Pickup', color: 'bg-emerald-100 text-emerald-700', icon: '✅', step: 4 },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: '🎉', step: 5 },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: '🎉', step: 5 },
};

const TRACKING_STEPS = [
  { label: 'Placed', icon: '📋' },
  { label: 'Accepted', icon: '👨‍🍳' },
  { label: 'Preparing', icon: '🔥' },
  { label: 'Ready', icon: '✅' },
  { label: 'Delivered', icon: '🎉' },
];

function EtaCountdown({ estimatedAt }: { estimatedAt: string }) {
  const [remaining, setRemaining] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(estimatedAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Any moment now');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(mins > 0 ? `~${mins}m ${secs}s` : `~${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [estimatedAt]);

  return (
    <div className="flex items-center gap-2 text-amber-600">
      <Timer className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-semibold">{remaining}</span>
    </div>
  );
}

export default function ExternalDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestProfile, setGuestProfile] = useState<any>(null);
  const [reorderLoading, setReorderLoading] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [user]);

  // Real-time updates
  useEffect(() => {
    if (!guestProfile) return;
    const channel = supabase
      .channel('ext-dash-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurant_orders',
        filter: `guest_id=eq.${guestProfile.id}`,
      }, (payload) => {
        const NEW = payload.new as any;
        const msg = STATUS_CONFIG[NEW.status]?.label;
        if (msg) toast.success(`${STATUS_CONFIG[NEW.status]?.icon} ${msg}`);
        loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guestProfile?.id]);

  const loadData = async () => {
    try {
      if (user?.id) {
        let { data: guest } = await sb.from('guests').select('*').eq('user_id', user.id).single();
        if (!guest) {
          const { data: newGuest } = await sb.from('guests').insert({
            name: user.email?.split('@')[0] || 'Customer',
            email: user.email,
            user_id: user.id,
          }).select().single();
          guest = newGuest;
        }
        setGuestProfile(guest);
      }
      await loadOrders();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadOrders = async () => {
    if (!guestProfile) return;
    const { data } = await sb
      .from('restaurant_orders')
      .select('*, restaurant_order_items(*, menu_items(name, price))')
      .eq('guest_id', guestProfile.id)
      .eq('source', 'web')
      .order('created_at', { ascending: false })
      .limit(30);
    setOrders(data || []);
  };

  const handleReorder = async (order: any) => {
    if (!order.restaurant_order_items?.length) { toast.error('No items to reorder'); return; }
    setReorderLoading(order.id);
    try {
      // Create new order from previous items
      const { data: newOrder, error } = await sb.from('restaurant_orders').insert({
        guest_name: order.guest_name,
        guest_id: order.guest_id,
        source: 'web',
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address,
        delivery_fee: order.delivery_fee || 0,
        total: order.total,
        status: 'pending',
        notes: order.restaurant_order_items.map((i: any) =>
          `${i.quantity}x ${i.menu_items?.name || 'Item'}`
        ).join(', '),
      }).select().single();
      if (error) throw error;

      // Copy items
      const items = order.restaurant_order_items.map((i: any) => ({
        order_id: newOrder.id,
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      }));
      await sb.from('restaurant_order_items').insert(items);

      toast.success('Order re-placed! Pay via M-Pesa to confirm.');
      await loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder');
    }
    setReorderLoading(null);
  };

  // Separate active and past orders
  const activeOrders = orders.filter(o =>
    !['completed', 'cancelled'].includes(o.status)
  );
  const pastOrders = orders.filter(o =>
    ['completed', 'delivered'].includes(o.status)
  );
  const topOrder = orders[0]; // Most recent for hero tracking

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brass" />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Hero: Active Order Tracking */}
      {topOrder && STATUS_CONFIG[topOrder.status]?.step < 5 && (
        <Card className="border-brass overflow-hidden">
          <div className="bg-gradient-to-r from-navy to-navy/80 p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/60 text-xs">Active Order</p>
                <p className="font-bold text-lg">#{topOrder.order_number}</p>
              </div>
              <Badge className="bg-brass text-navy text-xs">
                {STATUS_CONFIG[topOrder.status]?.icon} {STATUS_CONFIG[topOrder.status]?.label}
              </Badge>
            </div>

            {/* Tracking Steps */}
            <div className="flex items-center gap-1 mb-3">
              {TRACKING_STEPS.map((step, i) => {
                const currentStep = STATUS_CONFIG[topOrder.status]?.step || 0;
                const isComplete = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all',
                      isComplete
                        ? 'bg-brass border-brass text-navy'
                        : isCurrent
                        ? 'border-brass text-brass animate-pulse'
                        : 'border-white/20 text-white/30'
                    )}>
                      {step.icon}
                    </div>
                    <span className={cn(
                      'text-[9px]',
                      isComplete ? 'text-brass' : 'text-white/30'
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ETA */}
            {topOrder.estimated_ready_at && (
              <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-brass animate-pulse" />
                  <div>
                    <p className="text-xs text-white/60">Estimated Ready</p>
                    <p className="font-bold text-brass">
                      {new Date(topOrder.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <EtaCountdown estimatedAt={topOrder.estimated_ready_at} />
              </div>
            )}

            {/* Rider info */}
            {topOrder.delivery_type === 'delivery' && (topOrder.rider_name || topOrder.rider_contact) && (
              <div className="bg-white/10 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-brass" />
                  <span className="text-xs text-white/60">Your Rider</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-semibold text-sm">{topOrder.rider_name}</span>
                  {topOrder.rider_contact && (
                    <a href={`tel:${topOrder.rider_contact}`} className="flex items-center gap-1 text-brass text-xs">
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Delivery address */}
            {topOrder.delivery_type === 'delivery' && topOrder.delivery_address && (
              <div className="flex items-center gap-1 text-xs text-white/60 mt-2">
                <MapPin className="h-3 w-3" /> {topOrder.delivery_address}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/external/order">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-brass/30">
            <CardContent className="p-4 text-center">
              <Coffee className="h-8 w-8 mx-auto text-brass mb-2" />
              <p className="font-semibold text-sm">Order Food</p>
              <p className="text-xs text-muted-foreground mt-1">Browse menu & order</p>
            </CardContent>
          </Card>
        </Link>
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-muted"
          onClick={() => {
            if (pastOrders.length > 0) {
              handleReorder(pastOrders[0]);
            }
          }}
        >
          <CardContent className="p-4 text-center">
            <RefreshCw className={cn("h-8 w-8 mx-auto mb-2", pastOrders.length > 0 ? "text-blue-500" : "text-muted-foreground/30")} />
            <p className="font-semibold text-sm">Quick Reorder</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pastOrders.length > 0 ? `Last: #${pastOrders[0].order_number}` : 'No past orders'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground mb-2 px-1">Active Orders ({activeOrders.length})</h2>
          <div className="space-y-3">
            {activeOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              return (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">#{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={cfg.color}>{cfg.icon} {cfg.label}</Badge>
                    </div>

                    {/* Mini tracking bar */}
                    <div className="flex gap-1 mb-2">
                      {TRACKING_STEPS.map((step, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-all',
                            i <= cfg.step ? 'bg-brass' : 'bg-gray-200'
                          )}
                        />
                      ))}
                    </div>

                    {/* Items */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {order.restaurant_order_items?.map((i: any) =>
                        `${i.quantity}x ${i.menu_items?.name}`
                      ).join(' · ')}
                    </p>

                    {/* ETA */}
                    {order.estimated_ready_at && STATUS_CONFIG[order.status]?.step < 5 && (
                      <div className="flex items-center justify-between bg-amber-50 rounded-lg p-2 mt-2">
                        <span className="text-xs text-amber-700">
                          ETA: {new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <EtaCountdown estimatedAt={order.estimated_ready_at} />
                      </div>
                    )}

                    {/* Rider */}
                    {order.delivery_type === 'delivery' && order.rider_name && (
                      <div className="flex items-center justify-between bg-orange-50 rounded-lg p-2 mt-2">
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-orange-600" />
                          <span className="text-xs font-medium text-orange-800">{order.rider_name}</span>
                        </div>
                        {order.rider_contact && (
                          <a href={`tel:${order.rider_contact}`} className="flex items-center gap-1 text-xs text-orange-600">
                            <Phone className="h-3 w-3" /> {order.rider_contact}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <span className="font-bold">{formatCurrency(order.total)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {order.delivery_type === 'delivery' ? '🚴 Delivery' : '🍽️ Pickup'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Order History */}
      {pastOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground mb-2 px-1">Past Orders</h2>
          <div className="space-y-2">
            {pastOrders.slice(0, 10).map(order => (
              <Card key={order.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">#{order.order_number}</p>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Completed</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.restaurant_order_items?.map((i: any) =>
                          `${i.quantity}x ${i.menu_items?.name}`
                        ).join(' · ')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-semibold">{formatCurrency(order.total)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleReorder(order)}
                        disabled={reorderLoading === order.id}
                      >
                        {reorderLoading === order.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Reorder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">Welcome to Keyman Café</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Order delicious food for pickup or delivery. Fast, fresh, and affordable.
          </p>
          <Link to="/external/order">
            <Button variant="brass">
              <UtensilsCrossed className="mr-2 h-4 w-4" /> Browse Menu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
