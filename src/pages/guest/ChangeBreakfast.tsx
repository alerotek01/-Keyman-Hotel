import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useBreakfastSelections, useBreakfastMenuItems, BreakfastSelection } from '@/hooks/useBreakfast';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Clock, AlertTriangle, CheckCircle2, ArrowRight, Utensils } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Props {
  reservationId: string;
  guestName?: string;
}

export default function ChangeBreakfast({ reservationId, guestName }: Props) {
  const { data: selections, isLoading } = useBreakfastSelections(reservationId);
  const { data: menuItems } = useBreakfastMenuItems();
  const [changing, setChanging] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<Record<string, string>>({});

  const today = new Date().toISOString().split('T')[0];

  // Group selections by date
  const byDate = (selections ?? []).reduce((acc, sel) => {
    if (!acc[sel.meal_date]) acc[sel.meal_date] = [];
    acc[sel.meal_date].push(sel);
    return acc;
  }, {} as Record<string, BreakfastSelection[]>);

  const handleSwap = async (sel: BreakfastSelection, newMenuItemId: string) => {
    if (!newMenuItemId || newMenuItemId === sel.menu_item_id) return;
    
    const newMenuItem = menuItems?.find(m => m.id === newMenuItemId);
    if (!newMenuItem) return;

    setChanging(sel.id);
    try {
      const { data, error } = await sb.rpc('change_breakfast_selection', {
        p_reservation_id: reservationId,
        p_meal_date: sel.meal_date,
        p_old_selection_id: sel.id,
        p_new_menu_item_id: newMenuItemId,
        p_new_quantity: sel.quantity,
        p_change_type: 'swap_item',
      });
      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        if (result.variance > 0) {
          toast.success(`Changed! +KES ${result.variance} added to your folio. Pay at checkout.`);
        } else if (result.variance < 0) {
          toast.success(`Changed! KES ${Math.abs(result.variance)} credited to your folio.`);
        } else {
          toast.success('Breakfast changed — no price difference.');
        }
      } else {
        toast.error(result?.message || 'Change failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to change');
    }
    setChanging(null);
    setSwapTarget(prev => {
      const next = { ...prev };
      delete next[sel.id];
      return next;
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!selections || selections.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No breakfast selections</p>
          <p className="text-sm">You didn't select B&B breakfast for this stay.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h2 className="text-lg font-bold">Change Breakfast</h2>
        <p className="text-sm text-muted-foreground">
          Modify your breakfast order up to 5 hours before serving
        </p>
      </div>

      {Object.entries(byDate).map(([date, sels]) => {
        const isPast = date < today;
        const dayTotal = sels.reduce((sum, s) => sum + s.item_price * s.quantity, 0);
        const pax = sels[0]?.pax ?? 1;

        return (
          <Card key={date} className={isPast ? 'opacity-50' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                </CardTitle>
                {isPast ? (
                  <Badge variant="secondary">Past</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    <Clock className="h-3 w-3 mr-1" />
                    Changeable
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {sels.map(sel => (
                <div key={sel.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sel.quantity}x {sel.item_name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(sel.item_price)} per person × {pax} = {formatCurrency(sel.item_price * pax)}</p>
                  </div>
                  {!isPast && menuItems && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={swapTarget[sel.id] || ''}
                        onValueChange={(v) => setSwapTarget(prev => ({ ...prev, [sel.id]: v }))}
                      >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Swap to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {menuItems.map(item => (
                            <SelectItem key={item.id} value={item.id} disabled={item.id === sel.menu_item_id}>
                              {item.name} — {formatCurrency(item.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {swapTarget[sel.id] && swapTarget[sel.id] !== sel.menu_item_id && (
                        <Button
                          size="sm"
                          onClick={() => handleSwap(sel, swapTarget[sel.id])}
                          disabled={changing === sel.id}
                        >
                          {changing === sel.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <Separator className="my-2" />
              <p className="text-xs font-semibold text-right">
                Day total: {formatCurrency(dayTotal)} × {pax} = {formatCurrency(dayTotal * pax)}
              </p>
            </CardContent>
          </Card>
        );
      })}

      <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-lg text-sm">
        <p className="font-medium text-amber-800 dark:text-amber-200">📋 Change Policy</p>
        <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-1">
          <li>• Changes allowed up to <strong>5 hours before breakfast</strong> (06:30 serving)</li>
          <li>• If the new item costs more, the <strong>difference is added to your folio</strong> — pay at checkout</li>
          <li>• If the new item costs less, the <strong>difference is credited</strong> to your folio</li>
          <li>• Changes after the cutoff cannot be modified</li>
        </ul>
      </div>
    </div>
  );
}
