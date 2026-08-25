import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon, DollarSign, TrendingUp, Users, AlertTriangle,
  Plus, Trash2, Percent, Clock, Sun, Snowflake, Zap, BarChart3
} from "lucide-react";
import {
  useRateOverrides, useCreateRateOverride, useDeleteRateOverride,
  useMinStayRules, useCreateMinStayRule, useDeleteMinStayRule,
  usePricingRules, useCreatePricingRule, useDeletePricingRule,
  useRatePlans, useCreateRatePlan, useDeleteRatePlan,
  useSeasonalTemplates, useCreateSeasonalTemplate, useDeleteSeasonalTemplate,
  useRevenueSummary, useOverbookingLimit, useRoomTypes, useRunAutoPricing,
} from "@/hooks/useRevenueManagement";

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ═══════════════════════════════════════════════════
// RATE CALENDAR — Visual rate display per day per room type
// ═══════════════════════════════════════════════════
function RateCalendar() {
  const { data: overrides = [], isLoading } = useRateOverrides();
  const { data: roomTypes = [] } = useRoomTypes();
  const createOverride = useCreateRateOverride();
  const deleteOverride = useDeleteRateOverride();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [newOverride, setNewOverride] = useState({
    room_type_id: '', start_date: '', end_date: '', rate: 0, reason: ''
  });

  // Build calendar grid
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Map overrides by date string for quick lookup
  const overrideMap: Record<string, any> = {};
  overrides.filter(o => o.is_active).forEach(o => {
    const start = new Date(o.start_date);
    const end = new Date(o.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!overrideMap[key]) overrideMap[key] = [];
      overrideMap[key].push(o);
    }
  });

  const handleAdd = async () => {
    if (!newOverride.room_type_id || !newOverride.start_date || !newOverride.end_date || !newOverride.rate) {
      toast({ title: 'Missing fields', description: 'Fill all required fields' });
      return;
    }
    try {
      await createOverride.mutateAsync(newOverride);
      toast({ title: 'Rate override added' });
      setShowAdd(false);
      setNewOverride({ room_type_id: '', start_date: '', end_date: '', rate: 0, reason: '' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Calendar</h3>
          <p className="text-sm text-muted-foreground">Set different rates per date range. Overrides take priority over base rates.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Rate Override
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex gap-2 flex-wrap">
        {MONTHS.map((m, i) => (
          <Button key={i} size="sm" variant={i === selectedMonth ? 'default' : 'outline'}
            onClick={() => setSelectedMonth(i)}>
            {m}
          </Button>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const overridesForDay = overrideMap[dateStr] || [];
          const dayOfWeek = new Date(selectedYear, selectedMonth, day).getDay();
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

          return (
            <div key={i} className={`border rounded p-1 text-xs min-h-[60px] ${isWeekend ? 'bg-amber-50' : 'bg-white'}`}>
              <div className="font-medium">{day}</div>
              {overridesForDay.map((o, j) => {
                const rt = roomTypes.find(r => r.id === o.room_type_id);
                return (
                  <div key={j} className="mt-0.5 bg-blue-100 rounded px-1 flex items-center justify-between">
                    <span className="truncate">{rt?.name?.substring(0, 6)}: {o.rate}</span>
                    <button onClick={() => deleteOverride.mutate(o.id)} className="text-red-500 hover:text-red-700 text-[10px]">✕</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Current Overrides Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Rate Overrides ({overrides.filter(o => o.is_active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
          overrides.filter(o => o.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate overrides. All rooms use base rates.</p>
          ) : (
            <div className="space-y-2">
              {overrides.filter(o => o.is_active).map(o => {
                const rt = roomTypes.find(r => r.id === o.room_type_id);
                return (
                  <div key={o.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{rt?.name}</Badge>
                      <span className="text-sm">{o.start_date} → {o.end_date}</span>
                      <span className="font-semibold">KES {o.rate}</span>
                      {o.source === 'auto' && <Badge className="bg-blue-100 text-blue-700">Auto</Badge>}
                      {o.reason && <span className="text-xs text-muted-foreground">{o.reason}</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteOverride.mutate(o.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Override Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rate Override</DialogTitle>
            <DialogDescription>Set a custom rate for a date range. Leave base rate unchanged on dates without overrides.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Type</Label>
              <Select value={newOverride.room_type_id} onValueChange={(v) => setNewOverride({ ...newOverride, room_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                <SelectContent>
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name} (Base: KES {rt.base_rate})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={newOverride.start_date}
                onChange={(e) => setNewOverride({ ...newOverride, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={newOverride.end_date}
                onChange={(e) => setNewOverride({ ...newOverride, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Rate (KES per night)</Label><Input type="number" min={100} value={newOverride.rate || ''}
              onChange={(e) => setNewOverride({ ...newOverride, rate: Number(e.target.value) })} /></div>
            <div><Label>Reason (optional)</Label><Input placeholder="e.g. Weekend premium, Holiday rate"
              value={newOverride.reason} onChange={(e) => setNewOverride({ ...newOverride, reason: e.target.value })} /></div>
            <Button onClick={handleAdd} disabled={createOverride.isPending} className="w-full">
              {createOverride.isPending ? 'Adding...' : 'Add Rate Override'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MINIMUM STAY RULES
// ═══════════════════════════════════════════════════
function MinStaySection() {
  const { data: rules = [] } = useMinStayRules();
  const createRule = useCreateMinStayRule();
  const deleteRule = useDeleteMinStayRule();
  const { data: roomTypes = [] } = useRoomTypes();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ room_type_id: '', day_of_week: '', start_date: '', end_date: '', min_nights: 2, reason: '' });

  const handleAdd = async () => {
    try {
      await createRule.mutateAsync({
        ...form,
        room_type_id: form.room_type_id || undefined,
        day_of_week: form.day_of_week !== '' ? Number(form.day_of_week) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      toast({ title: 'Rule added' });
      setShowAdd(false);
      setForm({ room_type_id: '', day_of_week: '', start_date: '', end_date: '', min_nights: 2, reason: '' });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Minimum Stay Rules</h3>
          <p className="text-sm text-muted-foreground">Require minimum nights for certain dates or day-of-week. E.g., "Friday arrivals: minimum 2 nights".</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Rule</Button>
      </div>

      {rules.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No minimum stay rules. All bookings allow 1+ nights.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{r.room_types?.name || 'All Types'}</Badge>
                {r.day_of_week !== null && <Badge>{DAYS_OF_WEEK[r.day_of_week]}</Badge>}
                {r.start_date && <span className="text-xs">{r.start_date}{r.end_date ? ` → ${r.end_date}` : ''}</span>}
                <span className="font-semibold">Min {r.min_nights} nights</span>
                {r.reason && <span className="text-xs text-muted-foreground">{r.reason}</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteRule.mutate(r.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Minimum Stay Rule</DialogTitle>
            <DialogDescription>Force guests to stay multiple nights on specific dates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Room Type (blank = all)</Label>
              <Select value={form.room_type_id} onValueChange={(v) => setForm({ ...form, room_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="All room types" /></SelectTrigger>
                <SelectContent>
                  {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Day of Week (blank = every day)</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                <SelectTrigger><SelectValue placeholder="Every day" /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Minimum Nights</Label><Input type="number" min={1} max={30} value={form.min_nights}
              onChange={(e) => setForm({ ...form, min_nights: Number(e.target.value) })} /></div>
            <div><Label>Reason</Label><Input placeholder="e.g. Weekend peak" value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <Button onClick={handleAdd} className="w-full">Add Rule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PRICING RULES (Auto-Occupancy Pricing)
// ═══════════════════════════════════════════════════
function PricingRulesSection() {
  const { data: rules = [] } = usePricingRules();
  const createRule = useCreatePricingRule();
  const deleteRule = useDeletePricingRule();
  const runAutoPricing = useRunAutoPricing();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', rule_type: 'occupancy', min_occupancy_pct: 70, max_occupancy_pct: 100,
    adjustment_type: 'percentage', adjustment_value: 15, min_rate: 0, max_rate: 99999, priority: 0
  });

  const handleAdd = async () => {
    try {
      await createRule.mutateAsync(form);
      toast({ title: 'Pricing rule added' });
      setShowAdd(false);
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  const handleRunPricing = async () => {
    try {
      const result = await runAutoPricing.mutateAsync();
      toast({ title: 'Auto-pricing applied', description: `Adjusted ${result?.adjusted || 0} rates` });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Occupancy-Based Auto-Pricing</h3>
          <p className="text-sm text-muted-foreground">Automatically adjust rates when occupancy crosses thresholds.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRunPricing} size="sm" variant="outline" disabled={runAutoPricing.isPending}>
            <Zap className="w-4 h-4 mr-1" /> {runAutoPricing.isPending ? 'Running...' : 'Run Now'}
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Rule</Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No pricing rules. Rates stay at base rate regardless of occupancy.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Badge className={r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>
                  {r.is_active ? 'Active' : 'Paused'}
                </Badge>
                <span className="font-medium">{r.name}</span>
                <span className="text-sm text-muted-foreground">
                  When {r.min_occupancy_pct}–{r.max_occupancy_pct}% occupied
                </span>
                <Badge variant="outline">
                  {r.adjustment_type === 'percentage' ? `${r.adjustment_value > 0 ? '+' : ''}${r.adjustment_value}%` : `+KES ${r.adjustment_value}`}
                </Badge>
                {r.min_rate && <span className="text-xs text-muted-foreground">Min: {r.min_rate}</span>}
                {r.max_rate && <span className="text-xs text-muted-foreground">Max: {r.max_rate}</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteRule.mutate(r.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pricing Rule</DialogTitle>
            <DialogDescription>Define when rates should auto-adjust based on occupancy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Rule Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. High demand surge" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Occupancy %</Label><Input type="number" value={form.min_occupancy_pct}
                onChange={(e) => setForm({ ...form, min_occupancy_pct: Number(e.target.value) })} /></div>
              <div><Label>Max Occupancy %</Label><Input type="number" value={form.max_occupancy_pct}
                onChange={(e) => setForm({ ...form, max_occupancy_pct: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Adjustment Type</Label>
                <Select value={form.adjustment_type} onValueChange={(v) => setForm({ ...form, adjustment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Adjustment Value</Label><Input type="number" value={form.adjustment_value}
                onChange={(e) => setForm({ ...form, adjustment_value: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Rate Floor</Label><Input type="number" value={form.min_rate}
                onChange={(e) => setForm({ ...form, min_rate: Number(e.target.value) })} /></div>
              <div><Label>Max Rate Cap</Label><Input type="number" value={form.max_rate}
                onChange={(e) => setForm({ ...form, max_rate: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={handleAdd} className="w-full">Add Pricing Rule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// RATE PLANS (Fencing)
// ═══════════════════════════════════════════════════
function RatePlansSection() {
  const { data: plans = [] } = useRatePlans();
  const createPlan = useCreateRatePlan();
  const deletePlan = useDeleteRatePlan();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', discount_type: 'percentage', discount_value: 10,
    min_nights: 1, max_nights: null as number | null, advance_booking_days: null as number | null,
    requires_corporate_code: false, is_refundable: true, cancellation_hours: 24
  });

  const handleAdd = async () => {
    if (!form.name || !form.code) { toast({ title: 'Missing fields' }); return; }
    try {
      await createPlan.mutateAsync(form);
      toast({ title: 'Rate plan created' });
      setShowAdd(false);
      setForm({ name: '', code: '', discount_type: 'percentage', discount_value: 10, min_nights: 1, max_nights: null, advance_booking_days: null, requires_corporate_code: false, is_refundable: true, cancellation_hours: 24 });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Plans (Fencing)</h3>
          <p className="text-sm text-muted-foreground">Different pricing for different guest segments. Non-refundable, corporate, early bird, etc.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Plan</Button>
      </div>

      {plans.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No rate plans. All guests pay the standard rate.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-muted-foreground">Code: {p.code}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `KES ${p.discount_value} off`}
                      </Badge>
                      {p.min_nights > 1 && <Badge variant="outline">Min {p.min_nights} nights</Badge>}
                      {p.advance_booking_days && <Badge variant="outline">{p.advance_booking_days}+ days advance</Badge>}
                      {!p.is_refundable && <Badge className="bg-red-100 text-red-700">Non-refundable</Badge>}
                      {p.requires_corporate_code && <Badge className="bg-purple-100 text-purple-700">Corporate</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deletePlan.mutate(p.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rate Plan</DialogTitle>
            <DialogDescription>Create a fenced rate for specific guest segments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plan Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Early Bird" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. EARLY20" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Discount Value</Label><Input type="number" value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Nights</Label><Input type="number" value={form.min_nights}
                onChange={(e) => setForm({ ...form, min_nights: Number(e.target.value) })} /></div>
              <div><Label>Advance Booking (days)</Label><Input type="number" value={form.advance_booking_days || ''}
                onChange={(e) => setForm({ ...form, advance_booking_days: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_refundable} onCheckedChange={(v) => setForm({ ...form, is_refundable: v })} />
                <Label>Refundable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.requires_corporate_code} onCheckedChange={(v) => setForm({ ...form, requires_corporate_code: v })} />
                <Label>Corporate Code Required</Label>
              </div>
            </div>
            <Button onClick={handleAdd} className="w-full">Create Rate Plan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SEASONAL TEMPLATES
// ═══════════════════════════════════════════════════
function SeasonalSection() {
  const { data: templates = [] } = useSeasonalTemplates();
  const createTemplate = useCreateSeasonalTemplate();
  const deleteTemplate = useDeleteSeasonalTemplate();
  const { data: roomTypes = [] } = useRoomTypes();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', single_rate: 0, twin_rate: 0, studio_rate: 0,
    start_date: '', end_date: '', year_recurring: false
  });

  const handleAdd = async () => {
    try {
      await createTemplate.mutateAsync(form);
      toast({ title: 'Seasonal template created' });
      setShowAdd(false);
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  // Pre-fill from room types
  const prefillRates = () => {
    const single = roomTypes.find(r => r.name?.toLowerCase().includes('single'));
    const twin = roomTypes.find(r => r.name?.toLowerCase().includes('twin'));
    const studio = roomTypes.find(r => r.name?.toLowerCase().includes('studio'));
    setForm({
      ...form,
      single_rate: single?.base_rate || 0,
      twin_rate: twin?.base_rate || 0,
      studio_rate: studio?.base_rate || 0,
    });
  };

  const iconFor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('peak') || n.includes('high') || n.includes('summer')) return <Sun className="w-4 h-4 text-orange-500" />;
    if (n.includes('low') || n.includes('off') || n.includes('winter')) return <Snowflake className="w-4 h-4 text-blue-500" />;
    return <DollarSign className="w-4 h-4 text-green-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Seasonal Templates</h3>
          <p className="text-sm text-muted-foreground">Set rates for specific date ranges (e.g., "Peak Season Dec 15–Jan 5").</p>
        </div>
        <Button onClick={() => { prefillRates(); setShowAdd(true); }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Sun className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No seasonal templates. Base rates apply year-round.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {iconFor(t.name)}
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.start_date} → {t.end_date}</div>
                      <div className="mt-1 flex gap-2 text-xs">
                        {t.single_rate && <span>Single: KES {t.single_rate}</span>}
                        {t.twin_rate && <span>Twin: KES {t.twin_rate}</span>}
                        {t.studio_rate && <span>Studio: KES {t.studio_rate}</span>}
                      </div>
                      {t.year_recurring && <Badge className="mt-1 bg-purple-100 text-purple-700">Recurring</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteTemplate.mutate(t.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Seasonal Template</DialogTitle>
            <DialogDescription>Define rates for a specific date range.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Template Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Peak Season, Low Season, Festive" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Single (KES)</Label><Input type="number" value={form.single_rate || ''}
                onChange={(e) => setForm({ ...form, single_rate: Number(e.target.value) })} /></div>
              <div><Label>Twin (KES)</Label><Input type="number" value={form.twin_rate || ''}
                onChange={(e) => setForm({ ...form, twin_rate: Number(e.target.value) })} /></div>
              <div><Label>Studio (KES)</Label><Input type="number" value={form.studio_rate || ''}
                onChange={(e) => setForm({ ...form, studio_rate: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.year_recurring} onCheckedChange={(v) => setForm({ ...form, year_recurring: v })} />
              <Label>Recurring annually</Label>
            </div>
            <Button onClick={handleAdd} className="w-full">Create Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// OVERBOOKING + REVENUE DASHBOARD
// ═══════════════════════════════════════════════════
function OverbookingDashboard() {
  const { data: summary } = useRevenueSummary();
  const { data: overbooking } = useOverbookingLimit();

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Revenue Summary (Last 30 Days)</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Revenue</div>
              <div className="text-2xl font-bold">KES {Number(summary?.total_revenue || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Room Revenue</div>
              <div className="text-2xl font-bold">KES {Number(summary?.room_revenue || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Restaurant Revenue</div>
              <div className="text-2xl font-bold">KES {Number(summary?.restaurant_revenue || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Avg Occupancy</div>
              <div className="text-2xl font-bold">{summary?.avg_occupancy_pct || 0}%</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 md:grid-cols-4 mt-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">ADR (Avg Daily Rate)</div>
              <div className="text-2xl font-bold">KES {Number(summary?.avg_daily_rate || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">RevPAR</div>
              <div className="text-2xl font-bold">KES {Number(summary?.revpar || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Bookings</div>
              <div className="text-2xl font-bold">{summary?.total_bookings || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Cancellation Rate</div>
              <div className="text-2xl font-bold">{summary?.cancellation_rate_pct || 0}%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Overbooking Calculator */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          <AlertTriangle className="w-5 h-5 inline mr-1 text-amber-500" />
          Safe Overbooking Calculator
        </h3>
        <p className="text-sm text-muted-foreground mb-3">Based on your 90-day cancellation rate, here's how many rooms you can safely overbook per type.</p>
        <div className="space-y-2">
          {overbooking?.map((ob: any) => (
            <div key={ob.room_type_name} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <span className="font-medium">{ob.room_type_name}</span>
                <span className="text-sm text-muted-foreground ml-2">({ob.total_rooms} rooms)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Cancellation rate: </span>
                  <span className="font-medium">{Number(ob.cancellation_rate).toFixed(1)}%</span>
                </div>
                <Badge className="bg-green-100 text-green-700">
                  Safe overbook: {ob.safe_overbook}
                </Badge>
                <Badge variant="outline">
                  Max allowed: {ob.max_allowed}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function RevenueManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Revenue Management
        </h1>
        <p className="text-muted-foreground">
          Dynamic pricing, rate plans, seasonal templates, and overbooking optimization.
        </p>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="calendar"><CalendarIcon className="w-4 h-4 mr-1" /> Rate Calendar</TabsTrigger>
          <TabsTrigger value="minstay"><Clock className="w-4 h-4 mr-1" /> Min Stay</TabsTrigger>
          <TabsTrigger value="pricing"><TrendingUp className="w-4 h-4 mr-1" /> Auto-Pricing</TabsTrigger>
          <TabsTrigger value="plans"><Users className="w-4 h-4 mr-1" /> Rate Plans</TabsTrigger>
          <TabsTrigger value="seasonal"><Sun className="w-4 h-4 mr-1" /> Seasonal</TabsTrigger>
          <TabsTrigger value="revenue"><BarChart3 className="w-4 h-4 mr-1" /> Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar"><RateCalendar /></TabsContent>
        <TabsContent value="minstay"><MinStaySection /></TabsContent>
        <TabsContent value="pricing"><PricingRulesSection /></TabsContent>
        <TabsContent value="plans"><RatePlansSection /></TabsContent>
        <TabsContent value="seasonal"><SeasonalSection /></TabsContent>
        <TabsContent value="revenue"><OverbookingDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
