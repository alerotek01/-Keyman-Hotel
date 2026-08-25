import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Bell, Plus, Trash2,
  Eye, BarChart3, Target, Globe, ArrowDown, ArrowUp, Star, DollarSign,
  RefreshCw, Search
} from "lucide-react";
import {
  useCompetitorHotels, useCreateCompetitorHotel, useDeleteCompetitorHotel,
  useRecordCompetitorRate, useCompetitorComparison, useCompetitorTrends,
  useRateAlerts, useMarkAlertRead, useScrapeLogs, useLogScrape,
} from "@/hooks/useCompetitorRates";
import { useRoomTypes } from "@/hooks/useRevenueManagement";

const SOURCE_LABELS: Record<string, string> = {
  booking_com: '🏨 Booking.com',
  expedia: '🌐 Expedia',
  google_hotels: '📍 Google Hotels',
  manual: '✏️ Manual Entry',
};

const ALERT_ICONS: Record<string, any> = {
  price_drop: ArrowDown,
  price_increase: ArrowUp,
  below_ours: Target,
  above_ours: TrendingUp,
  new_competitor: Plus,
  sold_out: AlertTriangle,
};

const ALERT_COLORS: Record<string, string> = {
  price_drop: 'bg-blue-100 text-blue-700',
  price_increase: 'bg-orange-100 text-orange-700',
  below_ours: 'bg-red-100 text-red-700',
  above_ours: 'bg-green-100 text-green-700',
  new_competitor: 'bg-purple-100 text-purple-700',
  sold_out: 'bg-gray-100 text-gray-700',
};

const HOTEL_TYPE_LABELS: Record<string, string> = {
  budget: '💰 Budget',
  mid_range: '🏠 Mid-Range',
  luxury: '✨ Luxury',
  lodge: '🦁 Safari Lodge',
  resort: '🏖️ Resort',
};

