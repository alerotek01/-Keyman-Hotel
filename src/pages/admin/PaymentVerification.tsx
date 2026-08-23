import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Search, Clock, CreditCard, Phone, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function PaymentVerification() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Fetch booking payments with reservation info
  const { data: payments, isLoading } = useQuery({
    queryKey: ['booking-payments', statusFilter],
    queryFn: async () => {
      const { data, error } = await sb
        .from('booking_payments')
        .select(`
          *,
          reservations!inner(
            id, guest_name, room_number, check_in, check_out,
            rooms(room_number, room_types(name, base_rate))
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Confirm payment mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, amount }: { paymentId: string; amount: number }) => {
      const { error } = await sb
        .from('booking_payments')
        .update({
          status: 'confirmed',
          confirmed_amount: amount,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      if (error) throw error;

      // Also update reservation deposit status if it's a deposit
      const payment = payments?.find((p: any) => p.id === paymentId);
      if (payment?.payment_type === 'deposit') {
        await sb
          .from('reservations')
          .update({ deposit_paid: true })
          .eq('id', payment.reservation_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-payments'] });
      toast.success('Payment confirmed');
      setConfirmDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Reject payment mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await sb
        .from('booking_payments')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-payments'] });
      toast.success('Payment rejected');
      setRejectDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Filter payments
  const filtered = (payments || []).filter((p: any) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch = !searchQuery ||
      p.reservations?.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reservations?.room_number?.includes(searchQuery) ||
      p.mpesa_receipt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mpesa_phone?.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = payments?.filter((p: any) => p.status === 'pending').length || 0;
  const totalConfirmed = payments?.filter((p: any) => p.status === 'confirmed').reduce((s: number, p: any) => s + Number(p.confirmed_amount || p.amount), 0) || 0;
  const totalPending = payments?.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-brass" />
          Payment Verification
        </h1>
        <p className="text-muted-foreground mt-1">Manually confirm M-Pesa payments for guest bookings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={pendingCount > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(totalConfirmed)}</p>
            <p className="text-xs text-muted-foreground">Confirmed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-muted-foreground">Awaiting</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by guest, room, or receipt..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {['pending', 'confirmed', 'rejected', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Payments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brass" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No payments found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((payment: any) => {
            const res = payment.reservations;
            const roomName = res?.rooms?.room_types?.name || 'Room';

            return (
              <Card key={payment.id} className={`transition-all ${
                payment.status === 'pending' ? 'border-l-4 border-l-amber-400' :
                payment.status === 'confirmed' ? 'border-l-4 border-l-emerald-400' :
                'border-l-4 border-l-red-400'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        payment.status === 'pending' ? 'bg-amber-100' :
                        payment.status === 'confirmed' ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        {payment.status === 'pending' ? <Clock className="h-5 w-5 text-amber-600" /> :
                         payment.status === 'confirmed' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                         <XCircle className="h-5 w-5 text-red-600" />}
                      </div>

                      {/* Payment Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{res?.guest_name || 'Unknown Guest'}</p>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {payment.payment_type || 'full'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>Room {res?.room_number} ({roomName})</span>
                          <span>{format(new Date(res?.check_in), 'MMM d')} – {format(new Date(res?.check_out), 'MMM d')}</span>
                          {payment.mpesa_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{payment.mpesa_phone}</span>}
                        </div>
                        {payment.mpesa_receipt && (
                          <p className="text-xs text-muted-foreground mt-1">Receipt: <span className="font-mono">{payment.mpesa_receipt}</span></p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Amount & Time */}
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(payment.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Actions */}
                      {payment.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setRejectDialog(payment); setRejectReason(''); }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { setConfirmDialog(payment); setConfirmAmount(String(payment.amount)); }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
                          </Button>
                        </div>
                      ) : (
                        <Badge className={
                          payment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }>
                          {payment.status === 'confirmed' ? `✅ Confirmed (${formatCurrency(payment.confirmed_amount || payment.amount)})` : '❌ Rejected'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Confirm Payment
            </DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{confirmDialog.reservations?.guest_name}</p>
                <p className="text-xs text-muted-foreground">Room {confirmDialog.reservations?.room_number} · {confirmDialog.payment_type || 'full'}</p>
              </div>

              <div className="space-y-2">
                <Label>Confirm Amount (KES)</Label>
                <Input
                  type="number"
                  value={confirmAmount}
                  onChange={e => setConfirmAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Original: {formatCurrency(confirmDialog.amount)}</p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
                <Button
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => confirmMutation.mutate({ paymentId: confirmDialog.id, amount: parseFloat(confirmAmount) })}
                  disabled={confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Confirm Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Payment
            </DialogTitle>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium">{rejectDialog.reservations?.guest_name} — Room {rejectDialog.reservations?.room_number}</p>
                <p className="text-xs text-red-600">Amount: {formatCurrency(rejectDialog.amount)}</p>
              </div>

              <div className="space-y-2">
                <Label>Reason for Rejection</Label>
                <Input
                  placeholder="e.g., Receipt not found, wrong amount..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                <Button
                  variant="default"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => rejectMutation.mutate({ paymentId: rejectDialog.id, reason: rejectReason })}
                  disabled={rejectMutation.isPending || !rejectReason}
                >
                  {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Reject Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
