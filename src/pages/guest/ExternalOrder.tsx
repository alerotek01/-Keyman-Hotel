import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, ShoppingCart, Plus, Minus, Clock, Phone, MapPin, CheckCircle2, Truck, UtensilsCrossed, Search, Package } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface CartItem {
  item: any;
  qty: number;
}

export default function ExternalOrder() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'menu' | 'cart' | 'orders'>('menu');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(200);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guestProfile, setGuestProfile] = useState<any>(null);

  useEffect(() => { loadData(); }, [user]);

  // Real-time order updates
  useEffect(() => {
    if (!guestProfile) return;
    const channel = supabase
      .channel('external-order-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurant_orders',
        filter: `guest_id=eq.${guestProfile.id}`,
      }, (payload) => {
        const NEW = payload.new as any;
        const statusLabels: Record<string, string> = {
          kitchen_accepted: '👨‍🍳 Kitchen accepted your order!',
          preparing: '🔥 Being prepared...',
          ready: '✅ Order ready!',
          delivered: '🎉 Delivered!',
          completed: '✅ Order complete',
        };
        if (statusLabels[NEW.status]) {
          toast.success(statusLabels[NEW.status]);
          loadOrders();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guestProfile?.id]);

  const loadData = async () => {
    try {
      // Ensure guest profile exists
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

      // Load menu
      const [menuRes, catRes] = await Promise.all([
        sb.from('menu_items').select('*, category:menu_categories(name)').eq('is_available', true).order('sort_order'),
        sb.from('menu_categories').select('*').order('name'),
      ]);
      setMenuItems(menuRes.data || []);
      setCategories(catRes.data || []);

      // Load delivery fee setting
      const { data: settings } = await sb.from('site_settings').select('*');
      const feeSetting = settings?.find((s: any) => s.key === 'external_delivery_fee');
      if (feeSetting) setDeliveryFee(parseInt(feeSetting.value) || 200);

      // Load my orders
      await loadOrders();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadOrders = async () => {
    if (!guestProfile) return;
    const { data: orders } = await sb
      .from('restaurant_orders')
      .select('*')
      .eq('guest_id', guestProfile.id)
      .eq('source', 'web')
      .order('created_at', { ascending: false })
      .limit(20);
    setMyOrders(orders || []);
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.item.id !== itemId) return c;
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : c;
      }).filter(c => c.qty > 0);
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.item.price) * c.qty, 0);
  const orderTotal = cartTotal + (deliveryType === 'delivery' ? deliveryFee : 0);

  const placeOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (deliveryType === 'delivery' && !deliveryAddress) { toast.error('Enter delivery address'); return; }
    if (!guestProfile) { toast.error('Please sign in first'); return; }

    setSubmitting(true);
    try {
      // Create order
      const { data: order, error } = await sb.from('restaurant_orders').insert({
        guest_name: guestProfile.name,
        guest_id: guestProfile.id,
        source: 'web',
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
        delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
        total: orderTotal,
        status: 'pending',
        notes: cart.map(c => `${c.qty}x ${c.item.name}`).join(', '),
      }).select().single();
      if (error) throw error;

      // Create order items
      const items = cart.map(c => ({
        order_id: order.id,
        menu_item_id: c.item.id,
        quantity: c.qty,
        unit_price: Number(c.item.price),
        subtotal: Number(c.item.price) * c.qty,
      }));
      await sb.from('restaurant_order_items').insert(items);

      // Create pending payment
      await sb.from('booking_payments').insert({
        reservation_id: null,
        guest_id: guestProfile.id,
        amount: orderTotal,
        method: 'mpesa',
        payment_type: 'full',
        status: 'pending',
        notes: `External order #${order.order_number}`,
      });

      toast.success('Order placed! Pay via M-Pesa to confirm.');
      setCart([]);
      setTab('orders');
      await loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    }
    setSubmitting(false);
  };

  const filteredItems = menuItems.filter((item: any) => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy text-white px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold">🍽️ Keyman Café</h1>
              <p className="text-white/60 text-sm">Order • Track • Enjoy</p>
            </div>
            <div className="relative">
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-brass text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {cart.reduce((s, c) => s + c.qty, 0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Tab Bar */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 shadow-sm">
          {(['menu', 'cart', 'orders'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'menu' ? '📋 Menu' : t === 'cart' ? `🛒 Cart (${cart.length})` : '📦 My Orders'}
            </button>
          ))}
        </div>

        {/* Menu Tab */}
        {tab === 'menu' && (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-navy text-white' : 'bg-white border text-muted-foreground'}`}
              >All</button>
              {categories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-navy text-white' : 'bg-white border text-muted-foreground'}`}
                >{cat.name}</button>
              ))}
            </div>

            <div className="grid gap-2">
              {filteredItems.map((item: any) => {
                const inCart = cart.find(c => c.item.id === item.id);
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                        <p className="text-sm font-bold mt-1">{formatCurrency(item.price)}</p>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQty(item.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-sm w-6 text-center">{inCart.qty}</span>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQty(item.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="brass" className="h-8" onClick={() => addToCart(item)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No items found</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Cart Tab */}
        {tab === 'cart' && (
          <>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Your cart is empty</p>
                <Button variant="brass" size="sm" className="mt-3" onClick={() => setTab('menu')}>Browse Menu</Button>
              </div>
            ) : (
              <>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    {cart.map(c => (
                      <div key={c.item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(c.item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(c.item.id, -1)}><Minus className="h-3 w-3" /></Button>
                          <span className="font-bold text-sm w-6 text-center">{c.qty}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(c.item.id, 1)}><Plus className="h-3 w-3" /></Button>
                          <span className="font-semibold text-sm w-20 text-right">{formatCurrency(Number(c.item.price) * c.qty)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="mt-3">
                  <CardContent className="p-3 space-y-3">
                    <div className="space-y-2">
                      <Label>Order Type</Label>
                      <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pickup">🍽️ Pickup at Café</SelectItem>
                          <SelectItem value="delivery">🚴 Delivery (+{formatCurrency(deliveryFee)})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {deliveryType === 'delivery' && (
                      <div className="space-y-2">
                        <Label>Delivery Address *</Label>
                        <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="e.g., Mwatate Town, Near ABC Bank" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> Delivery fee: {formatCurrency(deliveryFee)}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                      {deliveryType === 'delivery' && (
                        <div className="flex justify-between text-sm">
                          <span>Delivery Fee</span>
                          <span>{formatCurrency(deliveryFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-1 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(orderTotal)}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">📱 M-Pesa Payment Required</p>
                      <p className="text-xs text-blue-600 mt-1">Pay before order is accepted. Admin will confirm payment.</p>
                    </div>

                    <Button variant="brass" className="w-full" onClick={placeOrder} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Place Order — {formatCurrency(orderTotal)}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <>
            {myOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No orders yet</p>
                <Button variant="brass" size="sm" className="mt-3" onClick={() => setTab('menu')}>Order Now</Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {myOrders.map((order: any) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Order #{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge className={
                          order.status === 'delivered' || order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'preparing' || order.status === 'kitchen_accepted' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {order.status === 'pending' ? '⏳ Pending Payment' :
                           order.status === 'kitchen_accepted' ? '👨‍🍳 Accepted' :
                           order.status === 'preparing' ? '🔥 Preparing' :
                           order.status === 'ready' ? '✅ Ready' :
                           order.status === 'delivered' ? '🎉 Delivered' :
                           order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{order.notes}</p>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{formatCurrency(order.total)}</span>
                        {order.delivery_type === 'delivery' && order.rider_contact && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> Rider: {order.rider_contact}
                          </div>
                        )}
                        {order.delivery_type === 'delivery' && (
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3" /> {order.delivery_address}
                          </div>
                        )}
                      </div>
                      {order.estimated_ready_at && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                          <Clock className="h-3 w-3" /> ETA: {new Date(order.estimated_ready_at).toLocaleTimeString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
