import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayments, useRecordPayment, useVerifyPayment } from '@/hooks/usePayments';
import { useRestaurantOrders } from '@/hooks/useRestaurantOrders';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CreditCard, Smartphone, DollarSign, CheckCircle2, XCircle, Clock, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PaymentRecording() {
  const { user } = useAuth();
  const { data: payments, isLoading } = usePayments();
  const { data: orders } = useRestaurantOrders(['delivered', 'payment_submitted']);
  const recordPayment = useRecordPayment();
  const verifyPayment = useVerifyPayment();

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    method: 'cash' as string,
    amount: '',
    mpesa_transaction_id: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  const filteredPayments = payments?.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  }) || [];

  const pendingPayments = payments?.filter(p => p.status === 'pending') || [];
  const deliveredOrders = orders?.filter(o => o.status === 'delivered') || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  const handleRecordPayment = async () => {
    if (!selectedOrder || !paymentForm.amount) {
      toast.error('Select an order and enter amount');
      return;
    }

    if (paymentForm.method === 'cash' && !receiptFile) {
      toast.error('Receipt photo is required for cash payments');
      return;
    }

    try {
      await recordPayment.mutateAsync({
        order_id: selectedOrder.id,
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        mpesa_transaction_id: paymentForm.method === 'mpesa' ? paymentForm.mpesa_transaction_id : undefined,
        recorded_by: user?.id || '',
      });
      setRecordDialogOpen(false);
      setSelectedOrder(null);
      setPaymentForm({ method: 'cash', amount: '', mpesa_transaction_id: '', notes: '' });
      setReceiptFile(null);
      toast.success('Payment recorded');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleVerify = async (paymentId: string, status: string) => {
    try {
      await verifyPayment.mutateAsync({ paymentId, status, verifiedBy: user?.id || '' });
      toast.success(status === 'verified' ? 'Payment verified' : 'Payment rejected');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const statusConfig: Record<string, { color: string; icon: any }> = {
    pending: { color: 'bg-amber-100 text-amber-800', icon: Clock },
    verified: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
    rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Record and verify M-Pesa & cash payments</p>
        </div>
        <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brass">
              <CreditCard className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Order</Label>
                <Select value={selectedOrder?.id || ''} onValueChange={(v) => {
                  const order = deliveredOrders.find(o => o.id === v);
                  setSelectedOrder(order);
                  if (order) setPaymentForm(prev => ({ ...prev, amount: order.total.toString() }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose delivered order" /></SelectTrigger>
                  <SelectContent>
                    {deliveredOrders.map(order => (
                      <SelectItem key={order.id} value={order.id}>
                        #{order.order_number} — {order.guest_name || 'Walk-in'} — {formatCurrency(order.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {deliveredOrders.length === 0 && (
                  <p className="text-xs text-muted-foreground">No delivered orders awaiting payment</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'cash' })}
                    className={cn("p-3 rounded-lg border flex items-center gap-2 transition-all", paymentForm.method === 'cash' ? "border-brass bg-brass/5" : "")}
                  >
                    <DollarSign className="h-4 w-4" /> Cash
                  </button>
                  <button
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'mpesa' })}
                    className={cn("p-3 rounded-lg border flex items-center gap-2 transition-all", paymentForm.method === 'mpesa' ? "border-brass bg-brass/5" : "")}
                  >
                    <Smartphone className="h-4 w-4" /> M-Pesa
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>

              {paymentForm.method === 'mpesa' && (
                <div className="space-y-2">
                  <Label>M-Pesa Transaction ID</Label>
                  <Input
                    value={paymentForm.mpesa_transaction_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, mpesa_transaction_id: e.target.value })}
                    placeholder="e.g. QHK7B4C9DE"
                  />
                  <p className="text-xs text-muted-foreground">Required for M-Pesa payments — prevents duplicates</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Receipt Photo
                  {paymentForm.method === 'cash' && <span className="text-red-500 ml-1">* Required for cash</span>}
                  {paymentForm.method === 'mpesa' && <span className="text-muted-foreground ml-1">(optional)</span>}
                </Label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brass/10 file:text-brass hover:file:bg-brass/20 file:cursor-pointer"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
                {receiptFile && (
                  <p className="text-xs text-green-600 flex items-center gap-1">✅ {receiptFile.name}</p>
                )}
                {paymentForm.method === 'cash' && !receiptFile && (
                  <p className="text-xs text-amber-600">📸 Take a photo of the cash receipt for audit trail</p>
                )}
              </div>

              <Button variant="brass" className="w-full" onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                {recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pending Verification</p>
            <p className="text-2xl font-bold text-amber-600">{pendingPayments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Awaiting Payment</p>
            <p className="text-2xl font-bold text-blue-600">{deliveredOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Today&apos;s Total</p>
            <p className="text-2xl font-bold">{formatCurrency(payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-4 py-2 rounded-full text-sm font-medium capitalize", filter === f ? 'bg-brass text-white' : 'bg-muted text-muted-foreground')}>
            {f} {f === 'pending' && `(${pendingPayments.length})`}
          </button>
        ))}
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No payments recorded</p>
          </div>
        ) : (
          filteredPayments.map(payment => {
            const cfg = statusConfig[payment.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={payment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", cfg.color)}>
                        {payment.method === 'mpesa' ? <Smartphone className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {payment.restaurant_orders?.guest_name || 'Payment'}
                          {payment.restaurant_orders?.order_number && ` — Order #${payment.restaurant_orders.order_number}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.method === 'mpesa' ? `M-Pesa: ${payment.mpesa_transaction_id}` : 'Cash payment'}
                          {' • '}{format(new Date(payment.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(payment.amount)}</p>
                        <Badge className={cfg.color}><StatusIcon className="h-3 w-3 mr-1" />{payment.status}</Badge>
                      </div>
                      {payment.status === 'pending' && user?.id && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleVerify(payment.id, 'verified')}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleVerify(payment.id, 'rejected')}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
