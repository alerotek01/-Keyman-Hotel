import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useApproveReconciliation } from '@/hooks/usePayments';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock,
  Receipt, Smartphone, Camera, Eye, Ban, ChefHat, UtensilsCrossed,
  BedDouble, Sparkles, LogIn, LogOut, ChevronDown, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLE_CONFIG: Record<string, { icon: any; color: string; label: string; hasTransactions: boolean }> = {
  receptionist: { icon: BedDouble, color: 'bg-emerald-100 text-emerald-700', label: 'Receptionist', hasTransactions: true },
  waiter: { icon: UtensilsCrossed, color: 'bg-orange-100 text-orange-700', label: 'Waiter', hasTransactions: true },
  chef: { icon: ChefHat, color: 'bg-purple-100 text-purple-700', label: 'Chef', hasTransactions: true },
  housekeeper: { icon: Sparkles, color: 'bg-amber-100 text-amber-700', label: 'Housekeeper', hasTransactions: false },
  manager: { icon: LogIn, color: 'bg-blue-100 text-blue-700', label: 'Manager', hasTransactions: false },
  admin: { icon: LogIn, color: 'bg-red-100 text-red-700', label: 'Admin', hasTransactions: false },
  accountant: { icon: DollarSign, color: 'bg-teal-100 text-teal-700', label: 'Accountant', hasTransactions: false },
};

