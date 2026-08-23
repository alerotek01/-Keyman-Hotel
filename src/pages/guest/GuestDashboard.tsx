import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Loader2, BedDouble, Receipt, UtensilsCrossed, MessageSquare, LogOut, Clock } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function GuestDashboard() {
  const { user, signOut } = useAuth();
  const [reservation, setReservation] = useState<any>(null);
  const [folio, setFolio] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Find guest record
      const { data: guest } = await sb.from('guests').select('id').eq('user_id', user?.id).single();
      if (!guest) { setLoading(false); return; }

      // Get active reservation
      const { data: res } = await sb
        .from('reservations')
        .select('*, rooms(room_number, room_types(name, base_rate))')
        .eq('guest_id', guest.id)
        .in('status', ['confirmed', 'checked_in'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      setReservation(res);

      if (res) {
        // Get folio
        const { data: folioData } = await sb
          .from('guest_folios')
          .select('*')
          .eq('reservation_id', res.id)
          .single();
        setFolio(folioData);

        if (folioData) {
          // Get charges
          const { data: txns } = await sb
            .from('folio_transactions')
            .select('*')
            .eq('folio_id', folioData.id)
            .order('created_at', { ascending: false });
          setCharges(txns || []);
        }

        // Get active restaurant orders
        const { data: orders } = await sb
          .from('restaurant_orders')
          .select('*, restaurant_order_items(*, menu_items(name, price))')
          .eq('room_number', res.rooms?.room_number)
          .not('status', 'in', '(cancelled,payment_verified)')
          .order('created_at', { ascending: false });
        setActiveOrders(orders || []);
      }
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const totalCharges = charges.filter(c => c.type !== 'refund').reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid = 0; // Will calculate from folio_payments
  const balance = totalCharges - totalPaid;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy text-white px-6 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="font-display text-xl font-bold">
              Hi {user?.email?.split('@')[0]} 👋
            </h1>
            {reservation && (
              <p className="text-white/60 text-sm">
                Room {reservation.rooms?.room_number} · {reservation.rooms?.room_types?.name}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/guest/folio">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-3 text-center">
                <Receipt className="h-6 w-6 mx-auto text-brass mb-1" />
                <p className="text-lg font-bold">{formatCurrency(totalCharges)}</p>
                <p className="text-[10px] text-muted-foreground">Folio</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guest/order">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-3 text-center">
                <UtensilsCrossed className="h-6 w-6 mx-auto text-brass mb-1" />
                <p className="text-lg font-bold">{activeOrders.length}</p>
                <p className="text-[10px] text-muted-foreground">Orders</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guest/chat">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-3 text-center">
                <MessageSquare className="h-6 w-6 mx-auto text-brass mb-1" />
                <p className="text-lg font-bold">💬</p>
                <p className="text-[10px] text-muted-foreground">Chat</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Active Orders with ETA */}
        {activeOrders.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeOrders.map((order: any) => {
                const eta = order.estimated_ready_at
                  ? Math.max(0, Math.ceil((new Date(order.estimated_ready_at).getTime() - Date.now()) / 60000))
                  : null;
                return (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Order #{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.restaurant_order_items?.map((i: any) => i.menu_items?.name).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        order.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }>
                        {order.status === 'ready' ? 'Ready!' :
                         order.status === 'preparing' ? `~${eta} min` :
                         order.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{formatCurrency(order.total)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Charges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No charges yet</p>
            ) : (
              charges.slice(0, 5).map((charge: any) => (
                <div key={charge.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{charge.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(charge.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(charge.amount)}</span>
                </div>
              ))
            )}
            {charges.length > 5 && (
              <Link to="/guest/folio" className="block text-center text-sm text-brass hover:underline">
                View all charges →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/guest/order">
            <Button variant="brass" className="w-full">
              <UtensilsCrossed className="mr-2 h-4 w-4" /> Order Food
            </Button>
          </Link>
          <Link to="/guest/chat">
            <Button variant="outline" className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" /> Chat with Us
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
