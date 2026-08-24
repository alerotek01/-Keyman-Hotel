import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useApproveReconciliation, useResolveVariance, useAdminConfirmVariance } from '@/hooks/usePayments';
import { useEmailService } from '@/hooks/useEmailService';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock,
  Receipt, Smartphone, Camera, Eye, Ban, ChefHat, UtensilsCrossed,
  BedDouble, Sparkles, LogIn, LogOut, ChevronDown, ChevronRight,
  FileText, ShieldCheck, MessageSquare, Upload, Check
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

const VARIANCE_STATUS: Record<string, { color: string; label: string; icon: any }> = {
  none: { color: 'bg-gray-100 text-gray-500', label: 'No Variance', icon: CheckCircle2 },
  open: { color: 'bg-red-100 text-red-700', label: 'Variance Open', icon: AlertTriangle },
  staff_explained: { color: 'bg-blue-100 text-blue-700', label: 'Staff Explained', icon: MessageSquare },
  admin_reviewing: { color: 'bg-amber-100 text-amber-700', label: 'Admin Reviewing', icon: ShieldCheck },
  resolved: { color: 'bg-emerald-100 text-emerald-700', label: 'Resolved', icon: Check },
  disputed: { color: 'bg-red-100 text-red-700', label: 'Disputed', icon: Ban },
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
  const [mpesaDialog, setMpesaDialog] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmProofType, setConfirmProofType] = useState<'mpesa_message' | 'receipt'>('mpesa_message');
  const [confirmFile, setConfirmFile] = useState<File | null>(null);

  const approveRecon = useApproveReconciliation();
  const resolveVariance = useResolveVariance();
  const adminConfirmVariance = useAdminConfirmVariance();
  const { reconciliationAuditReport, sending: emailSending } = useEmailService();
  const [sendingReport, setSendingReport] = useState(false);

  // Fetch all reconciliations with shift + staff info
  const { data: reconciliations, isLoading } = useQuery({
    queryKey: ['reconciliations'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select(`
          *,
          staff_shifts!shift_id(*, users:user_id(full_name, email, role, id), departments:department_id(name)),
          users_submitted:submitted_by(full_name),
          users_manager:manager_id(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch variance resolution names separately (no FK join needed)
      const resolvedIds = (data || []).filter((r: any) => r.variance_resolved_by).map((r: any) => r.variance_resolved_by);
      const adminIds = (data || []).filter((r: any) => r.variance_admin_confirmed_by).map((r: any) => r.variance_admin_confirmed_by);
      const allUserIds = [...new Set([...resolvedIds, ...adminIds])];

      let userMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: users } = await sb.from('users').select('id, full_name').in('id', allUserIds);
        (users || []).forEach((u: any) => { userMap[u.id] = u.full_name; });
      }

      return (data || []).map((r: any) => ({
        ...r,
        users_variance_resolved: r.variance_resolved_by ? { full_name: userMap[r.variance_resolved_by] || 'Unknown' } : null,
        users_variance_admin: r.variance_admin_confirmed_by ? { full_name: userMap[r.variance_admin_confirmed_by] || 'Unknown' } : null,
      }));
    },
  });

  const pendingRecons = reconciliations?.filter((r: any) => r.status === 'submitted') || [];
  const explainedRecons = reconciliations?.filter((r: any) => r.status === 'explained') || [];
  const flaggedRecons = reconciliations?.filter((r: any) => r.status === 'flagged') || [];
  const historyRecons = reconciliations?.filter((r: any) => 
    !['submitted', 'explained', 'flagged'].includes(r.status)
  ) || [];

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

      // Filter by shift date (same day) — simpler than time range
      const shiftDate = expandedShift?.staff_shifts?.shift_date || new Date().toISOString().split('T')[0];
      const nextDay = new Date(new Date(shiftDate).getTime() + 86400000).toISOString().split('T')[0];

      const queries: Promise<any>[] = [];

      // Receptionist: folio_payments recorded by this staff
      if (['receptionist', 'admin', 'manager'].includes(staffRole)) {
        queries.push(
          sb.from('folio_payments')
            .select('*, guest_folios!folio_id(reservation_id, guest_name)')
            .eq('recorded_by', staffId)
            .gte('created_at', shiftDate)
            .lt('created_at', nextDay)
            .order('created_at', { ascending: false })
            .then((r: any) => ({ type: 'folio_payments', data: r.data || [] }))
        );
      }

      // Waiter/Chef: orders + payments recorded by this staff
      if (['waiter', 'chef'].includes(staffRole)) {
        queries.push(
          sb.from('restaurant_orders')
            .select('*, restaurant_order_items(*)')
            .eq('waiter_id', staffId)
            .gte('created_at', shiftDate)
            .lt('created_at', nextDay)
            .order('created_at', { ascending: false })
            .then((r: any) => ({ type: 'restaurant_orders', data: r.data || [] }))
        );
        queries.push(
          sb.from('payments')
            .select('*')
            .eq('recorded_by', staffId)
            .gte('created_at', shiftDate)
            .lt('created_at', nextDay)
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
      toast.success('Reconciliation approved — shift reconciled');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleClose = async (reconId: string) => {
    try {
      await approveRecon.mutateAsync({
        reconciliationId: reconId,
        managerId: user?.id || '',
        status: 'reconciled',
      });
      toast.success('Shift fully closed and reconciled');
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
      toast.success('Reconciliation flagged — staff must review and explain');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleAdminConfirm = async () => {
    if (!selectedRecon) return;
    try {
      await adminConfirmVariance.mutateAsync({
        reconciliationId: selectedRecon.id,
        adminId: user?.id || '',
        adminNotes: confirmNotes,
        proofFile: confirmFile,
        proofType: confirmProofType,
      });
      setConfirmDialog(false);
      setSelectedRecon(null);
      setConfirmNotes('');
      setConfirmFile(null);
      toast.success('Variance confirmed by admin — reconciliation resolved');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const renderPaymentRow = (p: any) => {
    const hasProof = !!p.receipt_image_url;
    const hasMpesaCode = !!p.mpesa_transaction_id;
    const isCashWithoutProof = p.method === 'cash' && !hasProof;
    const isMpesaWithoutCode = p.method === 'mpesa' && !hasMpesaCode;
    const needsAttention = isCashWithoutProof || isMpesaWithoutCode;

    return (
      <div key={p.id} className={cn(
        'flex gap-3 p-3 rounded-lg border text-sm',
        needsAttention ? 'bg-amber-50 border-amber-200' : 'bg-white'
      )}>
        {/* Payment Icon */}
        <div className="shrink-0">
          {p.method === 'mpesa' ? (
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-emerald-600" />
            </div>
          ) : p.method === 'cash' ? (
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-purple-600" />
            </div>
          )}
        </div>

        {/* Payment Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{formatCurrency(p.amount)}</p>
              <Badge variant="outline" className="text-[10px] capitalize">{p.method}</Badge>
              {needsAttention && (
                <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Missing Proof
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(p.created_at), 'h:mm a')}
            </p>
          </div>

          {/* M-Pesa Transaction Code */}
          {hasMpesaCode && (
            <button
              className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono hover:underline mt-1 bg-emerald-50 px-2 py-1 rounded"
              onClick={(e) => { e.stopPropagation(); setMpesaCode(p.mpesa_transaction_id); setMpesaDialog(true); }}
            >
              <Smartphone className="h-3 w-3" />
              M-Pesa Code: {p.mpesa_transaction_id}
            </button>
          )}

          {/* Proof Image Thumbnail */}
          {hasProof && (
            <div className="mt-2 flex items-center gap-2">
              <button
                className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border hover:border-brass transition-colors"
                onClick={(e) => { e.stopPropagation(); setReceiptUrl(p.receipt_image_url); setReceiptDialog(true); }}
              >
                <img src={p.receipt_image_url} alt="Proof" className="w-full h-full object-cover" />
              </button>
              <div className="text-[10px] text-muted-foreground">
                <p className="font-medium text-foreground">
                  {p.method === 'mpesa' ? '📱 M-Pesa Screenshot' : '📷 Receipt'}
                </p>
                <p>Click to view full size</p>
                <p className="text-emerald-600 font-medium">✓ Proof attached</p>
              </div>
            </div>
          )}

          {/* Missing Proof Warning */}
          {needsAttention && (
            <div className="mt-1.5 text-[10px] text-amber-600">
              {isCashWithoutProof && '⚠️ Cash payment requires receipt as proof for reconciliation'}
              {isMpesaWithoutCode && '⚠️ M-Pesa payment requires transaction code'}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Badge variant={p.verified ? 'default' : 'outline'} className="text-[10px]">
            {p.verified ? '✓ Verified' : p.status || 'Pending'}
          </Badge>
        </div>
      </div>
    );
  };

  const renderOrderRow = (o: any) => (
    <div key={o.id} className="p-3 bg-white rounded-lg border text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
            <UtensilsCrossed className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <p className="font-medium">#{o.order_number} — {o.guest_name || 'Walk-in'}</p>
            <p className="text-[10px] text-muted-foreground">
              {o.status} · {o.restaurant_order_items?.length || 0} items
              {o.delivery_type === 'delivery' && ' · 🚴 Delivery'}
              {o.delivery_type === 'room_service' && ' · 🛎️ Room Service'}
            </p>
          </div>
        </div>
        <p className="font-semibold">{formatCurrency(o.total)}</p>
      </div>
      {o.restaurant_order_items?.length > 0 && (
        <div className="mt-2 pl-10 text-[11px] text-muted-foreground space-y-0.5 bg-muted/30 rounded p-2">
          {o.restaurant_order_items.map((item: any, i: number) => (
            <p key={i}>{item.quantity}× {item.menu_item_id?.substring(0, 8)}… — {formatCurrency(item.subtotal || item.total)}</p>
          ))}
        </div>
      )}
    </div>
  );

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

    const vStatus = recon.variance_status || 'none';
    const vCfg = VARIANCE_STATUS[vStatus] || VARIANCE_STATUS.none;
    const VIcon = vCfg.icon;

    return (
      <Card key={recon.id} className={cn(
        'transition-all',
        isPending && hasVariance ? 'border-l-4 border-l-amber-500' : 
        recon.status === 'flagged' ? 'border-l-4 border-l-red-500' :
        recon.status === 'explained' ? 'border-l-4 border-l-blue-500' :
        isPending ? 'border-l-4 border-l-emerald-500' : ''
      )}>
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
                {hasVariance && (
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <Badge className={vCfg.color} variant="outline">
                      <VIcon className="h-3 w-3 mr-1" />
                      {vCfg.label}
                    </Badge>
                  </div>
                )}
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {/* Summary Row */}
          <div className="px-4 pb-3">
            <div className={cn("grid gap-3 text-sm", hasVariance ? "grid-cols-5" : "grid-cols-4")}>
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
              {hasVariance && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-[10px] text-muted-foreground">Actual vs Expected</p>
                  <p className="font-medium text-xs">
                    {formatCurrency(recon.actual_cash)} / {formatCurrency(recon.expected_cash)}
                  </p>
                </div>
              )}
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

                  {/* Folio Payments (Receptionist) — each with proof */}
                  {transactions?.folioPayments?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
                        <BedDouble className="h-3.5 w-3.5 text-emerald-600" /> Room Payments ({transactions.folioPayments.length})
                      </p>
                      {transactions.folioPayments.map((p: any) => renderPaymentRow(p))}
                    </div>
                  )}

                  {/* Restaurant Orders (Waiter/Chef) */}
                  {transactions?.restaurantOrders?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-orange-600" /> Food Orders ({transactions.restaurantOrders.length})
                      </p>
                      {transactions.restaurantOrders.map((o: any) => renderOrderRow(o))}
                    </div>
                  )}

                  {/* Recorded Payments (Waiter) — each with proof */}
                  {transactions?.recordedPayments?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
                        <DollarSign className="h-3.5 w-3.5 text-blue-600" /> Payment Records ({transactions.recordedPayments.length})
                      </p>
                      {transactions.recordedPayments.map((p: any) => renderPaymentRow(p))}
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

              {/* VARIANCE RESOLUTION SECTION */}
              {hasVariance && (
                <div className="border-t">
                  {/* Variance Status Banner */}
                  <div className={cn('px-4 py-3 border-b', 
                    vStatus === 'open' ? 'bg-red-50' :
                    vStatus === 'staff_explained' ? 'bg-blue-50' :
                    vStatus === 'admin_reviewing' ? 'bg-amber-50' :
                    vStatus === 'resolved' ? 'bg-emerald-50' :
                    'bg-gray-50'
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <VIcon className="h-4 w-4" />
                        <span className="text-sm font-semibold">{vCfg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          — Variance: {recon.variance >= 0 ? '+' : ''}{formatCurrency(recon.variance)}
                          {recon.variance < 0 ? ' (short)' : ' (over)'}
                        </span>
                      </div>
                    </div>

                    {/* Staff's explanation + proof */}
                    {recon.variance_explanation && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-blue-700">Staff Explanation:</p>
                            <p className="text-sm mt-1">{recon.variance_explanation}</p>
                          </div>
                        </div>
                        {recon.variance_proof_type && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {recon.variance_proof_type === 'mpesa_message' && '📱 M-Pesa Message'}
                              {recon.variance_proof_type === 'receipt' && '📷 Receipt'}
                              {recon.variance_proof_type === 'both' && '📱📷 M-Pesa + Receipt'}
                            </Badge>
                            {recon.variance_proof_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => { setReceiptUrl(recon.variance_proof_url); setReceiptDialog(true); }}
                              >
                                <Camera className="h-3 w-3 mr-1" /> View Proof
                              </Button>
                            )}
                          </div>
                        )}
                        {recon.users_variance_resolved?.full_name && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Submitted by {recon.users_variance_resolved.full_name}
                            {recon.variance_resolved_at && ` · ${format(new Date(recon.variance_resolved_at), 'MMM d, h:mm a')}`}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Admin's confirmation */}
                    {recon.variance_admin_confirmed && (
                      <div className="mt-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-emerald-700">Admin Confirmed:</p>
                            {recon.manager_notes && (
                              <p className="text-sm mt-1">{recon.manager_notes}</p>
                            )}
                          </div>
                        </div>
                        {recon.variance_admin_proof_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] mt-1"
                            onClick={() => { setReceiptUrl(recon.variance_admin_proof_url); setReceiptDialog(true); }}
                          >
                            <Camera className="h-3 w-3 mr-1" /> Admin Proof
                          </Button>
                        )}
                        {recon.users_variance_admin?.full_name && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Confirmed by {recon.users_variance_admin.full_name}
                            {recon.variance_admin_confirmed_at && ` · ${format(new Date(recon.variance_admin_confirmed_at), 'MMM d, h:mm a')}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manager Notes */}
              {recon.manager_notes && !hasVariance && (
                <div className="px-4 py-3 bg-red-50 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Manager Notes</p>
                  <p className="text-sm text-red-700 italic">"{recon.manager_notes}"</p>
                </div>
              )}

              {/* Action Buttons */}
              {isPending && (
                <div className="px-4 py-3 border-t flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleApprove(recon.id)}
                    disabled={approveRecon.isPending}
                  >
                    {approveRecon.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Approve
                  </Button>
                  <Button
                    variant="default"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleClose(recon.id)}
                    disabled={approveRecon.isPending}
                  >
                    {approveRecon.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    Close Shift
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setSelectedRecon(recon); setFlagDialog(true); }}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Explained — Manager/Admin can review and confirm variance */}
              {recon.status === 'explained' && (
                <div className="px-4 py-3 border-t flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setSelectedRecon(recon); setConfirmDialog(true); }}
                    disabled={adminConfirmVariance.isPending}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Confirm Variance Resolved
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setSelectedRecon(recon); setFlagDialog(true); }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Re-Flag
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
        <p className="text-muted-foreground">Review transactions, verify M-Pesa codes & receipts, approve shift closings</p>
      </div>

      {/* Send Audit Report Button */}
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          className="text-brass border-brass hover:bg-brass/10"
          onClick={async () => {
            setSendingReport(true);
            try {
              const { data: admins } = await sb.from('users').select('email').in('role', ['admin', 'manager']).eq('is_active', true);
              const emails = (admins || []).map((a: any) => a.email).filter(Boolean);
              if (emails.length === 0) { toast.error('No admin/manager emails found'); return; }
              const result = await reconciliationAuditReport(emails);
              if (result.success) {
                toast.success(`Audit report sent to ${emails.length} recipient(s)`);
              } else {
                toast.error(result.error || 'Failed to send report');
              }
            } catch (e: any) {
              toast.error(e.message || 'Failed');
            } finally {
              setSendingReport(false);
            }
          }}
          disabled={sendingReport || emailSending}
        >
          {(sendingReport || emailSending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Send Midnight Audit Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className={pendingRecons.length > 0 ? 'bg-amber-50 border-amber-200' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Awaiting Review</span>
            </div>
            <p className={cn('text-2xl font-bold mt-1', pendingRecons.length > 0 ? 'text-amber-600' : '')}>{pendingRecons.length}</p>
          </CardContent>
        </Card>
        <Card className={explainedRecons.length > 0 ? 'bg-blue-50 border-blue-200' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Explained</span>
            </div>
            <p className={cn('text-2xl font-bold mt-1', explainedRecons.length > 0 ? 'text-blue-600' : '')}>{explainedRecons.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{historyRecons.filter((r: any) => r.status === 'approved' || r.status === 'reconciled').length}</p>
          </CardContent>
        </Card>
        <Card className={flaggedRecons.length > 0 ? 'bg-red-50 border-red-200' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Flagged</span>
            </div>
            <p className={cn('text-2xl font-bold mt-1', flaggedRecons.length > 0 ? 'text-red-600' : '')}>{flaggedRecons.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingRecons.length})</TabsTrigger>
          <TabsTrigger value="explained">Explained ({explainedRecons.length})</TabsTrigger>
          <TabsTrigger value="flagged">Flagged ({flaggedRecons.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historyRecons.length})</TabsTrigger>
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

        <TabsContent value="explained" className="mt-4 space-y-3">
          {explainedRecons.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-blue-200 mb-3" />
                <p className="text-muted-foreground">No explained variances awaiting admin review</p>
              </CardContent>
            </Card>
          ) : (
            explainedRecons.map((recon: any) => renderReconCard(recon, false))
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-4 space-y-3">
          {flaggedRecons.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300 mb-3" />
                <p className="text-muted-foreground">No flagged reconciliations</p>
              </CardContent>
            </Card>
          ) : (
            flaggedRecons.map((recon: any) => renderReconCard(recon, false))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {historyRecons.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reviewed reconciliations</p>
          ) : (
            historyRecons.map((recon: any) => renderReconCard(recon, false))
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
            <p className="text-xs text-muted-foreground mt-4">
              Verify this code matches the M-Pesa confirmation message from the customer's phone
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Confirm Variance Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" /> Confirm Variance Resolution
            </DialogTitle>
          </DialogHeader>
          {selectedRecon && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                <p><strong>{selectedRecon.staff_shifts?.users?.full_name}</strong> — {selectedRecon.staff_shifts?.shift_name} shift</p>
                <p className="text-muted-foreground mt-1">Variance: {formatCurrency(selectedRecon.variance)}</p>
                {selectedRecon.variance_explanation && (
                  <p className="mt-2 text-xs italic">"{selectedRecon.variance_explanation}"</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmation Method</label>
                <div className="flex gap-2">
                  <Button
                    variant={confirmProofType === 'mpesa_message' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setConfirmProofType('mpesa_message')}
                  >
                    <Smartphone className="mr-1 h-3 w-3" /> M-Pesa Message
                  </Button>
                  <Button
                    variant={confirmProofType === 'receipt' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setConfirmProofType('receipt')}
                  >
                    <Receipt className="mr-1 h-3 w-3" /> Receipt
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Confirm the variance explanation — e.g. verified M-Pesa confirmation, receipt matches..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Upload Confirmation Proof</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setConfirmFile(e.target.files?.[0] || null)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Upload M-Pesa screenshot or receipt as admin verification
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setConfirmDialog(false); setSelectedRecon(null); setConfirmNotes(''); setConfirmFile(null); }}>Cancel</Button>
                <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleAdminConfirm} disabled={adminConfirmVariance.isPending}>
                  {adminConfirmVariance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Confirm Resolved
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
              <Camera className="h-5 w-5" /> Proof / Receipt
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
