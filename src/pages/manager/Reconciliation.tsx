import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useReconciliations, useApproveReconciliation } from '@/hooks/usePayments';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Reconciliation() {
  const { user } = useAuth();
  const { data: reconciliations, isLoading } = useReconciliations();
  const approveRecon = useApproveReconciliation();

  const [selectedRecon, setSelectedRecon] = useState<any>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const pendingRecons = reconciliations?.filter(r => r.status === 'submitted') || [];
  const allRecons = reconciliations || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const handleApprove = async (reconId: string) => {
    try {
      await approveRecon.mutateAsync({ reconciliationId: reconId, managerId: user?.id || '', status: 'approved' });
      toast.success('Reconciliation approved!');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleReject = async (reconId: string) => {
    try {
      await approveRecon.mutateAsync({ reconciliationId: reconId, managerId: user?.id || '', status: 'flagged' });
      setSelectedRecon(null);
      setRejectionNotes('');
      toast.error('Reconciliation flagged for review');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    submitted: { color: 'bg-amber-100 text-amber-800', label: 'Pending Review' },
    approved: { color: 'bg-emerald-100 text-emerald-800', label: 'Approved' },
    flagged: { color: 'bg-red-100 text-red-800', label: 'Flagged' },
    reconciled: { color: 'bg-blue-100 text-blue-800', label: 'Reconciled' },
    closed: { color: 'bg-gray-100 text-gray-800', label: 'Closed' },
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Reconciliation</h1>
        <p className="text-muted-foreground">Review and approve staff shift reconciliations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingRecons.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Approved Today</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {allRecons.filter(r => r.status === 'approved').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Flagged</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {allRecons.filter(r => r.status === 'flagged').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reconciliations */}
      {pendingRecons.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl font-bold mb-4">Needs Approval</h2>
          <div className="space-y-4">
            {pendingRecons.map(recon => {
              const shift = recon.staff_shifts;
              const staffName = shift?.users?.full_name || 'Staff';
              const hasVariance = Math.abs(recon.variance) > 0;

              return (
                <Card key={recon.id} className={cn("border-l-4", hasVariance ? "border-l-amber-500" : "border-l-emerald-500")}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{staffName}</h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          {shift?.shift_name} shift • {shift?.shift_date ? format(new Date(shift.shift_date), 'MMM d') : '—'}
                        </p>
                      </div>
                      <Badge className={statusConfig[recon.status]?.color || 'bg-gray-100'}>
                        {statusConfig[recon.status]?.label || recon.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Sales Total</p>
                        <p className="font-semibold">{formatCurrency(recon.sales_total)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Cash Collected</p>
                        <p className="font-semibold">{formatCurrency(recon.cash_total)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">M-Pesa</p>
                        <p className="font-semibold">{formatCurrency(recon.mpesa_total)}</p>
                      </div>
                      <div className={cn("p-3 rounded-lg", hasVariance ? "bg-amber-50" : "bg-emerald-50")}>
                        <p className="text-xs text-muted-foreground">Variance</p>
                        <p className={cn("font-semibold", recon.variance >= 0 ? "text-emerald-600" : "text-amber-600")}>
                          {recon.variance >= 0 ? '+' : ''}{formatCurrency(recon.variance)}
                        </p>
                      </div>
                    </div>

                    {recon.notes && (
                      <div className="p-3 bg-muted/50 rounded-lg mb-4 text-sm">
                        <span className="text-muted-foreground">Notes:</span> {recon.notes}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(recon.id)}
                        disabled={approveRecon.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setSelectedRecon(recon)}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Flag
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All Reconciliations */}
      <div>
        <h2 className="font-display text-xl font-bold mb-4">History</h2>
        <div className="space-y-3">
          {allRecons.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No reconciliations yet</p>
            </div>
          ) : (
            allRecons.map(recon => {
              const shift = recon.staff_shifts;
              const staffName = shift?.users?.full_name || 'Staff';
              const cfg = statusConfig[recon.status] || { color: 'bg-gray-100 text-gray-800', label: recon.status };

              return (
                <div key={recon.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                  <div>
                    <p className="font-medium">{staffName} — {shift?.shift_name} shift</p>
                    <p className="text-xs text-muted-foreground">
                      {shift?.shift_date} • Sales: {formatCurrency(recon.sales_total)} • Variance: {formatCurrency(recon.variance)}
                    </p>
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Flag Dialog */}
      {selectedRecon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Flag Reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Flagging this reconciliation will require the staff member to review and resubmit.
              </p>
              <Textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Reason for flagging (required)"
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedRecon(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleReject(selectedRecon.id)} disabled={approveRecon.isPending}>
                  Flag Reconciliation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