// ═══════════════════════════════════════════════════
// OVERVIEW — Competitor cards with latest rates
// ═══════════════════════════════════════════════════
function CompetitorOverview() {
  const { data: competitors = [], isLoading } = useCompetitorHotels();
  const { data: comparison } = useCompetitorComparison();
  const { data: alerts = [] } = useRateAlerts(true);
  const markRead = useMarkAlertRead();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const createHotel = useCreateCompetitorHotel();
  const deleteHotel = useDeleteCompetitorHotel();
  const [form, setForm] = useState({ name: '', location: 'Mwatate / Taita Hills', hotel_type: 'mid_range', star_rating: 3, booking_com_url: '' });

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter((a: any) => !a.is_read) : [];
  const ourRate = (comparison as any)?.our_average_rate || 0;

  const handleAdd = async () => {
    if (!form.name) { toast({ title: 'Name required' }); return; }
    await createHotel.mutateAsync(form);
    toast({ title: 'Competitor added' });
    setShowAdd(false);
    setForm({ name: '', location: 'Mwatate / Taita Hills', hotel_type: 'mid_range', star_rating: 3, booking_com_url: '' });
  };

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {unreadAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-amber-800">{unreadAlerts.length} New Rate Alerts</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                unreadAlerts.forEach((a: any) => markRead.mutate(a.id));
                toast({ title: 'Alerts marked as read' });
              }}>Mark all read</Button>
            </div>
            <div className="mt-2 space-y-1">
              {unreadAlerts.slice(0, 3).map((a: any) => (
                <div key={a.id} className="text-sm text-amber-700">• {a.message}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Competitor Hotels</h3>
          <p className="text-sm text-muted-foreground">Hotels we monitor in the Mwatate / Taita Hills area. Our avg rate: KES {ourRate}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Competitor</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map(c => {
            const compRates = (comparison as any)?.competitors?.filter((r: any) => r.hotel_name === c.name) || [];
            const lowestRate = compRates.length > 0 ? Math.min(...compRates.map((r: any) => r.rate)) : null;
            const highestRate = compRates.length > 0 ? Math.max(...compRates.map((r: any) => r.rate)) : null;
            const diff = lowestRate && ourRate ? lowestRate - ourRate : 0;

            return (
              <Card key={c.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-muted-foreground">{c.location}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{HOTEL_TYPE_LABELS[c.hotel_type] || c.hotel_type}</Badge>
                        {c.star_rating && (
                          <div className="flex">
                            {Array.from({ length: c.star_rating }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteHotel.mutate(c.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>

                  {compRates.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {compRates.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{r.room_type || 'Standard'}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">KES {r.rate}</span>
                            <span className={`text-xs ${r.vs_our_rate < 0 ? 'text-red-600' : r.vs_our_rate > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              {r.vs_our_rate < 0 ? `${r.vs_our_rate} (${r.vs_our_pct}%)` : r.vs_our_rate > 0 ? `+${r.vs_our_rate}` : '= ours'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">No rates recorded yet</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Competitor Hotel</DialogTitle>
            <DialogDescription>Add a nearby hotel to monitor their pricing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Hotel Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Taita Rocks Hotel" /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.hotel_type} onValueChange={(v) => setForm({ ...form, hotel_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="budget">Budget</SelectItem>
                    <SelectItem value="mid_range">Mid-Range</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="lodge">Safari Lodge</SelectItem>
                    <SelectItem value="resort">Resort</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Stars</Label>
                <Select value={String(form.star_rating)} onValueChange={(v) => setForm({ ...form, star_rating: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(s => <SelectItem key={s} value={String(s)}>{s} Star{s > 1 ? 's' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Booking.com URL (optional)</Label><Input value={form.booking_com_url} onChange={(e) => setForm({ ...form, booking_com_url: e.target.value })} placeholder="https://www.booking.com/hotel/ke/..." /></div>
            <Button onClick={handleAdd} className="w-full">Add Competitor</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// RATE COMPARISON — Side-by-side comparison
// ═══════════════════════════════════════════════════
function RateComparisonSection() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: comparison, isLoading } = useCompetitorComparison(selectedDate);
  const { data: roomTypes = [] } = useRoomTypes();

  const ourAvg = (comparison as any)?.our_average_rate || 0;
  const competitors = (comparison as any)?.competitors || [];

  // Group by room type
  const byType: Record<string, any[]> = {};
  competitors.forEach((c: any) => {
    const key = c.room_type || 'Standard';
    if (!byType[key]) byType[key] = [];
    byType[key].push(c);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Comparison</h3>
          <p className="text-sm text-muted-foreground">See how our rates stack up against competitors for a specific date.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Date:</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Our Rate Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-600 font-medium">Keyman Hotel — Our Rates</div>
              <div className="flex gap-4 mt-1">
                {roomTypes.map(rt => (
                  <div key={rt.id} className="text-sm">
                    <span className="text-muted-foreground">{rt.name}:</span>
                    <span className="font-semibold ml-1">KES {rt.base_rate}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-700">KES {ourAvg}</div>
              <div className="text-xs text-blue-600">Average</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-muted-foreground">Loading comparison...</p> :
      competitors.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No competitor rates for this date. Record rates manually or set up scraping.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byType).map(([roomType, rates]) => (
            <Card key={roomType}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{roomType} Room Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Sort by rate */}
                  {[...rates].sort((a: any, b: any) => a.rate - b.rate).map((r: any, i: number) => {
                    const diff = r.rate - ourAvg;
                    const pct = ourAvg > 0 ? ((diff / ourAvg) * 100).toFixed(1) : 0;
                    const isCheapest = i === 0;
                    const isMostExpensive = i === rates.length - 1;

                    return (
                      <div key={i} className={`flex items-center justify-between p-2 rounded ${isCheapest ? 'bg-green-50 border border-green-200' : isMostExpensive ? 'bg-red-50 border border-red-200' : ''}`}>
                        <div className="flex items-center gap-3">
                          {isCheapest && <Badge className="bg-green-100 text-green-700 text-xs">Cheapest</Badge>}
                          {isMostExpensive && <Badge className="bg-red-100 text-red-700 text-xs">Most Expensive</Badge>}
                          <span className="font-medium text-sm">{r.hotel_name}</span>
                          <span className="text-xs text-muted-foreground">{r.source}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">KES {r.rate}</span>
                          <span className={`text-xs font-medium ${diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {diff < 0 ? `${diff} (${pct}%)` : diff > 0 ? `+${diff} (+${pct}%)` : '= ours'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// RECORD RATE — Manual rate entry
// ═══════════════════════════════════════════════════
function RecordRateSection() {
  const { data: competitors = [] } = useCompetitorHotels();
  const recordRate = useRecordCompetitorRate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    hotel_id: '', stay_date: new Date().toISOString().split('T')[0],
    rate: 0, room_type: 'Standard', source: 'manual' as const,
    cancellation_policy: '', meal_plan: ''
  });

  const handleSubmit = async () => {
    if (!form.hotel_id || !form.rate) { toast({ title: 'Select hotel and enter rate' }); return; }
    try {
      await recordRate.mutateAsync({
        p_competitor_hotel_id: form.hotel_id,
        p_stay_date: form.stay_date,
        p_rate: form.rate,
        p_room_type: form.room_type,
        p_source: form.source,
        p_cancellation_policy: form.cancellation_policy || undefined,
        p_meal_plan: form.meal_plan || undefined,
      });
      toast({ title: 'Rate recorded!', description: 'Alert generated if this changes market position.' });
      setForm({ ...form, rate: 0 });
    } catch (e: any) { toast({ title: 'Error', description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Record Competitor Rate</h3>
        <p className="text-sm text-muted-foreground">Manually record rates you've found on OTAs or through direct research.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Competitor Hotel *</Label>
              <Select value={form.hotel_id} onValueChange={(v) => setForm({ ...form, hotel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                <SelectContent>
                  {competitors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Stay Date *</Label><Input type="date" value={form.stay_date} onChange={(e) => setForm({ ...form, stay_date: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>Rate (KES) *</Label><Input type="number" min={0} value={form.rate || ''} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} placeholder="e.g. 5500" /></div>
            <div><Label>Room Type</Label>
              <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Deluxe">Deluxe</SelectItem>
                  <SelectItem value="Suite">Suite</SelectItem>
                  <SelectItem value="Twin">Twin</SelectItem>
                  <SelectItem value="Single">Single</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking_com">Booking.com</SelectItem>
                  <SelectItem value="expedia">Expedia</SelectItem>
                  <SelectItem value="google_hotels">Google Hotels</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Cancellation Policy</Label>
              <Select value={form.cancellation_policy} onValueChange={(v) => setForm({ ...form, cancellation_policy: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Free cancellation">Free cancellation</SelectItem>
                  <SelectItem value="Non-refundable">Non-refundable</SelectItem>
                  <SelectItem value="Partial refund">Partial refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Meal Plan</Label>
              <Select value={form.meal_plan} onValueChange={(v) => setForm({ ...form, meal_plan: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Room only">Room only</SelectItem>
                  <SelectItem value="Breakfast included">Breakfast included</SelectItem>
                  <SelectItem value="Half board">Half board</SelectItem>
                  <SelectItem value="Full board">Full board</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={recordRate.isPending} className="w-full">
            {recordRate.isPending ? 'Recording...' : 'Record Rate'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// RATE ALERTS
// ═══════════════════════════════════════════════════
function RateAlertsSection() {
  const { data: alerts = [], isLoading } = useRateAlerts(false);
  const markRead = useMarkAlertRead();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Rate Alerts</h3>
        <p className="text-sm text-muted-foreground">Notifications when competitor prices change significantly.</p>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
      !Array.isArray(alerts) || alerts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No rate alerts yet. Record competitor rates to generate alerts.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a: any) => {
            const Icon = ALERT_ICONS[a.alert_type] || AlertTriangle;
            return (
              <div key={a.id} className={`flex items-center justify-between border rounded-lg p-3 ${!a.is_read ? 'bg-amber-50 border-amber-200' : ''}`}>
                <div className="flex items-center gap-3">
                  <Badge className={ALERT_COLORS[a.alert_type] || 'bg-gray-100'}>
                    <Icon className="w-3 h-3 mr-1" />
                    {a.alert_type.replace('_', ' ')}
                  </Badge>
                  <div>
                    <div className="font-medium text-sm">{a.hotel_name}</div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    {a.old_rate && <div className="text-muted-foreground line-through">KES {a.old_rate}</div>}
                    <div className="font-semibold">KES {a.new_rate}</div>
                    {a.our_rate && <div className="text-xs text-muted-foreground">Ours: KES {a.our_rate}</div>}
                  </div>
                  {!a.is_read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(a.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function CompetitorRatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6" /> Competitor Rate Monitor
        </h1>
        <p className="text-muted-foreground">
          Track competitor pricing across Booking.com, Expedia, and Google Hotels. Get alerts when rates change.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview"><Globe className="w-4 h-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="comparison"><BarChart3 className="w-4 h-4 mr-1" /> Comparison</TabsTrigger>
          <TabsTrigger value="record"><Plus className="w-4 h-4 mr-1" /> Record Rate</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="w-4 h-4 mr-1" /> Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><CompetitorOverview /></TabsContent>
        <TabsContent value="comparison"><RateComparisonSection /></TabsContent>
        <TabsContent value="record"><RecordRateSection /></TabsContent>
        <TabsContent value="alerts"><RateAlertsSection /></TabsContent>
      </Tabs>
    </div>
  );
}
