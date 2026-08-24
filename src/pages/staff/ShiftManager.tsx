import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffShifts, useStartShift, useEndShift, useSubmitReconciliation, useShiftSummary } from '@/hooks/usePayments';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';import { Loader2, Play, Square, Send, Clock, DollarSign, AlertTriangle, CheckCircle2,
  Smartphone, Camera, Receipt, ChevronDown, ChevronRight, FileText,
  Upload, Check, X, UtensilsCrossed, BedDouble, CreditCard, Download, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReconciliationAlert from '@/components/ReconciliationAlert';
import { FilterBar, type FilterState } from '@/components/FilterBar';
import { generateShiftCSV, downloadCSV, generateShiftPDFReport } from '@/lib/export';

const sb = supabase as any;

export default function ShiftManager() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const { data: shifts, isLoading } = useStaffShifts(user?.id, today);
  const startShift = useStartShift();
  const endShift = useEndShift();
  const submitReconciliation = useSubmitReconciliation();

  const [reconDialog, setReconDialog] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [reconTab, setReconTab] = useState('summary');
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [mpesaDialog, setMpesaDialog] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');

  // Reconciliation form state
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [varianceExplanation, setVarianceExplanation] = useState('');
  const [proofType, setProofType] = useState<'mpesa_message' | 'receipt' | 'both'>('mpesa_message');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const { data: shiftSummary } = useShiftSummary(activeShift?.id || '');
  const [historyFilters, setHistoryFilters] = useState<FilterState>({ search: '', department: '', dateFrom: '', dateTo: '', status: [] });
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Fetch shift history for current user
  const { data: shiftHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['shift-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await sb
        .from('staff_shifts')
        .select('*, departments:department_id(name), shift_reconciliations(*)')
        .eq('user_id', user.id)
        .order('shift_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch transactions for expanded history shift
  const expandedShiftData = expandedHistory ? shiftHistory?.find((s: any) => s.id === expandedHistory) : null;
  const { data: historyTransactions, isLoading: histTxLoading } = useQuery({
    queryKey: ['history-transactions', expandedHistory],
    queryFn: async () => {
      if (!expandedHistory || !expandedShiftData) return { payments: [], orders: [] };
      try {
        const { data, error } = await sb.rpc('get_shift_transactions', {
          p_staff_id: user?.id,
          p_shift_date: expandedShiftData.shift_date,
        });
        if (error) return { payments: [], orders: [] };
        const fnData = Array.isArray(data) ? data[0] : data;
        return fnData?.get_shift_transactions || fnData?.result || fnData || { payments: [], orders: [] };
      } catch { return { payments: [], orders: [] }; }
    },
    enabled: !!expandedHistory && !!expandedShiftData,
  });

  // Filter history
  const filteredHistory = useMemo(() => {
    if (!shiftHistory) return [];
    return shiftHistory.filter((s: any) => {
      if (historyFilters.dateFrom && s.shift_date < historyFilters.dateFrom) return false;
      if (historyFilters.dateTo && s.shift_date > historyFilters.dateTo) return false;
      if (historyFilters.status.length > 0 && !historyFilters.status.includes(s.status)) return false;
      return true;
    });
  }, [shiftHistory, historyFilters]);

  const currentShift = shifts?.find(s => s.status === 'active');
  const todayShifts = shifts || [];

  const variance = shiftSummary && actualCash
    ? parseFloat(actualCash) - shiftSummary.cashTotal
    : 0;
  const hasVariance = variance !== 0 && actualCash !== '';

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
      setReconTab('summary');
      toast.success('Shift ended. Please submit your reconciliation.');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleSubmitReconciliation = async () => {
    if (!activeShift || !shiftSummary) return;
    if (!actualCash || parseFloat(actualCash) < 0) {
      toast.error('Please enter your actual cash amount');
      return;
    }
    if (hasVariance && !varianceExplanation.trim()) {
      toast.error('Please explain the variance before submitting');
      return;
    }
    try {
      await submitReconciliation.mutateAsync({
        shift_id: activeShift.id,
        submitted_by: user?.id || '',
        sales_total: shiftSummary.salesTotal,
        cash_total: shiftSummary.cashTotal,
        mpesa_total: shiftSummary.mpesaTotal,
        room_charges_total: 0,
        expected_cash: shiftSummary.cashTotal,
        actual_cash: parseFloat(actualCash),
        notes: notes || undefined,
        variance_explanation: hasVariance ? varianceExplanation : undefined,
        variance_proof_type: hasVariance ? proofType : undefined,
        proofFile: hasVariance ? proofFile : null,
      });
      setReconDialog(false);
      setActiveShift(null);
      setActualCash('');
      setNotes('');
      setVarianceExplanation('');
      setProofFile(null);
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

      {/* Flagged Reconciliation Alert — shows when manager has flagged */}
      <ReconciliationAlert />

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

      {/* Shift Tabs: Today + History */}
      <Tabs defaultValue="today">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="today">Today&apos;s Shifts</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" /> Shift History</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardContent className="pt-4">
              {todayShifts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No shifts today</p>
              ) : (
                <div className="space-y-3">
                  {todayShifts.map(shift => {
                    const cfg = shiftStatusConfig[shift.status] || { color: 'bg-gray-100 text-gray-800', label: shift.status };
                    const duration = shift.start_time && shift.end_time
                      ? differenceInMinutes(new Date(shift.end_time), new Date(shift.start_time))
                      : shift.start_time ? Math.round((Date.now() - new Date(shift.start_time).getTime()) / 60000) : 0;
                    return (
                      <div key={shift.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium capitalize">{shift.shift_name} Shift</p>
                            <p className="text-xs text-muted-foreground">
                              {shift.start_time ? format(new Date(shift.start_time), 'h:mm a') : '—'}
                              {shift.end_time ? ` → ${format(new Date(shift.end_time), 'h:mm a')}` : ''}
                              {duration > 0 && ` · ${duration}min`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                          {shift.status === 'ended' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setActiveShift(shift); setReconDialog(true); setReconTab('summary'); }}
                            >
                              <Send className="h-3 w-3 mr-1" /> Reconcile
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-4">
            {/* Filters */}
            <FilterBar
              filters={historyFilters}
              onChange={setHistoryFilters}
              showDepartment={false}
              showStatus={true}
              statusOptions={[
                { value: 'active', label: 'Active', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                { value: 'ended', label: 'Ended', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { value: 'reconciled', label: 'Reconciled', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-700 border-gray-200' },
              ]}
            />

            {/* Summary Stats */}
            {filteredHistory.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-3 pb-2"><p className="text-xs text-muted-foreground">Total Shifts</p><p className="text-xl font-bold">{filteredHistory.length}</p></CardContent></Card>
                <Card><CardContent className="pt-3 pb-2"><p className="text-xs text-muted-foreground">Reconciled</p><p className="text-xl font-bold text-emerald-600">{filteredHistory.filter((s: any) => s.status === 'reconciled' || s.status === 'closed').length}</p></CardContent></Card>
                <Card><CardContent className="pt-3 pb-2"><p className="text-xs text-muted-foreground">With Variance</p><p className="text-xl font-bold text-amber-600">{filteredHistory.filter((s: any) => s.shift_reconciliations?.[0]?.variance !== 0).length}</p></CardContent></Card>
              </div>
            )}

            {/* Shift History Cards */}
            {historyLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>
            ) : filteredHistory.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No shift history found</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((shift: any) => {
                  const cfg = shiftStatusConfig[shift.status] || { color: 'bg-gray-100 text-gray-800', label: shift.status };
                  const recon = shift.shift_reconciliations?.[0];
                  const duration = shift.start_time && shift.end_time
                    ? differenceInMinutes(new Date(shift.end_time), new Date(shift.start_time)) : 0;
                  const isExpanded = expandedHistory === shift.id;

                  return (
                    <Card key={shift.id} className={cn(
                      'transition-all',
                      recon?.variance ? 'border-l-4 border-l-amber-500' : ''
                    )}>
                      <CardContent className="p-0">
                        {/* Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                          onClick={() => setExpandedHistory(isExpanded ? null : shift.id)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium capitalize">{shift.shift_name} Shift</p>
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {shift.shift_date} · {duration > 0 ? `${duration}min` : '—'}
                              {recon && ` · Variance: ${recon.variance >= 0 ? '+' : ''}KES ${Math.abs(recon.variance)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm" variant="outline" className="h-7 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const csv = generateShiftCSV(recon || { staff_shifts: shift, status: shift.status, variance: 0, sales_total: 0, cash_total: 0, mpesa_total: 0 }, historyTransactions?.payments || [], historyTransactions?.orders || []);
                                  downloadCSV(csv, `shift-${shift.shift_name}-${shift.shift_date}.csv`);
                                  toast.success('CSV downloaded');
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" /> CSV
                              </Button>
                              <Button
                                size="sm" variant="outline" className="h-7 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateShiftPDFReport(recon || { staff_shifts: shift, status: shift.status, variance: 0, sales_total: 0, cash_total: 0, mpesa_total: 0 }, historyTransactions?.payments || [], historyTransactions?.orders || []);
                                }}
                              >
                                <FileText className="h-3 w-3 mr-1" /> PDF
                              </Button>
                            </div>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div className="border-t p-4">
                            {histTxLoading ? (
                              <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-brass" /></div>
                            ) : (
                              <div className="space-y-4">
                                {/* Reconciliation Details */}
                                {recon && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Reconciliation</p>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                      <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Sales</p><p className="font-medium">KES {(recon.sales_total || 0).toLocaleString()}</p></div>
                                      <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Cash</p><p className="font-medium">KES {(recon.cash_total || 0).toLocaleString()}</p></div>
                                      <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">M-Pesa</p><p className="font-medium">KES {(recon.mpesa_total || 0).toLocaleString()}</p></div>
                                    </div>
                                    {recon.variance !== 0 && (
                                      <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                                        <p className={cn('font-medium', recon.variance < 0 ? 'text-red-600' : 'text-amber-600')}>
                                          Variance: {recon.variance >= 0 ? '+' : ''}KES {Math.abs(recon.variance)}
                                        </p>
                                        {recon.variance_explanation && <p className="text-xs text-muted-foreground mt-1 italic">"{recon.variance_explanation}"</p>}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Payments */}
                                {historyTransactions?.payments?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Payments ({historyTransactions.payments.length})</p>
                                    <div className="space-y-1.5">
                                      {historyTransactions.payments.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                          <div className="flex items-center gap-2">
                                            {p.method === 'mpesa' ? <Smartphone className="h-3.5 w-3.5 text-emerald-600" /> : <DollarSign className="h-3.5 w-3.5 text-blue-600" />}
                                            <span>KES {(p.amount || 0).toLocaleString()}</span>
                                            <Badge variant="outline" className="text-[10px] capitalize">{p.method}</Badge>
                                            {p.mpesa_code && <span className="text-xs font-mono text-emerald-600">{p.mpesa_code}</span>}
                                          </div>
                                          {p.receipt_image_url && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Orders */}
                                {historyTransactions?.orders?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Orders ({historyTransactions.orders.length})</p>
                                    <div className="space-y-1.5">
                                      {historyTransactions.orders.map((o: any) => (
                                        <div key={o.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                          <div>
                                            <span className="font-medium">#{o.order_number}</span>
                                            <span className="text-muted-foreground ml-2">{o.guest_name || 'Walk-in'}</span>
                                          </div>
                                          <span>KES {(o.total_amount || 0).toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {!historyTransactions?.payments?.length && !historyTransactions?.orders?.length && (
                                  <p className="text-sm text-muted-foreground text-center py-4">No transactions recorded for this shift</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================= */}
      {/* RECONCILIATION DIALOG — Full Form */}
      {/* ========================================= */}
      <Dialog open={reconDialog} onOpenChange={setReconDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Shift Reconciliation
            </DialogTitle>
            {shiftSummary && (
              <p className="text-sm text-muted-foreground">
                {shiftSummary.shift?.shift_name} shift · {shiftSummary.shift?.shift_date}
              </p>
            )}
          </DialogHeader>

          {shiftSummary ? (
            <Tabs value={reconTab} onValueChange={setReconTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="submit">Submit</TabsTrigger>
              </TabsList>

              {/* TAB 1: Summary */}
              <TabsContent value="summary" className="space-y-4 mt-4">
                {/* Financial Summary */}
                <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sales</span>
                    <span className="font-medium">{formatCurrency(shiftSummary.salesTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash Collected</span>
                    <span className="font-medium flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-blue-500" />
                      {formatCurrency(shiftSummary.cashTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">M-Pesa Collected</span>
                    <span className="font-medium flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-emerald-500" />
                      {formatCurrency(shiftSummary.mpesaTotal)}
                    </span>
                  </div>
                  {shiftSummary.cardPayments?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Card Payments</span>
                      <span className="font-medium flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-purple-500" />
                        {formatCurrency(shiftSummary.cardPayments.reduce((s: number, p: any) => s + Number(p.amount), 0))}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Payments</span>
                    <span>{shiftSummary.paymentsCount} transactions</span>
                  </div>
                </div>

                {/* Breakdown by method */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-blue-50 rounded text-center">
                    <DollarSign className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Cash</p>
                    <p className="text-sm font-bold">{shiftSummary.cashPayments?.length || 0}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded text-center">
                    <Smartphone className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">M-Pesa</p>
                    <p className="text-sm font-bold">{shiftSummary.mpesaPayments?.length || 0}</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded text-center">
                    <Receipt className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Other</p>
                    <p className="text-sm font-bold">{shiftSummary.cardPayments?.length || 0}</p>
                  </div>
                </div>

                <Button className="w-full" onClick={() => setReconTab('payments')}>
                  View Payment Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </TabsContent>

              {/* TAB 2: Payment Details */}
              <TabsContent value="payments" className="space-y-3 mt-4">
                {shiftSummary.payments?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No payments recorded during this shift</p>
                ) : (
                  <>
                    {/* Cash Payments */}
                    {shiftSummary.cashPayments?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Cash Payments ({shiftSummary.cashPayments.length})
                        </p>
                        {shiftSummary.cashPayments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <DollarSign className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(p.created_at), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {p.receipt_image_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => { setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
                                >
                                  <Camera className="h-3 w-3 text-blue-600" />
                                </Button>
                              )}
                              <Badge variant="outline" className="text-[10px]">Cash</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* M-Pesa Payments */}
                    {shiftSummary.mpesaPayments?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Smartphone className="h-3 w-3" /> M-Pesa Payments ({shiftSummary.mpesaPayments.length})
                        </p>
                        {shiftSummary.mpesaPayments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Smartphone className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-medium">{formatCurrency(p.amount)}</p>
                                {p.mpesa_transaction_id && (
                                  <button
                                    className="flex items-center gap-1 text-[11px] text-emerald-700 font-mono hover:underline"
                                    onClick={() => { setMpesaCode(p.mpesa_transaction_id); setMpesaDialog(true); }}
                                  >
                                    <Smartphone className="h-3 w-3" />
                                    {p.mpesa_transaction_id}
                                  </button>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(p.created_at), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {p.receipt_image_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => { setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
                                >
                                  <Camera className="h-3 w-3 text-blue-600" />
                                </Button>
                              )}
                              <Badge variant="outline" className="text-[10px]">M-Pesa</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Card/Other Payments */}
                    {shiftSummary.cardPayments?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Card Payments ({shiftSummary.cardPayments.length})
                        </p>
                        {shiftSummary.cardPayments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(p.created_at), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {p.receipt_image_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => { setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
                                >
                                  <Camera className="h-3 w-3 text-blue-600" />
                                </Button>
                              )}
                              <Badge variant="outline" className="text-[10px]">Card</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <Button variant="outline" className="w-full" onClick={() => setReconTab('submit')}>
                  Proceed to Submit <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </TabsContent>

              {/* TAB 3: Submit Reconciliation */}
              <TabsContent value="submit" className="space-y-4 mt-4">
                {/* Cash Count */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Actual Cash in Hand (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="Count your cash and enter amount"
                    className="text-lg font-mono"
                  />
                  {actualCash && (
                    <div className={cn(
                      'p-2 rounded-lg text-sm flex items-center gap-2',
                      hasVariance
                        ? variance < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        : 'bg-emerald-50 text-emerald-700'
                    )}>
                      {hasVariance ? (
                        <>
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>
                            Variance: <strong>{variance > 0 ? '+' : ''}{formatCurrency(variance)}</strong>
                            {variance < 0 ? ' (SHORT)' : ' (OVER)'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Cash matches expected — no variance</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Expected breakdown reminder */}
                <div className="p-2 bg-muted rounded text-xs space-y-1">
                  <p className="font-medium">Expected Cash: {formatCurrency(shiftSummary.cashTotal)}</p>
                  <p className="text-muted-foreground">M-Pesa: {formatCurrency(shiftSummary.mpesaTotal)} (not counted in cash)</p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Shift Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about the shift..."
                    rows={2}
                  />
                </div>

                {/* VARIANCE EXPLANATION — only shows when there's a variance */}
                {hasVariance && (
                  <div className="border-2 border-amber-200 rounded-lg p-4 space-y-3 bg-amber-50/50">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="font-semibold text-sm">Variance Explanation Required</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You have a variance of <strong className={variance < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                      </strong>. Please explain why and provide proof (M-Pesa message screenshot or receipt photo).
                    </p>

                    <div className="space-y-2">
                      <Label className="text-sm">Explanation *</Label>
                      <Textarea
                        value={varianceExplanation}
                        onChange={(e) => setVarianceExplanation(e.target.value)}
                        placeholder={variance < 0
                          ? "e.g. Gave wrong change of KES 50 to customer at table 3..."
                          : "e.g. Received a tip of KES 100 that wasn't recorded..."}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Proof Type</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={proofType === 'mpesa_message' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setProofType('mpesa_message')}
                        >
                          <Smartphone className="mr-1 h-3 w-3" /> M-Pesa Message
                        </Button>
                        <Button
                          type="button"
                          variant={proofType === 'receipt' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setProofType('receipt')}
                        >
                          <Receipt className="mr-1 h-3 w-3" /> Receipt
                        </Button>
                        <Button
                          type="button"
                          variant={proofType === 'both' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setProofType('both')}
                        >
                          <FileText className="mr-1 h-3 w-3" /> Both
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Upload Proof</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                      </div>
                      {proofFile && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <Check className="h-3 w-3" />
                          {proofFile.name}
                          <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setProofFile(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Take a screenshot of the M-Pesa confirmation message or a photo of the receipt
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setReconDialog(false)}>Cancel</Button>
                  <Button
                    variant="default"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSubmitReconciliation}
                    disabled={submitReconciliation.isPending || !actualCash}
                  >
                    {submitReconciliation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Submit Reconciliation
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brass" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* M-Pesa Code Dialog */}
      <Dialog open={mpesaDialog} onOpenChange={setMpesaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" /> M-Pesa Transaction
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Smartphone className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-xs text-muted-foreground">Transaction Code</p>
            <p className="text-2xl font-mono font-bold text-emerald-700 mt-1">{mpesaCode}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" /> Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img src={receiptUrl} alt="Receipt" className="w-full h-auto max-h-[60vh] object-contain bg-gray-50" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
