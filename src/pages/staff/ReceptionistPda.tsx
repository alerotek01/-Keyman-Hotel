import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTodayArrivals, useTodayDepartures, useAvailableRooms, useCheckIn, useCheckOut, useWalkIn, useRoomStatusOverview } from '@/hooks/useReceptionist';
import { useRoomTypes } from '@/hooks/useRooms';
import { useFolio, usePostFolioPayment, useCloseFolio } from '@/hooks/useFolios';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, LogIn, LogOut, UserPlus, BedDouble, AlertTriangle, CheckCircle2, Receipt, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'arrivals' | 'departures' | 'rooms';

export default function ReceptionistPda() {
  const { user } = useAuth();
  const { data: arrivals, isLoading: arrivalsLoading } = useTodayArrivals();
  const { data: departures, isLoading: departuresLoading } = useTodayDepartures();
  const { data: rooms } = useRoomStatusOverview();
  const { data: roomTypes } = useRoomTypes();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const walkIn = useWalkIn();
  const postPayment = usePostFolioPayment();
  const closeFolio = useCloseFolio();

  const [activeTab, setActiveTab] = useState<Tab>('arrivals');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [assignRoomDialog, setAssignRoomDialog] = useState(false);
  const [walkInDialog, setWalkInDialog] = useState(false);
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);

  // Walk-in form
  const [walkInForm, setWalkInForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '', room_type_id: '',
    room_id: '', num_adults: '2', num_children: '0', check_out: '', special_requests: '', plate_number: '',
    meal_plan: 'room_only' as 'room_only' | 'b&b',
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    method: 'cash', amount: '', reference: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Available rooms for assignment
  const { data: availableRooms } = useAvailableRooms(selectedReservation?.room_type_id || walkInForm.room_type_id || undefined);

  // Folio for checkout
  const { data: folio, isLoading: folioLoading } = useFolio(selectedReservation?.id);

  const isLoading = arrivalsLoading || departuresLoading;

  // Calculate folio totals
  const folioCharges = folio?.folio_transactions || [];
  const folioPayments = folio?.folio_payments || [];
  const totalCharges = folioCharges.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const totalPayments = folioPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balanceDue = totalCharges - totalPayments;

  // ===== Check-In Flow =====
  const handleCheckInSelect = (reservation: any) => {
    setSelectedReservation(reservation);
    setAssignRoomDialog(true);
  };

  const handleAssignRoom = async (roomId: string) => {
    if (!selectedReservation) return;
    try {
      await checkIn.mutateAsync({ reservationId: selectedReservation.id, roomId });
      setAssignRoomDialog(false);
      setSelectedReservation(null);
      toast.success('Guest checked in!');
    } catch (error: any) {
      toast.error(error.message || 'Check-in failed');
    }
  };

  // ===== Check-Out Flow =====
  const handleCheckOutSelect = (reservation: any) => {
    setSelectedReservation(reservation);
    setCheckoutDialog(true);
  };

  const handleProceedToPayment = () => {
    setCheckoutDialog(false);
    setPaymentDialog(true);
    setPaymentForm({ method: 'cash', amount: balanceDue.toString(), reference: '' });
  };

  const handlePayment = async () => {
    if (!folio || !selectedReservation) return;
    if (paymentForm.method === 'cash' && !receiptFile) {
      toast.error('Receipt photo is required for cash payments');
      return;
    }
    try {
      // Complete check-out (payment + folio close + housekeeping task — all atomic)
      await checkOut.mutateAsync({
        reservationId: selectedReservation.id,
        paymentMethod: paymentForm.method,
        paymentAmount: parseFloat(paymentForm.amount) || balanceDue,
        paymentReference: paymentForm.reference || undefined,
        receiptFile: receiptFile || undefined,
      });

      setPaymentDialog(false);
      setSelectedReservation(null);
      setReceiptFile(null);
      toast.success('Guest checked out! Payment recorded.');
    } catch (error: any) {
      toast.error(error.message || 'Check-out failed');
    }
  };

  // ===== Walk-In Flow =====
  const handleWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInForm.room_type_id) { toast.error('Select a room type'); return; }

    try {
      const result = await walkIn.mutateAsync({
        guest_name: walkInForm.guest_name, guest_phone: walkInForm.guest_phone,
        guest_email: walkInForm.guest_email || undefined,
        room_type_id: walkInForm.room_type_id,
        num_adults: parseInt(walkInForm.num_adults) || 2,
        num_children: parseInt(walkInForm.num_children) || 0,
        check_out: walkInForm.check_out,
        special_requests: walkInForm.special_requests || undefined,
        plate_number: walkInForm.plate_number || undefined,
      });
      // Set meal plan on the reservation if B&B
      if (walkInForm.meal_plan === 'b&b' && result?.reservation_id) {
        const { supabase } = await import('@/integrations/supabase/client');
        await (supabase as any).from('reservations').update({ meal_plan: 'b&b' }).eq('id', result.reservation_id);
      }
      setWalkInDialog(false);
      setWalkInForm({ guest_name: '', guest_phone: '', guest_email: '', room_type_id: '', room_id: '', num_adults: '2', num_children: '0', check_out: '', special_requests: '', plate_number: '', meal_plan: 'room_only' });
      toast.success('Walk-in guest checked in!');
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const roomCounts = {
    available: rooms?.filter((r: any) => r.status === 'available' || r.status === 'inspected').length || 0,
    occupied: rooms?.filter((r: any) => r.status === 'occupied').length || 0,
    dirty: rooms?.filter((r: any) => r.status === 'dirty').length || 0,
    total: rooms?.length || 0,
  };

  const statusColors: Record<string, string> = {
    available: 'bg-emerald-100 text-emerald-800', occupied: 'bg-blue-100 text-blue-800',
    dirty: 'bg-amber-100 text-amber-800', cleaning: 'bg-orange-100 text-orange-800',
    inspected: 'bg-brass/10 text-brass', out_of_order: 'bg-red-100 text-red-800',
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-brass" /></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Reception</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button onClick={() => setActiveTab('arrivals')} className={cn("p-3 rounded-xl text-left transition-all", activeTab === 'arrivals' ? "bg-blue-100 ring-2 ring-blue-400" : "bg-white border")}>
          <div className="flex items-center gap-2"><LogIn className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Arrivals</span></div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{arrivals?.length || 0}</p>
        </button>
        <button onClick={() => setActiveTab('departures')} className={cn("p-3 rounded-xl text-left transition-all", activeTab === 'departures' ? "bg-amber-100 ring-2 ring-amber-400" : "bg-white border")}>
          <div className="flex items-center gap-2"><LogOut className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Departures</span></div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{departures?.length || 0}</p>
        </button>
        <button onClick={() => setActiveTab('rooms')} className={cn("p-3 rounded-xl text-left transition-all", activeTab === 'rooms' ? "bg-emerald-100 ring-2 ring-emerald-400" : "bg-white border")}>
          <div className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Available</span></div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{roomCounts.available}/{roomCounts.total}</p>
        </button>
        <button onClick={() => { setActiveTab('arrivals'); setWalkInDialog(true); }} className="p-3 rounded-xl text-left bg-brass/10 border border-brass/20 hover:bg-brass/20 transition-all">
          <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-brass" /><span className="text-xs text-muted-foreground">Walk-In</span></div>
          <p className="text-sm font-semibold text-brass mt-1">+ New Guest</p>
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="arrivals">Arrivals</TabsTrigger>
          <TabsTrigger value="departures">Departures</TabsTrigger>
          <TabsTrigger value="rooms">Room Status</TabsTrigger>
        </TabsList>

        {/* ARRIVALS */}
        <TabsContent value="arrivals" className="space-y-3">
          {!arrivals || arrivals.length === 0 ? (
            <div className="text-center py-12"><CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300 mb-4" /><p className="text-muted-foreground font-medium">All caught up!</p></div>
          ) : arrivals.map((res: any) => (
            <Card key={res.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{res.guests?.name || 'Guest'}</h3>
                    <p className="text-sm text-muted-foreground">{res.room_types?.name || 'Room'} • {res.num_adults + res.num_children} guest(s)</p>
                    {res.special_requests && <p className="text-xs text-amber-600 mt-1">📝 {res.special_requests}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(res.rate))}</p>
                    <p className="text-xs text-muted-foreground">{res.source}</p>
                  </div>
                </div>
                <Button variant="default" className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleCheckInSelect(res)} disabled={checkIn.isPending}>
                  <LogIn className="mr-2 h-4 w-4" /> Check In
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* DEPARTURES */}
        <TabsContent value="departures" className="space-y-3">
          {!departures || departures.length === 0 ? (
            <div className="text-center py-12"><CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300 mb-4" /><p className="text-muted-foreground">No departures today</p></div>
          ) : departures.map((res: any) => (
            <Card key={res.id} className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{res.guests?.name || 'Guest'}</h3>
                    <p className="text-sm text-muted-foreground">Room {res.rooms?.room_number} • {res.room_types?.name || 'Room'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(res.rate))}</p>
                    <Badge className="bg-amber-100 text-amber-800">Checking Out</Badge>
                  </div>
                </div>
                <Button variant="default" className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleCheckOutSelect(res)} disabled={checkOut.isPending}>
                  <LogOut className="mr-2 h-4 w-4" /> Check Out
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ROOM STATUS */}
        <TabsContent value="rooms" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-emerald-50 text-center"><p className="text-2xl font-bold text-emerald-600">{roomCounts.available}</p><p className="text-xs text-muted-foreground">Available</p></div>
            <div className="p-3 rounded-lg bg-blue-50 text-center"><p className="text-2xl font-bold text-blue-600">{roomCounts.occupied}</p><p className="text-xs text-muted-foreground">Occupied</p></div>
            <div className="p-3 rounded-lg bg-amber-50 text-center"><p className="text-2xl font-bold text-amber-600">{roomCounts.dirty}</p><p className="text-xs text-muted-foreground">Dirty</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {rooms?.map((room: any) => (
              <div key={room.id} className="p-3 rounded-lg border bg-white">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold">Room {room.room_number}</p><p className="text-xs text-muted-foreground">Floor {room.floor} • {room.room_types?.name}</p></div>
                  <Badge className={cn("text-xs", statusColors[room.status] || 'bg-gray-100 text-gray-800')}>{room.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ASSIGN ROOM DIALOG */}
      <Dialog open={assignRoomDialog} onOpenChange={setAssignRoomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Room</DialogTitle></DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedReservation.guests?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.room_types?.name} • {selectedReservation.num_adults + selectedReservation.num_children} guests</p>
              </div>
              <div className="space-y-2">
                <Label>Select Available Room</Label>
                {availableRooms && availableRooms.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
                    {availableRooms.map((room: any) => (
                      <button key={room.id} onClick={() => handleAssignRoom(room.id)} disabled={checkIn.isPending} className="p-3 rounded-lg border hover:bg-brass/10 hover:border-brass text-left transition-all">
                        <p className="font-semibold">Room {room.room_number}</p>
                        <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-4">No available rooms of this type</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHECKOUT CONFIRMATION DIALOG */}
      <Dialog open={checkoutDialog} onOpenChange={setCheckoutDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check-Out Summary</DialogTitle></DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedReservation.guests?.name}</p>
                <p className="text-sm text-muted-foreground">Room {selectedReservation.rooms?.room_number} • {selectedReservation.room_types?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedReservation.check_in} → {selectedReservation.check_out}</p>
              </div>

              {/* Folio Summary */}
              {folioLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : folio ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                    <p className="font-medium mb-2">Folio Summary</p>
                    {folioCharges.length > 0 ? (
                      folioCharges.map((charge: any) => (
                        <div key={charge.id} className="flex justify-between">
                          <span className="text-muted-foreground">{charge.description}</span>
                          <span>{formatCurrency(charge.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No charges yet</p>
                    )}
                    {totalPayments > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Payments</span><span>-{formatCurrency(totalPayments)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Balance Due</span><span>{formatCurrency(balanceDue)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-sm text-amber-800">Room will be marked dirty and sent to housekeeping.</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setCheckoutDialog(false)}>Cancel</Button>
                    <Button variant="default" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleProceedToPayment}>
                      <DollarSign className="mr-2 h-4 w-4" /> Pay & Check Out
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No folio found for this reservation.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedReservation?.guests?.name}</p>
              <p className="text-2xl font-bold text-brass">{formatCurrency(balanceDue)}</p>
              <p className="text-xs text-muted-foreground">Balance due</p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentForm({ ...paymentForm, method: 'cash' })} className={cn("p-3 rounded-lg border flex items-center gap-2 transition-all", paymentForm.method === 'cash' ? "border-brass bg-brass/5" : "")}>
                  <DollarSign className="h-4 w-4" /> Cash
                </button>
                <button onClick={() => setPaymentForm({ ...paymentForm, method: 'mpesa' })} className={cn("p-3 rounded-lg border flex items-center gap-2 transition-all", paymentForm.method === 'mpesa' ? "border-brass bg-brass/5" : "")}>
                  📱 M-Pesa
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            </div>

            {paymentForm.method === 'mpesa' && (
              <div className="space-y-2">
                <Label>M-Pesa Transaction ID</Label>
                <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="e.g. QHK7B4C9DE" />
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
                <p className="text-xs text-green-600 flex items-center gap-1">
                  ✅ {receiptFile.name}
                </p>
              )}
              {paymentForm.method === 'cash' && !receiptFile && (
                <p className="text-xs text-amber-600">📸 Take a photo of the cash receipt for audit trail</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setPaymentDialog(false); setReceiptFile(null); }}>Cancel</Button>
              <Button variant="brass" className="flex-1" onClick={handlePayment} disabled={postPayment.isPending || checkOut.isPending}>
                {(postPayment.isPending || checkOut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WALK-IN DIALOG */}
      <Dialog open={walkInDialog} onOpenChange={setWalkInDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Walk-In Guest</DialogTitle></DialogHeader>
          <form onSubmit={handleWalkIn} className="space-y-4">
            <div className="space-y-2"><Label>Guest Name *</Label><Input value={walkInForm.guest_name} onChange={(e) => setWalkInForm({ ...walkInForm, guest_name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone *</Label><Input type="tel" value={walkInForm.guest_phone} onChange={(e) => setWalkInForm({ ...walkInForm, guest_phone: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={walkInForm.guest_email} onChange={(e) => setWalkInForm({ ...walkInForm, guest_email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Room Type *</Label><Select value={walkInForm.room_type_id} onValueChange={(v) => setWalkInForm({ ...walkInForm, room_type_id: v, room_id: '' })}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{roomTypes?.filter(rt => rt.is_active).map(rt => (<SelectItem key={rt.id} value={rt.id}>{rt.name} — {formatCurrency(rt.base_rate)}/night</SelectItem>))}</SelectContent></Select></div>
            {walkInForm.room_type_id && (
              <div className="space-y-2"><Label>Assign Room *</Label><Select value={walkInForm.room_id} onValueChange={(v) => setWalkInForm({ ...walkInForm, room_id: v })}><SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger><SelectContent>{availableRooms?.filter((r: any) => r.room_type_id === walkInForm.room_type_id).map((room: any) => (<SelectItem key={room.id} value={room.id}>Room {room.room_number} (Floor {room.floor})</SelectItem>))}</SelectContent></Select></div>
            )}
            <div className="space-y-2">
              <Label>Meal Plan</Label>
              <div className="flex gap-2">
                <Button type="button" variant={walkInForm.meal_plan === 'room_only' ? 'default' : 'outline'} size="sm" onClick={() => setWalkInForm({ ...walkInForm, meal_plan: 'room_only' })}>🛏️ Room Only</Button>
                <Button type="button" variant={walkInForm.meal_plan === 'b&b' ? 'default' : 'outline'} size="sm" onClick={() => setWalkInForm({ ...walkInForm, meal_plan: 'b&b' })}>🍳 B&B</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Adults</Label><Input type="number" min={1} value={walkInForm.num_adults} onChange={(e) => setWalkInForm({ ...walkInForm, num_adults: e.target.value })} /></div>
              <div className="space-y-2"><Label>Children</Label><Input type="number" min={0} value={walkInForm.num_children} onChange={(e) => setWalkInForm({ ...walkInForm, num_children: e.target.value })} /></div>
              <div className="space-y-2"><Label>Check-Out *</Label><Input type="date" value={walkInForm.check_out} onChange={(e) => setWalkInForm({ ...walkInForm, check_out: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label>Plate Number (optional)</Label><Input placeholder="KXX 000X" value={walkInForm.plate_number} onChange={(e) => setWalkInForm({ ...walkInForm, plate_number: e.target.value.toUpperCase() })} className="uppercase" /></div>
            <Button type="submit" variant="brass" className="w-full" disabled={walkIn.isPending}>{walkIn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check In Walk-In Guest</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
