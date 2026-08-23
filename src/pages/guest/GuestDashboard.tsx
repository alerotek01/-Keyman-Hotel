import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Loader2, BedDouble, Receipt, UtensilsCrossed, MessageSquare, LogOut, Calendar, CreditCard, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function GuestDashboard() {
  const { user, signOut } = useAuth();
  const [guest, setGuest] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeFolio, setActiveFolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get guest record
      const { data: g } = await sb.from('guests').select('*').eq('user_id', user?.id).single();
      setGuest(g);

      if (g) {
        // Get all reservations
        const { data: res } = await sb
          .from('reservations')
          .select('*, rooms(room_number, room_types(name, base_rate))')
          .eq('guest_id', g.id)
          .order('created_at', { ascending: false });
        setReservations(res || []);

        // Get active folio
        const activeRes = res?.find((r: any) => r.status === 'checked_in');
        if (activeRes) {
          const { data: f } = await sb.from('guest_folios').select('*').eq('reservation_id', activeRes.id).single();
          if (f) {
            const { data: txns } = await sb.from('folio_transactions').select('*').eq('folio_id', f.id).order('created_at', { ascending: false });
            setActiveFolio({ ...f, transactions: txns || [] });
          }
        }

        // Get booking payments (transaction history)
        const { data: payments } = await sb
          .from('booking_payments')
          .select('*')
          .in('reservation_id', (res || []).map((r: any) => r.id))
          .order('created_at', { ascending: false });
        setTransactions(payments || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  const upcoming = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked_in');
  const past = reservations.filter(r => r.status === 'checked_out' || r.status === 'cancelled');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy text-white px-6 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="font-display text-xl font-bold">Hi {guest?.name || user?.email?.split('@')[0]} 👋</h1>
            <p className="text-white/60 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <Link to="/guest/booking">
            <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-3 text-center"><Plus className="h-5 w-5 mx-auto text-brass mb-1" /><p className="text-[10px] font-medium">Book</p></CardContent></Card>
          </Link>
          <Link to="/guest/folio">
            <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-3 text-center"><Receipt className="h-5 w-5 mx-auto text-brass mb-1" /><p className="text-[10px] font-medium">Folio</p></CardContent></Card>
          </Link>
          <Link to="/guest/order">
            <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-3 text-center"><UtensilsCrossed className="h-5 w-5 mx-auto text-brass mb-1" /><p className="text-[10px] font-medium">Food</p></CardContent></Card>
          </Link>
          <Link to="/guest/chat">
            <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-3 text-center"><MessageSquare className="h-5 w-5 mx-auto text-brass mb-1" /><p className="text-[10px] font-medium">Chat</p></CardContent></Card>
          </Link>
        </div>

        {/* Active Folio */}
        {activeFolio && (
          <Card className="border-brass">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Current Stay</p>
                  <p className="text-lg font-bold">{formatCurrency(activeFolio.transactions?.reduce((s: number, t: any) => s + Number(t.amount), 0) || 0)}</p>
                </div>
                <Link to="/guest/folio"><Button variant="outline" size="sm">View Folio</Button></Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Reservations */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Upcoming</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No upcoming reservations</p>
                <Link to="/guest/booking"><Button variant="brass" size="sm"><Plus className="mr-1 h-3 w-3" /> Book Now</Button></Link>
              </div>
            ) : upcoming.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Room {r.rooms?.room_number} · {r.rooms?.room_types?.name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.check_in), 'MMM d')} – {format(new Date(r.check_out), 'MMM d')}</p>
                </div>
                <div className="text-right">
                  <Badge className={r.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>
                    {r.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                  </Badge>
                  {r.deposit_amount > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.deposit_paid ? '✅ Deposit paid' : `💰 Deposit: ${formatCurrency(r.deposit_amount)}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Past Stays */}
        {past.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Past Stays</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {past.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">Room {r.rooms?.room_number}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.check_in), 'MMM d')} – {format(new Date(r.check_out), 'MMM d')}</p>
                  </div>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No payments yet</p>
            ) : transactions.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg text-sm">
                <div>
                  <p className="font-medium">{t.method?.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'MMM d, h:mm a')}</p>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{formatCurrency(t.amount)}</span>
                  <Badge className={`ml-2 text-[10px] ${t.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
