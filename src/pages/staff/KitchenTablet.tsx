import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useKitchenOrders, useUpdateOrderStatus } from '@/hooks/useRestaurantOrders';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChefHat, CheckCircle2, Clock, X } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface RiderModal {
  orderId: string;
  orderNumber: number;
  riderName: string;
  riderPhone: string;
}

export default function KitchenTablet() {
  const { data: orders, isLoading } = useKitchenOrders();
  const updateStatus = useUpdateOrderStatus();
  const [riderModal, setRiderModal] = useState<RiderModal | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAccept = async (orderId: string) => {
    try {
      await updateStatus.mutateAsync({ orderId, status: 'kitchen_accepted' });
      toast.success('Order accepted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateStatus.mutateAsync({ orderId, status: 'preparing' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // For delivery orders → open rider input modal first, then mark ready
  const handleMarkReady = async (orderId: string, isDelivery: boolean) => {
    if (isDelivery) {
      const order = orders?.find(o => o.id === orderId);
      setRiderModal({
        orderId,
        orderNumber: order?.order_number || 0,
        riderName: '',
        riderPhone: '',
      });
      return;
    }
    // Pickup orders → mark ready directly
    try {
      await updateStatus.mutateAsync({ orderId, status: 'ready' });
      toast.success('Order ready for pickup!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Save rider info and mark order ready
  const handleSaveRiderAndReady = async () => {
    if (!riderModal) return;
    if (!riderModal.riderName.trim() || !riderModal.riderPhone.trim()) {
      toast.error('Enter rider name and phone number');
      return;
    }
    setSaving(true);
    try {
      // Mark order ready
      await updateStatus.mutateAsync({ orderId: riderModal.orderId, status: 'ready' });

      // Save rider info to order
      await sb.from('restaurant_orders').update({
        rider_name: riderModal.riderName.trim(),
        rider_contact: riderModal.riderPhone.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', riderModal.orderId);

      toast.success(`Order #${riderModal.orderNumber} ready — Rider: ${riderModal.riderName}`);
      setRiderModal(null);
    } catch (error: any) {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const newOrders = orders?.filter(o => o.status === 'new' || o.status === 'accepted') || [];
  const preparingOrders = orders?.filter(o => o.status === 'kitchen_accepted' || o.status === 'preparing') || [];
  const readyOrders = orders?.filter(o => o.status === 'ready') || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Rider Assignment Modal */}
      {riderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card className="bg-gray-900 border-amber-500/50 w-full max-w-md mx-4">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-amber-400">
                  🚴 Assign Rider — Order #{riderModal.orderNumber}
                </h3>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => setRiderModal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-400">Enter the rider details for this delivery order. This will be shared with the customer.</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-gray-300">Rider Name *</Label>
                  <Input
                    value={riderModal.riderName}
                    onChange={e => setRiderModal({ ...riderModal, riderName: e.target.value })}
                    placeholder="e.g., John Kamau"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Phone Number *</Label>
                  <Input
                    type="tel"
                    value={riderModal.riderPhone}
                    onChange={e => setRiderModal({ ...riderModal, riderPhone: e.target.value })}
                    placeholder="e.g., 0712345678"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 border-gray-700 text-gray-400" onClick={() => setRiderModal(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleSaveRiderAndReady}
                  disabled={saving || !riderModal.riderName.trim() || !riderModal.riderPhone.trim()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Assign & Mark Ready
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-brass" />
          <div>
            <h1 className="font-display text-2xl font-bold">Kitchen Display</h1>
            <p className="text-gray-400 text-sm">{format(new Date(), 'EEEE, MMMM d • h:mm a')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-400">{newOrders.length} new</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-blue-400">{preparingOrders.length} cooking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-emerald-400">{readyOrders.length} ready</span>
          </div>
        </div>
      </div>

      {/* Three-Column Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 h-[calc(100vh-140px)]">
        {/* NEW ORDERS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-amber-400">New Orders</h2>
            <Badge className="bg-amber-500/20 text-amber-400">{newOrders.length}</Badge>
          </div>
          <div className="space-y-3 overflow-auto max-h-[calc(100vh-220px)]">
            {newOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No new orders</p>
              </div>
            ) : (
              newOrders.map(order => (
                <Card key={order.id} className="bg-gray-900 border-amber-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-amber-400">#{order.order_number}</span>
                        {order.source === 'web' && <Badge className="bg-blue-500/20 text-blue-400 text-xs">WEB</Badge>}
                        {order.room_number && <Badge className="bg-gray-700 text-gray-300 text-xs">Rm {order.room_number}</Badge>}
                      </div>
                      <span className="text-xs text-gray-500">{format(new Date(order.created_at), 'h:mm')}</span>
                    </div>

                    {order.guest_name && (
                      <p className="text-sm text-gray-300 mb-2">{order.guest_name}</p>
                    )}

                    {order.delivery_type && (
                      <div className="mb-2">
                        {order.delivery_type === 'delivery' ? (
                          <Badge className="bg-orange-500/20 text-orange-400 text-xs">🚴 DELIVERY — {order.delivery_address || 'No address'}</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">🍽️ PICKUP</Badge>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 mb-3">
                      {order.restaurant_order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.menu_items?.name}</span>
                          <span className="text-white font-medium">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p className="text-xs text-amber-400/70 mb-3 italic">📝 {order.notes}</p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => handleAccept(order.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* PREPARING */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="h-5 w-5 text-blue-400" />
            <h2 className="font-display text-lg font-bold text-blue-400">Preparing</h2>
            <Badge className="bg-blue-500/20 text-blue-400">{preparingOrders.length}</Badge>
          </div>
          <div className="space-y-3 overflow-auto max-h-[calc(100vh-220px)]">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nothing cooking</p>
              </div>
            ) : (
              preparingOrders.map(order => (
                <Card key={order.id} className="bg-gray-900 border-blue-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-lg font-bold text-blue-400">#{order.order_number}</span>
                      <div className="flex items-center gap-2">
                        {order.room_number && <Badge className="bg-gray-700 text-gray-300 text-xs">Rm {order.room_number}</Badge>}
                        {order.delivery_type === 'delivery' && <Badge className="bg-orange-500/20 text-orange-400 text-xs">🚴 Delivery</Badge>}
                        {order.delivery_type === 'pickup' && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">🍽️ Pickup</Badge>}
                      </div>
                    </div>

                    {order.delivery_type === 'delivery' && order.delivery_address && (
                      <p className="text-xs text-orange-400 mb-2">📍 {order.delivery_address}</p>
                    )}

                    <div className="space-y-1 mb-3">
                      {order.restaurant_order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.menu_items?.name}</span>
                          <span className="text-white font-medium">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p className="text-xs text-blue-400/70 mb-3 italic">📝 {order.notes}</p>
                    )}

                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleMarkReady(order.id, order.delivery_type === 'delivery')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 
                      {order.delivery_type === 'delivery' ? '🚴 Assign Rider & Ready' : 'Mark Ready'}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* READY FOR PICKUP / OUT FOR DELIVERY */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display text-lg font-bold text-emerald-400">Ready</h2>
            <Badge className="bg-emerald-500/20 text-emerald-400">{readyOrders.length}</Badge>
          </div>
          <div className="space-y-3 overflow-auto max-h-[calc(100vh-220px)]">
            {readyOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No orders ready</p>
              </div>
            ) : (
              readyOrders.map(order => (
                <Card key={order.id} className="bg-gray-900 border-emerald-500/30 animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-lg font-bold text-emerald-400">#{order.order_number}</span>
                      <div className="flex items-center gap-2">
                        {order.room_number && <Badge className="bg-gray-700 text-gray-300 text-xs">Rm {order.room_number}</Badge>}
                        {order.delivery_type === 'delivery' && <Badge className="bg-orange-500/20 text-orange-400 text-xs">🚴 Delivery</Badge>}
                        {order.delivery_type === 'pickup' && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">🍽️ Pickup</Badge>}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {order.restaurant_order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.menu_items?.name}</span>
                          <span className="text-white font-medium">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Show rider info for delivery orders */}
                    {order.delivery_type === 'delivery' && order.rider_name && (
                      <div className="mt-3 p-2 rounded bg-orange-500/10 border border-orange-500/30">
                        <p className="text-xs text-orange-400 font-medium">🚴 Rider: {order.rider_name}</p>
                        <p className="text-xs text-orange-300">📞 {order.rider_contact}</p>
                      </div>
                    )}

                    <p className="text-xs text-emerald-400/70 mt-3 text-center">
                      {order.delivery_type === 'delivery' ? '🚴 Out for delivery' : '🔔 Waiting for pickup'}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
