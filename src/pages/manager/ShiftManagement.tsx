import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStartShift, useEndShift, useApproveReconciliation } from '@/hooks/usePayments';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import {
  Loader2, Clock, Users, LogIn, LogOut, Calendar, Plus,
  CheckCircle2, AlertTriangle, XCircle, Ban, Send, Eye, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const SHIFT_NAMES = ['morning', 'afternoon', 'night'];
const SHIFT_TIMES: Record<string, string> = { morning: '6am – 2pm', afternoon: '2pm – 10pm', night: '10pm – 6am' };

const SHIFT_STATUS: Record<string, { color: string; label: string }> = {
  not_started: { color: 'bg-gray-100 text-gray-700', label: 'Scheduled' },
  active: { color: 'bg-blue-100 text-blue-700', label: 'Active' },
  ended: { color: 'bg-amber-100 text-amber-700', label: 'Ended' },
  submitted: { color: 'bg-purple-100 text-purple-700', label: 'Submitted' },
  reconciled: { color: 'bg-emerald-100 text-emerald-700', label: 'Reconciled' },
  closed: { color: 'bg-gray-100 text-gray-700', label: 'Closed' },
};

const RECON_STATUS: Record<string, { color: string; label: string }> = {
  submitted: { color: 'bg-purple-100 text-purple-700', label: 'Pending Review' },
  approved: { color: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
  flagged: { color: 'bg-red-100 text-red-700', label: 'Flagged' },
  explained: { color: 'bg-blue-100 text-blue-700', label: 'Explained' },
  reconciled: { color: 'bg-emerald-100 text-emerald-700', label: 'Reconciled' },
  closed: { color: 'bg-gray-100 text-gray-700', label: 'Closed' },
};

const DEPT_ROLE_MAP: Record<string, string[]> = {
  'Front Office': ['receptionist'],
  Restaurant: ['waiter', 'chef'],
  Kitchen: ['chef'],
  Housekeeping: ['housekeeper'],
  Finance: ['accountant'],
  Management: ['manager', 'admin'],
};

export default function ShiftManagement() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [assignDialog, setAssignDialog] = useState(false);
  const [endDialog, setEndDialog] = useState(false);
  const [reconDialog, setReconDialog] = useState(false);
  const [flagDialog, setFlagDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedRecon, setSelectedRecon] = useState<any>(null);
  const [flagNotes, setFlagNotes] = useState('');

  // Assign form
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    department_id: '',
    shift_name: 'morning',
    shift_date: today,
  });

  // End shift form
  const [endNotes, setEndNotes] = useState('');

  // Fetch all staff
  const { data: staff } = useQuery({
    queryKey: ['all-staff-list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('id, full_name, email, role, department_id')
        .eq('is_active', true)
        .not('role', 'in', '(guest,external_customer)')
        .order('role');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all shifts for selected date
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['all-shifts', selectedDate],
    queryFn: async () => {
      const { data, error } = await sb
        .from('staff_shifts')
        .select('*, users:user_id(full_name, email, role), departments:department_id(name)')
        .eq('shift_date', selectedDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch reconciliations
  const { data: reconciliations, isLoading: reconLoading } = useQuery({
    queryKey: ['reconciliations', selectedDate],
    queryFn: async () => {
      const { data, error } = await sb
        .from('shift_reconciliations')
        .select('*, staff_shifts!shift_id(*, users:user_id(full_name, role), departments:department_id(name)), users_submitted:submitted_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Mutations
  const startShift = useStartShift();
  const endShift = useEndShift();
  const approveReconciliation = useApproveReconciliation();

  // Filtered data
  const activeShifts = (shifts || []).filter((s: any) => s.status === 'active');
  const endedShifts = (shifts || []).filter((s: any) => ['ended', 'submitted', 'reconciled', 'closed'].includes(s.status));
  const pendingRecons = (reconciliations || []).filter((r: any) => r.status === 'submitted');
  const reviewedRecons = (reconciliations || []).filter((r: any) => r.status !== 'submitted');

  // Filter staff by selected department
  const filteredStaff = assignForm.department_id
    ? (staff || []).filter((s: any) => {
        const dept = departments?.find((d: any) => d.id === assignForm.department_id);
        const allowedRoles = DEPT_ROLE_MAP[dept?.name || ''] || [];
        return allowedRoles.length === 0 || allowedRoles.includes(s.role);
      })
    : staff || [];

  // Check if staff already has an active shift today
  const staffWithActiveShift = new Set(
    (shifts || []).filter((s: any) => s.status === 'active').map((s: any) => s.user_id)
  );

  // ===== HANDLERS =====

  const handleAssign = async () => {
    if (!assignForm.user_id) { toast.error('Select a staff member'); return; }
    try {
      await startShift.mutateAsync({
        user_id: assignForm.user_id,
        department_id: assignForm.department_id || undefined,
        shift_date: assignForm.shift_date,
        shift_name: assignForm.shift_name,
      });
      const staffMember = staff?.find((s: any) => s.id === assignForm.user_id);
      toast.success(`Shift assigned to ${staffMember?.full_name || 'Staff'}`);
      setAssignDialog(false);
      setAssignForm({ user_id: '', department_id: '', shift_name: 'morning', shift_date: today });
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign shift');
    }
  };

  const handleEndShift = async () => {
    if (!selectedShift) return;
    try {
      await endShift.mutateAsync({ shiftId: selectedShift.id });
      toast.success(`Shift ended for ${selectedShift.users?.full_name || 'Staff'}`);
      setEndDialog(false);
      setSelectedShift(null);
      setEndNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to end shift');
    }
  };

  const handleApproveRecon = async (reconId: string) => {
    try {
      await approveReconciliation.mutateAsync({
        reconciliationId: reconId,
        managerId: user?.id || '',
        status: 'approved',
      });
      toast.success('Reconciliation approved');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  const handleFlagRecon = async () => {
    if (!selectedRecon) return;
    try {
      await approveReconciliation.mutateAsync({
        reconciliationId: selectedRecon.id,
        managerId: user?.id || '',
        status: 'flagged',
        notes: flagNotes || undefined,
      });
      toast.success('Reconciliation flagged');
      setFlagDialog(false);
      setSelectedRecon(null);
      setFlagNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    }
  };

  if (shiftsLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brass" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-brass" />
            Shift Management
          </h1>
          <p className="text-muted-foreground mt-1">Assign, monitor, and reconcile staff shifts</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          <Button variant="brass" onClick={() => setAssignDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Assign Shift
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeShifts.length}</p>
            <p className="text-xs text-muted-foreground">Active Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{endedShifts.length}</p>
            <p className="text-xs text-muted-foreground">Ended Today</p>
          </CardContent>
        </Card>
        <Card className={pendingRecons.length > 0 ? 'bg-amber-50 border-amber-200' : ''}>
          <CardContent className="p-4 text-center">
            <p className={cn('text-2xl font-bold', pendingRecons.length > 0 ? 'text-amber-600' : '')}>{pendingRecons.length}</p>
            <p className="text-xs text-muted-foreground">Pending Reconciliations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{(reconciliations || []).filter((r: any) => r.status === 'approved').length}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">On Shift ({activeShifts.length})</TabsTrigger>
          <TabsTrigger value="history">History ({endedShifts.length})</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliations ({pendingRecons.length})</TabsTrigger>
        </TabsList>

        {/* Active Shifts */}
        <TabsContent value="active" className="space-y-3 mt-4">
          {activeShifts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No staff currently on shift</p>
                <Button variant="brass" className="mt-4" onClick={() => setAssignDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Assign First Shift
                </Button>
              </CardContent>
            </Card>
          ) : (
            activeShifts.map((s: any) => {
              const duration = s.start_time
                ? differenceInMinutes(new Date(), new Date(s.start_time))
                : 0;
              return (
                <Card key={s.id} className="border-blue-200 bg-blue-50/30">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <LogIn className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{s.users?.full_name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] capitalize">{s.users?.role || 'Staff'}</Badge>
                          <span>•</span>
                          <span className="capitalize">{s.shift_name} shift</span>
                          {s.departments?.name && <><span>•</span><span>{s.departments.name}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-700">Active</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Started {s.start_time ? format(new Date(s.start_time), 'h:mm a') : '—'}
                          {duration > 0 && ` · ${duration}min`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => { setSelectedShift(s); setEndDialog(true); }}
                      >
                        <LogOut className="h-4 w-4 mr-1" /> End
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Shift History */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {endedShifts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No ended shifts for this date</p>
          ) : (
            endedShifts.map((s: any) => {
              const cfg = SHIFT_STATUS[s.status] || { color: 'bg-gray-100 text-gray-700', label: s.status };
              const duration = s.start_time && s.end_time
                ? differenceInMinutes(new Date(s.end_time), new Date(s.start_time))
                : 0;
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <LogOut className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.users?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="capitalize">{s.shift_name}</span>
                          {s.departments?.name && ` · ${s.departments.name}`}
                          {duration > 0 && ` · ${duration}min`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {s.start_time ? format(new Date(s.start_time), 'h:mm a') : '—'}
                        {s.end_time ? ` → ${format(new Date(s.end_time), 'h:mm a')}` : ''}
                      </span>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Reconciliations */}
        <TabsContent value="reconciliation" className="mt-4">
          {pendingRecons.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Pending Review ({pendingRecons.length})
              </h3>
              <div className="space-y-3">
                {pendingRecons.map((r: any) => (
                  <Card key={r.id} className="border-amber-200 bg-amber-50/30">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {r.staff_shifts?.users?.full_name || 'Staff'}
                              <span className="text-muted-foreground ml-2">({r.staff_shifts?.shift_name})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {r.created_at ? format(new Date(r.created_at), 'h:mm a') : ''}
                            </p>
                          </div>
                        </div>
                        <Badge className={RECON_STATUS[r.status]?.color}>{RECON_STATUS[r.status]?.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="p-2 bg-white rounded-lg">
                          <p className="text-[10px] text-muted-foreground">Sales</p>
                          <p className="font-medium">{formatCurrency(r.sales_total)}</p>
                        </div>
                        <div className="p-2 bg-white rounded-lg">
                          <p className="text-[10px] text-muted-foreground">Cash</p>
                          <p className="font-medium">{formatCurrency(r.cash_total)}</p>
                        </div>
                        <div className="p-2 bg-white rounded-lg">
                          <p className="text-[10px] text-muted-foreground">M-Pesa</p>
                          <p className="font-medium">{formatCurrency(r.mpesa_total)}</p>
                        </div>
                        <div className={cn('p-2 rounded-lg', r.variance >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                          <p className="text-[10px] text-muted-foreground">Variance</p>
                          <p className={cn('font-medium', r.variance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {r.variance >= 0 ? '+' : ''}{formatCurrency(r.variance)}
                          </p>
                        </div>
                        <div className="p-2 bg-white rounded-lg">
                          <p className="text-[10px] text-muted-foreground">Actual Cash</p>
                          <p className="font-medium">{formatCurrency(r.actual_cash)}</p>
                        </div>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground italic bg-white p-2 rounded">"{r.notes}"</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleApproveRecon(r.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setSelectedRecon(r); setFlagDialog(true); }}>
                          <XCircle className="h-4 w-4 mr-1" /> Flag
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedRecon(r); setDetailDialog(true); }}>
                          <Eye className="h-4 w-4 mr-1" /> Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {reviewedRecons.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Reviewed</h3>
              <div className="space-y-2">
                {reviewedRecons.map((r: any) => {
                  const cfg = RECON_STATUS[r.status] || { color: 'bg-gray-100', label: r.status };
                  return (
                    <Card key={r.id} className="opacity-70">
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium">{r.staff_shifts?.users?.full_name || 'Staff'}</p>
                            <p className="text-xs text-muted-foreground">
                              Sales {formatCurrency(r.sales_total)} · Variance {formatCurrency(r.variance)}
                            </p>
                          </div>
                        </div>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {pendingRecons.length === 0 && reviewedRecons.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No reconciliations yet</p>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== ASSIGN SHIFT DIALOG ===== */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-brass" /> Assign Shift
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department (optional)</Label>
              <Select value={assignForm.department_id || '__all__'} onValueChange={(v) => setAssignForm({ ...assignForm, department_id: v === '__all__' ? '' : v, user_id: '' })}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All departments</SelectItem>
                  {departments?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={assignForm.user_id} onValueChange={(v) => setAssignForm({ ...assignForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {filteredStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} disabled={staffWithActiveShift.has(s.id)}>
                      {s.full_name || s.email} ({s.role})
                      {staffWithActiveShift.has(s.id) ? ' — On Shift' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shift</Label>
              <div className="grid grid-cols-3 gap-2">
                {SHIFT_NAMES.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, shift_name: name })}
                    className={cn(
                      'p-3 rounded-xl border-2 text-center transition-all capitalize',
                      assignForm.shift_name === name
                        ? 'border-brass bg-brass/5 text-brass font-semibold'
                        : 'border-border hover:border-brass/50'
                    )}
                  >
                    <p className="text-sm">{name}</p>
                    <p className="text-[10px] text-muted-foreground">{SHIFT_TIMES[name]}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={assignForm.shift_date} onChange={(e) => setAssignForm({ ...assignForm, shift_date: e.target.value })} />
            </div>

            <Button variant="brass" className="w-full" onClick={handleAssign} disabled={startShift.isPending || !assignForm.user_id}>
              {startShift.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Assign Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== END SHIFT DIALOG ===== */}
      <Dialog open={endDialog} onOpenChange={setEndDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <LogOut className="h-5 w-5" /> End Shift
            </DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium">{selectedShift.users?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {selectedShift.shift_name} shift
                  {selectedShift.start_time && ` · Started ${format(new Date(selectedShift.start_time), 'h:mm a')}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={endNotes} onChange={(e) => setEndNotes(e.target.value)} placeholder="Any notes about this shift..." rows={2} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setEndDialog(false); setSelectedShift(null); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleEndShift} disabled={endShift.isPending}>
                  {endShift.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                  End Shift
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== FLAG RECONCILIATION DIALOG ===== */}
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
                <p><strong>{selectedRecon.staff_shifts?.users?.full_name}</strong> — Variance: {formatCurrency(selectedRecon.variance)}</p>
              </div>
              <div className="space-y-2">
                <Label>Reason for flagging *</Label>
                <Textarea
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Explain the discrepancy or issue..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setFlagDialog(false); setSelectedRecon(null); setFlagNotes(''); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleFlagRecon} disabled={approveReconciliation.isPending || !flagNotes.trim()}>
                  {approveReconciliation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                  Flag
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== RECONCILIATION DETAIL DIALOG ===== */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reconciliation Details</DialogTitle>
          </DialogHeader>
          {selectedRecon && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Staff</p><p className="font-medium">{selectedRecon.staff_shifts?.users?.full_name}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Shift</p><p className="font-medium capitalize">{selectedRecon.staff_shifts?.shift_name}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Sales Total</p><p className="font-medium">{formatCurrency(selectedRecon.sales_total)}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Cash Total</p><p className="font-medium">{formatCurrency(selectedRecon.cash_total)}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">M-Pesa Total</p><p className="font-medium">{formatCurrency(selectedRecon.mpesa_total)}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Room Charges</p><p className="font-medium">{formatCurrency(selectedRecon.room_charges_total || 0)}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Expected Cash</p><p className="font-medium">{formatCurrency(selectedRecon.expected_cash)}</p></div>
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Actual Cash</p><p className="font-medium">{formatCurrency(selectedRecon.actual_cash)}</p></div>
              </div>
              <div className={cn('p-3 rounded-lg', selectedRecon.variance >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                <p className="text-[10px] text-muted-foreground">Variance</p>
                <p className={cn('font-bold text-lg', selectedRecon.variance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {selectedRecon.variance >= 0 ? '+' : ''}{formatCurrency(selectedRecon.variance)}
                </p>
              </div>
              {selectedRecon.notes && (
                <div className="p-2 bg-muted rounded"><p className="text-[10px] text-muted-foreground">Staff Notes</p><p className="italic">{selectedRecon.notes}</p></div>
              )}
              {selectedRecon.manager_notes && (
                <div className="p-2 bg-red-50 rounded"><p className="text-[10px] text-muted-foreground">Manager Notes</p><p className="italic text-red-700">{selectedRecon.manager_notes}</p></div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Submitted by {selectedRecon.users_submitted?.full_name || 'Staff'}</span>
                <Badge className={RECON_STATUS[selectedRecon.status]?.color}>{RECON_STATUS[selectedRecon.status]?.label}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
