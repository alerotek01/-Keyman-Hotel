import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Minus, Send, Clock, CheckCircle2, UtensilsCrossed } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function GuestOrder() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [roomNumber, setRoomNumber] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: guest } = await sb.from('guests').select('id').eq('user_id', user?.id).single();
      if (!guest) { setLoading(false); return; }

      const { data: res } = await sb
        .from('reservations')
        .select('id, room_number')
        .eq('guest_id', guest.id)
        .in('status', ['confirmed', 'checked_in'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (res?.room_number) setRoomNumber(res.room_number);

      const [menu, cats, myOrders] = await Promise.all([
        sb.from('menu_items').select('*, menu_categories(id, name)').eq('is_available', true).order('name'),
        sb.from('menu_categories').select('*').order('sort_order'),
        res ? sb.from('restaurant_orders').select('*, restaurant_order_items(*, menu_items(name, price))').eq('room_number', res.room_number).order('created_at', { ascending: false }).limit(10) : { data: [] },
      ]);

      setMenuItems(menu.data || []);
      setCategories(cats.data || []);
      setOrders(myOrders.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter(c => c.id !== itemId);
      return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const handleSubmit = async () => {
    if (cart.length === 0 || !roomNumber) return;
    setSubmitting(true);
    try {
      const { data: result, error } = await sb.rpc('create_order_rate_limited', {
        p_source: 'guest_app',
        p_room_number: roomNumber,
        p_guest_name: user?.email?.split('@')[0] || 'Guest',
        p_items: cart.map(c => ({ menu_item_id: c.id, quantity: c.quantity })),
      });
      if (error) throw error;
      setCart([]);
      toast.success('Order sent to kitchen!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
    setSubmitting(false);
  };

  const filtered = activeCategory === 'all' ? menuItems : menuItems.filter(i => i.category_id === activeCategory);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-navy text-white px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/guest"><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="font-display text-xl font-bold">Order Food</h1>
          </div>
          {roomNumber && <Badge className="bg-brass/20 text-brass">Room {roomNumber}</Badge>}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* My Orders */}
        {orders.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> My Orders</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {orders.slice(0, 3).map((o: any) => {
                const eta = o.estimated_ready_at ? Math.max(0, Math.ceil((new Date(o.estimated_ready_at).getTime() - Date.now()) / 60000)) : null;
                return (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">#{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{o.restaurant_order_items?.map((i: any) => i.menu_items?.name).join(', ')}</p>
                    </div>
                    <Badge className={
                      o.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                      o.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }>
                      {o.status === 'ready' ? 'Ready!' : o.status === 'preparing' ? `~${eta}m` : o.status}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setActiveCategory('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCategory === 'all' ? 'bg-brass text-white' : 'bg-muted'}`}>All</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCategory === cat.id ? 'bg-brass text-white' : 'bg-muted'}`}>{cat.name}</button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {filtered.map(item => {
            const qty = cart.find(c => c.id === item.id)?.quantity || 0;
            return (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(Number(item.price))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                        <span className="text-sm font-medium w-5 text-center">{qty}</span>
                      </>
                    )}
                    <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-brass/10 flex items-center justify-center text-brass"><Plus className="h-3 w-3" /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <Card className="border-brass">
            <CardContent className="p-4 space-y-2">
              {cart.map(c => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.name} × {c.quantity}</span>
                  <span>{formatCurrency(c.price * c.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Charged to Room {roomNumber}</p>
              <Button variant="brass" className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Add to Room Bill
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
