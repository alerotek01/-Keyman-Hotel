import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAllFolios, useFolio, usePostRoomCharge, usePostRestaurantCharge, usePostFolioPayment, useCloseFolio } from '@/hooks/useFolios';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { generateFolioReceipt } from '@/lib/receipt';
import { useSiteSettings } from '@/hooks/useCms';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Search, Receipt, DollarSign, Plus, X, BedDouble, UtensilsCrossed, CreditCard, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FolioManagement() {
  const { user } = useAuth();
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chargeDialog, setChargeDialog] = useState(false);
  const [chargeType, setChargeType] = useState<'room' | 'restaurant'>('room');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);

  const { data: folios, isLoading: foliosLoading } = useAllFolios(statusFilter);
  const { data: folio, isLoading: folioLoading } = useFolio(selectedFolioId || undefined);
  const postRoomCharge = usePostRoomCharge();
  const postRestaurantCharge = usePostRestaurantCharge();
  const postPayment = usePostFolioPayment();
  const closeFolio = useCloseFolio();
  const { data: settings } = useSiteSettings();
  const getSetting = (key: string) => settings?.find((s: any) => s.key === key)?.value || '';

  // Filter folios by search
  const filteredFolios = folios?.filter((f: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const guestName = f.reservations?.guests?.name?.toLowerCase() || '';
    const roomNumber = String(f.reservations?.rooms?.room_number || '');
    const guestEmail = f.reservations?.guests?.email?.toLowerCase() || '';
    return guestName.includes(q) || roomNumber.includes(q) || guestEmail.includes(q);
  }) || [];

  // Calculate totals for selected folio
  const totalCharges = folio?.folio_transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
  const totalPayments = folio?.folio_payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const balance = totalCharges - totalPayments;

  // ===== Handle Post Charge =====
  const handlePostCharge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!description || !amount || amount <= 0) {
      toast.error('Please enter a valid description and amount');
      return;
    }

    try {
      if (chargeType === 'room') {
        await postRoomCharge.mutateAsync({
          folioId: selectedFolioId!,
          description,
          amount,
          recordedBy: user?.id,
        });
      } else {
        await postRestaurantCharge.mutateAsync({
          folioId: selectedFolioId!,
          description,
          amount,
          recordedBy: user?.id,
        });
      }
      setChargeDialog(false);
      toast.success('Charge posted to folio');
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post charge');
    }
  };

  // ===== Handle Post Payment =====
  const handlePostPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const amount = parseFloat(formData.get('amount') as string);
    const method = formData.get('method') as string;
    const reference = formData.get('reference') as string;

    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (method === 'mpesa' && !reference) {
      toast.error('M-Pesa requires a transaction reference');
      return;
    }

    try {
      await postPayment.mutateAsync({
        folioId: selectedFolioId!,
        amount,
        method,
        reference: reference || undefined,
        recordedBy: user?.id,
      });
      setPaymentDialog(false);
      toast.success('Payment recorded');
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment');
    }
  };

  // ===== Handle Close Folio =====
  const handleCloseFolio = async () => {
    try {
      await closeFolio.mutateAsync(selectedFolioId!);
      setCloseDialog(false);
      setSelectedFolioId(null);
      toast.success('Folio closed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to close folio');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Folio Management</h1>
          <p className="text-muted-foreground mt-1">Guest charges, payments, and account balance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel — Folio List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by guest name, room, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folios</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {/* Folio List */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {foliosLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brass" />
              </div>
            ) : filteredFolios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No folios found</p>
              </div>
            ) : (
              filteredFolios.map((f: any) => {
                const guestName = f.reservations?.guests?.name || 'Unknown';
                const roomNumber = f.reservations?.rooms?.room_number || '—';
                const roomType = f.reservations?.rooms?.room_types?.name || '';
                const isActive = f.status === 'open';

                return (
                  <Card
                    key={f.id}
                    className={cn(
                      'cursor-pointer transition-all hover:ring-2 hover:ring-brass/50',
                      selectedFolioId === f.id && 'ring-2 ring-brass'
                    )}
                    onClick={() => setSelectedFolioId(f.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{guestName}</p>
                          <p className="text-xs text-muted-foreground">
                            Room {roomNumber} {roomType ? `· ${roomType}` : ''}
                          </p>
                        </div>
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {f.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {f.created_at ? format(new Date(f.created_at), 'MMM d') : '—'}
                        </span>
                        <span className={cn('font-mono font-semibold', balance > 0 ? 'text-red-600' : 'text-green-600')}>
                          {formatCurrency(balance)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel — Folio Detail */}
        <div className="lg:col-span-2">
          {!selectedFolioId ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Select a Folio</h3>
                <p className="text-muted-foreground">
                  Choose a guest folio from the list to view charges, payments, and balance
                </p>
              </CardContent>
            </Card>
          ) : folioLoading ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-brass" />
            </Card>
          ) : !folio ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-semibold mb-2">Folio Not Found</h3>
                <p className="text-muted-foreground">This folio may have been deleted</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Guest Info Header */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-display text-2xl font-bold">
                        {folio.reservations?.guests?.name || 'Guest'}
                      </h2>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Room {folio.reservations?.rooms?.room_number || '—'}</span>
                        {folio.reservations?.rooms?.room_types?.name && (
                          <>
                            <span>·</span>
                            <span>{folio.reservations.rooms.room_types.name}</span>
                          </>
                        )}
                        {folio.reservations?.guests?.email && (
                          <>
                            <span>·</span>
                            <span>{folio.reservations.guests.email}</span>
                          </>
                        )}
                      </div>
                      {folio.reservations?.check_in && folio.reservations?.check_out && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(folio.reservations.check_in), 'MMM d')} — {format(new Date(folio.reservations.check_out), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge variant={folio.status === 'open' ? 'default' : 'secondary'} className="text-sm">
                      {folio.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-2xl font-bold font-mono">{formatCurrency(totalCharges)}</p>
                    <p className="text-xs text-muted-foreground">Total Charges</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-2xl font-bold font-mono">{formatCurrency(totalPayments)}</p>
                    <p className="text-xs text-muted-foreground">Payments Made</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Receipt className={cn('h-5 w-5 mx-auto mb-1', balance > 0 ? 'text-red-500' : 'text-green-500')} />
                    <p className={cn('text-2xl font-bold font-mono', balance > 0 ? 'text-red-600' : 'text-green-600')}>
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {balance > 0 ? 'Amount Due' : balance < 0 ? 'Overpaid' : 'Settled'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              {folio.status === 'open' && (
                <div className="flex gap-3">
                  <Button variant="brass" onClick={() => { setChargeType('room'); setChargeDialog(true); }}>
                    <BedDouble className="mr-2 h-4 w-4" />
                    Post Room Charge
                  </Button>
                  <Button variant="brass" onClick={() => { setChargeType('restaurant'); setChargeDialog(true); }}>
                    <UtensilsCrossed className="mr-2 h-4 w-4" />
                    Post Restaurant Charge
                  </Button>
                  <Button variant="default" onClick={() => setPaymentDialog(true)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                  <Button variant="outline" onClick={() => {
                    generateFolioReceipt({
                      guestName: folio.reservations?.guests?.name || 'Guest',
                      guestEmail: folio.reservations?.guests?.email,
                      guestPhone: folio.reservations?.guests?.phone,
                      roomNumber: folio.reservations?.rooms?.room_number || '—',
                      roomType: folio.reservations?.rooms?.room_types?.name,
                      checkIn: folio.reservations?.check_in,
                      checkOut: folio.reservations?.check_out,
                      folioId: folio.id,
                      charges: (folio.folio_transactions || []).map((t: any) => ({
                        description: t.description || t.type,
                        amount: Number(t.amount),
                        type: t.type,
                        date: t.created_at,
                      })),
                      payments: (folio.folio_payments || []).map((p: any) => ({
                        method: p.method,
                        amount: Number(p.amount),
                        reference: p.reference,
                        date: p.created_at,
                      })),
                      hotelName: getSetting('hotel_name') || 'Keyman Hotel',
                      hotelAddress: getSetting('hotel_address'),
                      hotelPhone: getSetting('phone'),
                      hotelEmail: getSetting('hotel_email'),
                    });
                  }}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                  </Button>
                  {balance <= 0 && (
                    <Button variant="outline" onClick={() => setCloseDialog(true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Close Folio
                    </Button>
                  )}
                </div>
              )}

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Charges & Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Charges */}
                  {folio.folio_transactions?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Charges</h4>
                      <div className="space-y-2">
                        {folio.folio_transactions
                          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((txn: any) => (
                            <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center',
                                  txn.type === 'room_charge' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                )}>
                                  {txn.type === 'room_charge' ? <BedDouble className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{txn.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {txn.type === 'room_charge' ? 'Room Charge' : 'Restaurant'} · {format(new Date(txn.created_at), 'MMM d, h:mm a')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-sm">+{formatCurrency(txn.amount)}</p>

                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Payments */}
                  {folio.folio_payments?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Payments</h4>
                      <div className="space-y-2">
                        {folio.folio_payments
                          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((pay: any) => (
                            <div key={pay.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                                  <CreditCard className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium capitalize">{pay.method} Payment</p>
                                  <p className="text-xs text-muted-foreground">
                                    {pay.reference ? `Ref: ${pay.reference}` : 'No reference'} · {format(new Date(pay.created_at), 'MMM d, h:mm a')}
                                  </p>
                                </div>
                              </div>
                              <p className="font-mono font-semibold text-sm text-green-600">-{formatCurrency(pay.amount)}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!folio.folio_transactions || folio.folio_transactions.length === 0) &&
                   (!folio.folio_payments || folio.folio_payments.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No transactions yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          )}
        </div>
      </div>

      {/* ===== Post Charge Dialog ===== */}              <Dialog open={chargeDialog} onOpenChange={setChargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {chargeType === 'room' ? 'Post Room Charge' : 'Post Restaurant Charge'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Add a charge to this guest's folio.</p>
          </DialogHeader>
          <form onSubmit={handlePostCharge} className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required placeholder="e.g. Room 101 — 3 nights" />
            </div>
            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setChargeDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="brass" disabled={postRoomCharge.isPending || postRestaurantCharge.isPending}>
                {(postRoomCharge.isPending || postRestaurantCharge.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Charge
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Record Payment Dialog ===== */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <p className="text-sm text-muted-foreground">Record a payment against this folio.</p>
          </DialogHeader>
          <form onSubmit={handlePostPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pay-amount">Amount (KES)</Label>
                <Input id="pay-amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="pay-method">Method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger id="pay-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="pay-reference">Transaction Reference (required for M-Pesa)</Label>
              <Input id="pay-reference" name="reference" placeholder="e.g. QHK7B4R9XZ" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPaymentDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={postPayment.isPending}>
                {postPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Close Folio Confirmation ===== */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Folio</DialogTitle>
            <p className="text-sm text-muted-foreground">Permanently close this guest folio.</p>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to close this folio? This action cannot be undone.
            </p>
            {balance > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">
                  ⚠️ Outstanding balance of {formatCurrency(balance)} still due.
                </p>
              </div>
            )}
            {balance <= 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800">
                  ✓ All charges settled. Folio is ready to close.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCloseDialog(false)}>
                Cancel
              </Button>
              <Button variant={balance > 0 ? 'destructive' : 'default'} onClick={handleCloseFolio} disabled={closeFolio.isPending}>
                {closeFolio.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Close Folio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
