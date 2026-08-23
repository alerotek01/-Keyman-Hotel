import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Receipt, BedDouble, UtensilsCrossed, CreditCard } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function GuestFolio() {
  const { user } = useAuth();
  const [folio, setFolio] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id')
        .eq('guest_id', guest.id)
        .in('status', ['confirmed', 'checked_in'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (res) {
        const { data: f } = await sb.from('guest_folios').select('*').eq('reservation_id', res.id).single();
        setFolio(f);

        if (f) {
          const [txns, pays] = await Promise.all([
            sb.from('folio_transactions').select('*').eq('folio_id', f.id).order('created_at'),
            sb.from('folio_payments').select('*').eq('folio_id', f.id).order('created_at'),
          ]);
          setCharges(txns.data || []);
          setPayments(pays.data || []);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;

  const totalCharges = charges.filter(c => c.type !== 'refund').reduce((s, c) => s + Number(c.amount), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharges - totalPayments;

  const chargeTypeIcon: Record<string, any> = {
    room_charge: BedDouble,
    restaurant_charge: UtensilsCrossed,
    service_charge: Receipt,
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
        {/* Summary */}
        <Card className="bg-gradient-to-r from-navy to-navy/80 text-white">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/60 text-sm">Total Charges</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCharges)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-sm">Balance Due</p>
                <p className="text-2xl font-bold text-brass">{formatCurrency(balance)}</p>
              </div>
            </div>
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-white/60">Paid: {formatCurrency(totalPayments)}</span>
              <Badge className={balance > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}>
                {balance > 0 ? 'Amount Due' : 'Settled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Charges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No charges</p>
            ) : charges.map((c: any) => {
              const Icon = chargeTypeIcon[c.type] || Receipt;
              return (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-lg bg-brass/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-brass" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()} · {c.type.replace('_', ' ')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Payments */}
        {payments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.method?.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">-{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
