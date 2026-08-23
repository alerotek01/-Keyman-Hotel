import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, BedDouble, UtensilsCrossed, Receipt } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function CheckoutConfirmation({ reservationId }: { reservationId: string }) {
  const { user } = useAuth();
  const [folio, setFolio] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => { loadFolio(); }, [reservationId]);

  const loadFolio = async () => {
    setLoading(true);
    try {
      const { data: f } = await sb.from('guest_folios').select('*').eq('reservation_id', reservationId).single();
      setFolio(f);
      if (f) {
        const [txns, pays] = await Promise.all([
          sb.from('folio_transactions').select('*').eq('folio_id', f.id).order('created_at'),
          sb.from('folio_payments').select('*').eq('folio_id', f.id).order('created_at'),
        ]);
        setCharges(txns.data || []);
        setPayments(pays.data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const approveCharge = async (chargeId: string) => {
    try {
      await sb.from('folio_transactions').update({ approved_by: user?.id }).eq('id', chargeId);
      toast.success('Charge approved');
      loadFolio();
    } catch (e: any) { toast.error(e.message); }
  };

  const rejectCharge = async (chargeId: string) => {
    try {
      await sb.from('folio_transactions').delete().eq('id', chargeId);
      toast.success('Charge rejected');
      loadFolio();
    } catch (e: any) { toast.error(e.message); }
  };

  const approveAll = async () => {
    setApproving(true);
    try {
      const unapproved = charges.filter(c => c.requires_approval && !c.approved_by);
      await Promise.all(unapproved.map(c =>
        sb.from('folio_transactions').update({ approved_by: user?.id }).eq('id', c.id)
      ));
      toast.success(`${unapproved.length} charges approved`);
      loadFolio();
    } catch (e: any) { toast.error(e.message); }
    setApproving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>;

  const totalCharges = charges.filter(c => c.type !== 'refund').reduce((s, c) => s + Number(c.amount), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharges - totalPayments;
  const unapprovedCount = charges.filter(c => c.requires_approval && !c.approved_by).length;

  const iconMap: Record<string, any> = { room_charge: BedDouble, restaurant_charge: UtensilsCrossed, service_charge: Receipt };

  return (
    <div className="space-y-4">
      {/* Warning */}
      {unapprovedCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">{unapprovedCount} charges need approval</span>
            </div>
            <Button size="sm" variant="outline" onClick={approveAll} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Approve All
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charges */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Charges</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {charges.map((c: any) => {
            const Icon = iconMap[c.type] || Receipt;
            const isUnapproved = c.requires_approval && !c.approved_by;
            return (
              <div key={c.id} className={`flex items-center gap-3 p-2 rounded-lg ${isUnapproved ? 'bg-amber-50 border border-amber-200' : 'bg-muted/30'}`}>
                <div className="w-8 h-8 rounded-lg bg-brass/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-brass" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.description}</p>
                  <p className="text-xs text-muted-foreground">{c.type.replace('_', ' ')}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                {isUnapproved && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => approveCharge(c.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => rejectCharge(c.id)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {c.approved_by && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">✓</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-navy text-white">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between"><span className="text-white/60">Total Charges</span><span>{formatCurrency(totalCharges)}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Total Paid</span><span>{formatCurrency(totalPayments)}</span></div>
          <div className="flex justify-between border-t border-white/20 pt-2"><span className="font-semibold">Balance Due</span><span className="text-brass font-bold text-lg">{formatCurrency(balance)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
