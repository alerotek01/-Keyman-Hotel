import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useMenuItems, useMenuCategories } from '@/hooks/useMenu';
import { useCreateOrder, useWaiterOrders, useUpdateOrderStatus } from '@/hooks/useRestaurantOrders';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus, Minus, Send, CheckCircle2, Clock, AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'active' | 'delivered' | 'all';

export default function WaiterPda() {
  const { user } = useAuth();
  const { data: menuItems } = useMenuItems();
  const { data: categories } = useMenuCategories();
  const { data: orders, isLoading } = useWaiterOrders();
  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();

  const [filter, setFilter] = useState<FilterType>('active');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const availableItems = menuItems?.filter(i => i.is_available) || [];
  const filteredMenuItems = activeCategory === 'all' ? availableItems : availableItems.filter(i => i.category_id === activeCategory);

  const filteredOrders = orders?.filter(o => {
    if (filter === 'active') return !['delivered', 'reconciled', 'cancelled', 'payment_verified'].includes(o.status);
    if (filter === 'delivered') return o.status === 'delivered' || o.status === 'payment_submitted' || o.status === 'payment_verified';
    return true;
  }) || [];

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateCart = (item: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.id !== item.id);
        return prev.map(c => c.id === item.id ? { ...c, quantity: newQty } : c);
      }
      if (delta > 0) return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
      return prev;
    });
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add items first');
      return;
    }
    try {
      await createOrder.mutateAsync({
        source: 'waiter',
        guest_name: guestName || undefined,
        room_number: roomNumber ? parseInt(roomNumber) : undefined,
        waiter_id: user?.id,
        notes: notes || undefined,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
      });
      setNewOrderOpen(false);
      setCart([]);
      setGuestName('');
      setRoomNumber('');
      setNotes('');
      toast.success('Order sent to kitchen!');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ orderId, status: status as any });
      toast.success(`Order marked as ${status.replace('_', ' ')}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    new: { color: 'bg-amber-100 text-amber-800', label: 'New' },
    accepted: { color: 'bg-blue-100 text-blue-800', label: 'Accepted' },
    kitchen_accepted: { color: 'bg-blue-100 text-blue-800', label: 'Kitchen' },
    preparing: { color: 'bg-orange-100 text-orange-800', label: 'Preparing' },
    ready: { color: 'bg-emerald-100 text-emerald-800', label: 'Ready' },
    delivered: { color: 'bg-gray-100 text-gray-800', label: 'Delivered' },
    payment_submitted: { color: 'bg-purple-100 text-purple-800', label: 'Payment' },
    payment_verified: { color: 'bg-emerald-100 text-emerald-800', label: 'Verified' },
    cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">My Orders</h1>
          <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
          <DialogTrigger asChild>
            <Button variant="brass">
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Guest Name</Label>
                  <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Walk-in or room guest" />
                </div>
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input type="number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto">
                <button onClick={() => setActiveCategory('all')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap", activeCategory === 'all' ? 'bg-brass text-white' : 'bg-muted')}>All</button>
                {categories?.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap", activeCategory === cat.id ? 'bg-brass text-white' : 'bg-muted')}>{cat.name}</button>
                ))}
              </div>

              {/* Menu items */}
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-auto">
                {filteredMenuItems.map(item => {
                  const qty = cart.find(c => c.id === item.id)?.quantity || 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Number(item.price))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <>
                            <button onClick={() => updateCart(item, -1)} className="w-6 h-6 rounded-full border flex items-center justify-center text-xs"><Minus className="h-3 w-3" /></button>
                            <span className="text-sm font-medium w-5 text-center">{qty}</span>
                          </>
                        )}
                        <button onClick={() => updateCart(item, 1)} className="w-6 h-6 rounded-full bg-brass/10 flex items-center justify-center text-brass"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cart summary */}
              {cart.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} × {item.quantity}</span>
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              )}

              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes (optional)" rows={2} />

              <Button variant="brass" className="w-full" onClick={handleSubmitOrder} disabled={createOrder.isPending}>
                {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to Kitchen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {(['active', 'delivered', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-4 py-2 rounded-full text-sm font-medium", filter === f ? 'bg-brass text-white' : 'bg-muted text-muted-foreground')}>
            {f === 'active' ? 'Active' : f === 'delivered' ? 'Delivered' : 'All'}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const cfg = statusConfig[order.status] || { color: 'bg-gray-100 text-gray-800', label: order.status };
            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">#{order.order_number}</span>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'h:mm a')}</span>
                  </div>

                  {order.guest_name && (
                    <p className="text-sm mb-1">{order.guest_name} {order.room_number ? `• Room ${order.room_number}` : ''}</p>
                  )}

                  <div className="text-sm text-muted-foreground mb-3">
                    {order.restaurant_order_items?.map((item: any) => (
                      <span key={item.id}>{item.menu_items?.name} ×{item.quantity}{item !== order.restaurant_order_items?.slice(-1)[0] ? ', ' : ''}</span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formatCurrency(order.total)}</span>

                    <div className="flex gap-2">
                      {order.status === 'ready' && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusUpdate(order.id, 'delivered')}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Delivered
                        </Button>
                      )}
                      {order.status === 'delivered' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(order.id, 'payment_submitted')}>
                          Payment Received
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
