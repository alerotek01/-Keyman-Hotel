import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useStaffShifts, useStartShift, useEndShift, useSubmitReconciliation, useShiftSummary } from '@/hooks/usePayments';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Play, Square, Send, Clock, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShiftManager() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const { data: shifts, isLoading } = useStaffShifts(user?.id, today);
  const startShift = useStartShift();
  const endShift = useEndShift();
  const submitReconciliation = useSubmitReconciliation();

  const [reconDialog, setReconDialog] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [reconForm, setReconForm] = useState({
    actual_cash: '',
    notes: '',
  });

  const { data: shiftSummary } = useShiftSummary(activeShift?.id || '');

  const currentShift = shifts?.find(s => s.status === 'active');
  const todayShifts = shifts || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const handleStartShift = async (shiftName: string) => {
    try {
      await startShift.mutateAsync({
        user_id: user?.id || '',
        shift_date: today,
        shift_name: shiftName,
      });
      toast.success(`${shiftName} shift started!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleEndShift = async () => {
    if (!currentShift) return;
    try {
      await endShift.mutateAsync({ shiftId: currentShift.id });
      setActiveShift(currentShift);
      setReconDialog(true);
      toast.success('Shift ended. Please reconcile.');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleSubmitReconciliation = async () => {
    if (!activeShift || !shiftSummary) return;
    try {
      await submitReconciliation.mutateAsync({
        shift_id: activeShift.id,
        submitted_by: user?.id || '',
        sales_total: shiftSummary.salesTotal,
        cash_total: shiftSummary.cashTotal,
        mpesa_total: shiftSummary.mpesaTotal,
        room_charges_total: 0,
        expected_cash: shiftSummary.cashTotal,
        actual_cash: parseFloat(reconForm.actual_cash) || 0,
        notes: reconForm.notes || undefined,
      });
      setReconDialog(false);
      setActiveShift(null);
      setReconForm({ actual_cash: '', notes: '' });
      toast.success('Reconciliation submitted for manager approval');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const shiftStatusConfig: Record<string, { color: string; label: string }> = {
    not_started: { color: 'bg-gray-100 text-gray-800', label: 'Scheduled' },
    active: { color: 'bg-blue-100 text-blue-800', label: 'Active' },
    ended: { color: 'bg-amber-100 text-amber-800', label: 'Ended' },
    submitted: { color: 'bg-purple-100 text-purple-800', label: 'Submitted' },
    reconciled: { color: 'bg-emerald-100 text-emerald-800', label: 'Reconciled' },
    closed: { color: 'bg-gray-100 text-gray-800', label: 'Closed' },
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">My Shift</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Active Shift */}
      {currentShift ? (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              Active Shift — {currentShift.shift_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">{currentShift.start_time ? format(new Date(currentShift.start_time), 'h:mm a') : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {currentShift.start_time
                    ? `${Math.round((Date.now() - new Date(currentShift.start_time).getTime()) / 60000)} min`
                    : '—'}
                </p>
              </div>
            </div>
            <Button variant="destructive" className="w-full" onClick={handleEndShift} disabled={endShift.isPending}>
              {endShift.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
              End Shift & Reconcile
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Start Shift */
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Start a Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {['morning', 'afternoon', 'night'].map(name => (
                <button
                  key={name}
                  onClick={() => handleStartShift(name)}
                  disabled={startShift.isPending}
                  className="p-4 rounded-xl border hover:border-brass hover:bg-brass/5 transition-all text-center capitalize"
                >
                  <Clock className="h-6 w-6 text-brass mx-auto mb-2" />
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {name === 'morning' ? '6am - 2pm' : name === 'afternoon' ? '2pm - 10pm' : '10pm - 6am'}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No shifts today</p>
          ) : (
            <div className="space-y-3">
              {todayShifts.map(shift => {
                const cfg = shiftStatusConfig[shift.status] || { color: 'bg-gray-100 text-gray-800', label: shift.status };
                return (
                  <div key={shift.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium capitalize">{shift.shift_name} Shift</p>
                        <p className="text-xs text-muted-foreground">
                          {shift.start_time ? format(new Date(shift.start_time), 'h:mm a') : '—'}
                          {shift.end_time ? ` → ${format(new Date(shift.end_time), 'h:mm a')}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge className={cfg.color}>{cfg.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation Dialog */}
      {reconDialog && shiftSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Shift Reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sales</span>
                  <span className="font-medium">{formatCurrency(shiftSummary.salesTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Collected</span>
                  <span className="font-medium">{formatCurrency(shiftSummary.cashTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">M-Pesa Collected</span>
                  <span className="font-medium">{formatCurrency(shiftSummary.mpesaTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders</span>
                  <span className="font-medium">{shiftSummary.ordersCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Actual Cash in Hand (KES)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={reconForm.actual_cash}
                  onChange={(e) => setReconForm({ ...reconForm, actual_cash: e.target.value })}
                  placeholder="Count your cash and enter amount"
                />
                {reconForm.actual_cash && (
                  <div className="flex items-center gap-2 text-sm">
                    {parseFloat(reconForm.actual_cash) >= shiftSummary.cashTotal ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Cash matches or exceeds expected</span></>
                    ) : (
                      <><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-amber-600">Shortage: {formatCurrency(shiftSummary.cashTotal - parseFloat(reconForm.actual_cash))}</span></>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={reconForm.notes}
                  onChange={(e) => setReconForm({ ...reconForm, notes: e.target.value })}
                  placeholder="Any discrepancies or notes"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setReconDialog(false)}>Cancel</Button>
                <Button variant="brass" className="flex-1" onClick={handleSubmitReconciliation} disabled={submitReconciliation.isPending}>
                  {submitReconciliation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" /> Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