const RECON_STATUS: Record<string, { color: string; label: string }> = {
  submitted: { color: 'bg-amber-100 text-amber-700', label: 'Pending Review' },
  approved: { color: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
  flagged: { color: 'bg-red-100 text-red-700', label: 'Flagged' },
  explained: { color: 'bg-blue-100 text-blue-700', label: 'Explained' },
  reconciled: { color: 'bg-emerald-100 text-emerald-700', label: 'Reconciled' },
  closed: { color: 'bg-gray-100 text-gray-700', label: 'Closed' },
};

export default function Reconciliation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [flagDialog, setFlagDialog] = useState(false);
  const [selectedRecon, setSelectedRecon] = useState<any>(null);
  const [flagNotes, setFlagNotes] = useState('');
  const [expandedRecon, setExpandedRecon] = useState<string | null>(null);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const approveRecon = useApproveReconciliation();

  // Fetch all reconciliations with shift + staff info
  const { data: reconciliations, isLoading } = useQuery({
    queryKey: ['reconciliations'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(*, users:user_id(full_name, email, role, id), departments:department_id(name)),
          users_submitted:submitted_by(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pendingRecons = reconciliations?.filter((r: any) => r.status === 'submitted') || [];
  const reviewedRecons = reconciliations?.filter((r: any) => r.status !== 'submitted') || [];

  // Fetch transactions for expanded reconciliation
  const expandedShift = expandedRecon ? reconciliations?.find((r: any) => r.id === expandedRecon) : null;
  const staffRole = expandedShift?.staff_shifts?.users?.role || '';
  const staffId = expandedShift?.staff_shifts?.users?.id || '';
  const shiftStart = expandedShift?.staff_shifts?.start_time;
  const shiftEnd = expandedShift?.staff_shifts?.end_time;

  // Fetch transactions based on role
  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['recon-transactions', expandedRecon, staffId, shiftStart, shiftEnd],
    queryFn: async () => {
      if (!expandedRecon || !staffId) return { folioPayments: [], restaurantOrders: [], recordedPayments: [] };

      const timeFilter = shiftStart
        ? { start: shiftStart, end: shiftEnd || new Date().toISOString() }
        : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString() };

      // Role-specific queries
      const queries: Promise<any>[] = [];

      // Receptionist: folio_payments recorded by this staff
      if (['receptionist', 'admin', 'manager'].includes(staffRole)) {
        queries.push(
          sb.from('folio_payments')
            .select('*, guest_folios!folio_id(reservation_id, guest_name)')
            .eq('recorded_by', staffId)
            .gte('created_at', timeFilter.start)
            .lte('created_at', timeFilter.end)
            .order('created_at', { ascending: false })
            .then((r: any) => ({ type: 'folio_payments', data: r.data || [] }))
        );
      }

      // Waiter: restaurant_orders where they were waiter + payments they recorded
      if (['waiter', 'chef'].includes(staffRole)) {
        queries.push(
          sb.from('restaurant_orders')
            .select('*, restaurant_order_items(*)')
            .eq('waiter_id', staffId)
            .gte('created_at', timeFilter.start)
            .lte('created_at', timeFilter.end)
            .order('created_at', { ascending: false })
            .then((r: any) => ({ type: 'restaurant_orders', data: r.data || [] }))
        );
        queries.push(
          sb.from('payments')
            .select('*')
            .eq('recorded_by', staffId)
            .gte('created_at', timeFilter.start)
            .lte('created_at', timeFilter.end)
            .order('created_at', { ascending: false })
            .then((r: any) => ({ type: 'recorded_payments', data: r.data || [] }))
        );
      }

      const results = await Promise.all(queries);
      const out: any = { folioPayments: [], restaurantOrders: [], recordedPayments: [] };
      results.forEach((r: any) => { out[r.type] = r.data; });
      return out;
    },
    enabled: !!expandedRecon && !!staffId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const handleApprove = async (reconId: string) => {
    try {
      await approveRecon.mutateAsync({
        reconciliationId: reconId,
        managerId: user?.id || '',
        status: 'approved',
      });
      toast.success('Reconciliation approved — shift closed');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleFlag = async () => {
    if (!selectedRecon || !flagNotes.trim()) {
      toast.error('Please provide a reason for flagging');
      return;
    }
    try {
      await approveRecon.mutateAsync({
        reconciliationId: selectedRecon.id,
        managerId: user?.id || '',
        status: 'flagged',
        notes: flagNotes,
      });
      setFlagDialog(false);
      setSelectedRecon(null);
      setFlagNotes('');
      toast.success('Reconciliation flagged — staff must review');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const renderReconCard = (recon: any, isPending: boolean) => {
    const shift = recon.staff_shifts;
    const staffName = shift?.users?.full_name || 'Staff';
    const role = shift?.users?.role || '';
    const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.receptionist;
    const RoleIcon = roleCfg.icon;
    const cfg = RECON_STATUS[recon.status] || { color: 'bg-gray-100', label: recon.status };
    const hasVariance = Math.abs(recon.variance) > 0;
    const isExpanded = expandedRecon === recon.id;
    const duration = shift?.start_time && shift?.end_time
      ? differenceInMinutes(new Date(shift.end_time), new Date(shift.start_time))
      : 0;

    return (
      <Card key={recon.id} className={cn('transition-all', isPending && hasVariance ? 'border-l-4 border-l-amber-500' : isPending ? 'border-l-4 border-l-emerald-500' : '')}>
        <CardContent className="p-0">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
            onClick={() => setExpandedRecon(isExpanded ? null : recon.id)}
          >
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', roleCfg.color)}>
                <RoleIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{staffName}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{role}</Badge>
                  {shift?.departments?.name && <span className="text-xs text-muted-foreground">· {shift.departments.name}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{shift?.shift_name} shift</span>
                  <span>·</span>
                  <span>{shift?.shift_date ? format(new Date(shift.shift_date), 'MMM d') : '—'}</span>
                  {duration > 0 && <><span>·</span><span>{duration}min</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <Badge className={cfg.color}>{cfg.label}</Badge>
                {isPending && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {recon.created_at ? format(new Date(recon.created_at), 'h:mm a') : ''}
                  </p>
                )}
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {/* Summary Row */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-muted rounded">
                <p className="text-[10px] text-muted-foreground">Sales</p>
                <p className="font-medium">{formatCurrency(recon.sales_total)}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-[10px] text-muted-foreground">Cash</p>
                <p className="font-medium">{formatCurrency(recon.cash_total)}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-[10px] text-muted-foreground">M-Pesa</p>
                <p className="font-medium">{formatCurrency(recon.mpesa_total)}</p>
              </div>
              <div className={cn('p-2 rounded', hasVariance ? 'bg-amber-50' : 'bg-emerald-50')}>
                <p className="text-[10px] text-muted-foreground">Variance</p>
                <p className={cn('font-medium', recon.variance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {recon.variance >= 0 ? '+' : ''}{formatCurrency(recon.variance)}
                </p>
              </div>
            </div>
          </div>

          {/* Expanded Detail */}
          {isExpanded && (
            <div className="border-t">
              {/* Staff Notes */}
              {recon.notes && (
                <div className="px-4 py-3 bg-muted/30 border-b">
                  <p className="text-xs text-muted-foreground mb-1">Staff Notes</p>
                  <p className="text-sm italic">"{recon.notes}"</p>
                </div>
              )}

              {/* Role-Specific Transaction List */}
              {roleCfg.hasTransactions ? (
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Transactions During Shift
                    {txLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
                  </p>

                  {/* Folio Payments (Receptionist) */}
                  {transactions?.folioPayments?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Room Payments</p>
                      {transactions.folioPayments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                          <div className="flex items-center gap-2">
                            {p.method === 'mpesa' ? (
                              <Smartphone className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-blue-600" />
                            )}
                            <div>
                              <p className="font-medium">{formatCurrency(p.amount)} — {p.method}</p>
                              {p.mpesa_transaction_id && (
                                <p className="text-[10px] text-muted-foreground">M-Pesa: {p.mpesa_transaction_id}</p>
                              )}
                              {p.reference && (
                                <p className="text-[10px] text-muted-foreground">Ref: {p.reference}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), 'h:mm a')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {p.receipt_image_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={(e) => { e.stopPropagation(); setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
                              >
                                <Camera className="h-3 w-3 text-blue-600" />
                              </Button>
                            )}
                            <Badge variant={p.verified ? 'default' : 'outline'} className="text-[10px]">
                              {p.verified ? '✓ Verified' : p.status || 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Restaurant Orders (Waiter/Chef) */}
                  {transactions?.restaurantOrders?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Food Orders</p>
                      {transactions.restaurantOrders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                            <div>
                              <p className="font-medium">#{o.order_number} — {o.guest_name || 'Walk-in'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {o.status} · {o.restaurant_order_items?.length || 0} items
                                {o.delivery_type === 'delivery' && ' · 🚴 Delivery'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{format(new Date(o.created_at), 'h:mm a')}</p>
                            </div>
                          </div>
                          <p className="font-medium">{formatCurrency(o.total)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recorded Payments (Waiter) */}
                  {transactions?.recordedPayments?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payment Records</p>
                      {transactions.recordedPayments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border text-sm">
                          <div className="flex items-center gap-2">
                            {p.method === 'mpesa' ? (
                              <Smartphone className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-blue-600" />
                            )}
                            <div>
                              <p className="font-medium">{formatCurrency(p.amount)} — {p.method}</p>
                              {p.mpesa_transaction_id && (
                                <p className="text-[10px] text-muted-foreground">M-Pesa: {p.mpesa_transaction_id}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), 'h:mm a')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {p.receipt_image_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={(e) => { e.stopPropagation(); setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
                              >
                                <Camera className="h-3 w-3 text-blue-600" />
                              </Button>
                            )}
                            <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No transactions */}
                  {transactions?.folioPayments?.length === 0 &&
                   transactions?.restaurantOrders?.length === 0 &&
                   transactions?.recordedPayments?.length === 0 && !txLoading && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No transactions recorded during this shift
                    </p>
                  )}
                </div>
              ) : (
                /* Housekeeper/Manager/Admin — no transactions */
                <div className="px-4 py-6 text-center">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {role === 'housekeeper' ? 'Housekeeping shift — no financial transactions' : 'No transactions to review for this role'}
                  </p>
                </div>
              )}

              {/* Manager Notes */}
              {recon.manager_notes && (
                <div className="px-4 py-3 bg-red-50 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Manager Notes</p>
                  <p className="text-sm text-red-700 italic">"{recon.manager_notes}"</p>
                </div>
              )}

              {/* Action Buttons (only for pending) */}
              {isPending && (
                <div className="px-4 py-3 border-t flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleApprove(recon.id)}
                    disabled={approveRecon.isPending}
                  >
                    {approveRecon.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Approve & Close Shift
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setSelectedRecon(recon); setFlagDialog(true); }}
                  >
                    <Ban className="mr-2 h-4 w-4" /> Flag
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Reconciliation</h1>
        <p className="text-muted-foreground">Review transactions and approve shift closings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className={pendingRecons.length > 0 ? 'bg-amber-50 border-amber-200' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Awaiting Review</span>
            </div>
            <p className={cn('text-2xl font-bold mt-1', pendingRecons.length > 0 ? 'text-amber-600' : '')}>{pendingRecons.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{reviewedRecons.filter(r => r.status === 'approved').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Flagged</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{reviewedRecons.filter(r => r.status === 'flagged').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingRecons.length})</TabsTrigger>
          <TabsTrigger value="history">History ({reviewedRecons.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingRecons.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300 mb-3" />
                <p className="text-muted-foreground">All caught up — no pending reconciliations</p>
              </CardContent>
            </Card>
          ) : (
            pendingRecons.map((recon: any) => renderReconCard(recon, true))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {reviewedRecons.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reviewed reconciliations</p>
          ) : (
            reviewedRecons.map((recon: any) => renderReconCard(recon, false))
          )}
        </TabsContent>
      </Tabs>

      {/* Flag Dialog */}
      <Dialog open={flagDialog} onOpenChange={setFlagDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Flag Reconciliation
            </DialogTitle>
          </DialogHeader>
          {selectedRecon && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm">
                <p><strong>{selectedRecon.staff_shifts?.users?.full_name}</strong> — {selectedRecon.staff_shifts?.shift_name} shift</p>
                <p className="text-muted-foreground mt-1">Variance: {formatCurrency(selectedRecon.variance)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for flagging *</label>
                <Textarea
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Explain the discrepancy — e.g. missing receipts, M-Pesa code mismatch, cash shortage..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setFlagDialog(false); setSelectedRecon(null); setFlagNotes(''); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleFlag} disabled={approveRecon.isPending || !flagNotes.trim()}>
                  {approveRecon.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                  Flag
                </Button>
              </div>
            </div>
          )}
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
